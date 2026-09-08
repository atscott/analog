/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://analogjs.org/license
 */

import { LocationStrategy } from '@angular/common';
import {
  Directive,
  ElementRef,
  HostAttributeToken,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  AfterContentInit,
  Renderer2,
  computed,
  forwardRef,
  inject,
  signal,
  booleanAttribute,
  ContentChildren,
  QueryList,
  type SimpleChanges,
} from '@angular/core';
import {
  Router,
  RouterLink,
  ActivatedRoute,
  UrlTree,
  NavigationEnd,
  type IsActiveMatchOptions,
  type NavigationBehaviorOptions,
  type QueryParamsHandling,
} from '@angular/router';
import { Subject, Subscription, type Observable } from 'rxjs';
import { filter } from 'rxjs/operators';

import type { TypedRouteTo, LinkOptions } from '../types/router-link';
import type { RegisteredNavigationMap, ParamsForPath } from '../types/register';
import {
  interpolatePath,
  resolveRelativePath,
  pathToCommands,
} from './navigation';

/**
 * Type-safe router link directive for AnalogJS.
 *
 * Provides compile-time template checking for routes, parameters, and search query schemas,
 * with full accessibility, SEO, modifier key, and active link state support.
 */
@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: 'a[typedRouterLink],button[typedRouterLink],[typedRouterLink]',
  standalone: true,
  providers: [
    {
      provide: RouterLink,
      useExisting: forwardRef(() => TypedRouterLink),
    },
  ],
  host: {
    '[attr.href]': 'computedHref()',
    '[attr.target]': 'effectiveTarget()',
    '[attr.tabindex]': 'effectiveTabIndex()',
    '[attr.aria-disabled]': 'disabled() ? "true" : null',
  },
})
export class TypedRouterLink<
  TTo extends string = string,
  TRouteMap extends Record<string, any> = RegisteredNavigationMap,
>
  implements OnChanges, OnDestroy
{
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly locationStrategy = inject(LocationStrategy, {
    optional: true,
  });
  private readonly el = inject(ElementRef);

  private readonly isAnchorElement: boolean;
  private readonly nativeHref = inject(new HostAttributeToken('href'), {
    optional: true,
  });
  private readonly nativeTabIndex = inject(new HostAttributeToken('tabindex'), {
    optional: true,
  });

  /** Emits when link inputs change for `RouterLinkActive` query subscriptions. */
  readonly onChanges = new Subject<TypedRouterLink<any, any>>();

  // --- Reactive Signals for Inputs ---
  private readonly _input = signal<
    TypedRouteTo<TTo, TRouteMap> | string | null | undefined
  >(null);
  private readonly _params = signal<Record<string, unknown> | undefined>(
    undefined,
  );
  private readonly _queryParams = signal<Record<string, unknown> | undefined>(
    undefined,
  );
  private readonly _from = signal<string | undefined>(undefined);
  private readonly _target = signal<string | undefined>(undefined);
  private readonly _replaceUrl = signal<boolean>(false);
  private readonly _skipLocationChange = signal<boolean>(false);
  private readonly _state = signal<Record<string, unknown> | undefined>(
    undefined,
  );
  private readonly _fragment = signal<string | undefined>(undefined);
  private readonly _queryParamsHandling = signal<
    QueryParamsHandling | null | undefined
  >(undefined);
  private readonly _preserveFragment = signal<boolean>(false);
  private readonly _relativeTo = signal<ActivatedRoute | undefined>(undefined);
  readonly disabled = signal<boolean>(false);

  // --- Input Bindings ---
  @Input()
  set typedRouterLink(
    val: TypedRouteTo<TTo, TRouteMap> | string | null | undefined,
  ) {
    this._input.set(val);
  }

  @Input()
  set params(val: ParamsForPath<TRouteMap, TTo> | undefined) {
    this._params.set(val as Record<string, unknown> | undefined);
  }

  @Input()
  set queryParams(val: Record<string, unknown> | undefined) {
    this._queryParams.set(val);
  }

  @Input()
  set from(val: string | undefined) {
    this._from.set(val);
  }

  @Input()
  set target(val: string | undefined) {
    this._target.set(val);
  }

  @Input({ transform: booleanAttribute })
  set replaceUrl(val: boolean) {
    this._replaceUrl.set(val);
  }

  @Input({ transform: booleanAttribute })
  set skipLocationChange(val: boolean) {
    this._skipLocationChange.set(val);
  }

  @Input()
  set state(val: Record<string, unknown> | undefined) {
    this._state.set(val);
  }

  @Input()
  set fragment(val: string | undefined) {
    this._fragment.set(val);
  }

  @Input()
  set queryParamsHandling(val: QueryParamsHandling | null | undefined) {
    this._queryParamsHandling.set(val);
  }

  @Input({ transform: booleanAttribute })
  set preserveFragment(val: boolean) {
    this._preserveFragment.set(val);
  }

  @Input()
  set relativeTo(val: ActivatedRoute | undefined) {
    this._relativeTo.set(val);
  }

  @Input({ transform: booleanAttribute })
  set disabledLink(val: boolean) {
    this.disabled.set(val);
  }

  constructor() {
    const tagName = this.el.nativeElement?.tagName?.toLowerCase();
    this.isAnchorElement =
      tagName === 'a' ||
      tagName === 'area' ||
      !!(
        typeof customElements === 'object' &&
        (
          customElements.get(tagName) as
            | { observedAttributes?: string[] }
            | undefined
        )?.observedAttributes?.includes?.('href')
      );
  }

  /**
   * Computed reactive UrlTree reflecting current inputs.
   */
  readonly _urlTree = computed<UrlTree | null>(() => {
    const raw = this._input();
    if (raw == null || this.disabled()) {
      return null;
    }

    let toPath = '';
    const mergedParams: Record<string, unknown> = { ...this._params() };
    const mergedQueryParams: Record<string, unknown> = {
      ...this._queryParams(),
    };
    let fragment = this._fragment();
    let queryParamsHandling = this._queryParamsHandling();
    let preserveFragment = this._preserveFragment();
    let fromRoute = this._from();

    if (typeof raw === 'string') {
      toPath = raw;
    } else if (typeof raw === 'object') {
      const opts = raw as LinkOptions;
      toPath = opts.to;
      if (opts.params) Object.assign(mergedParams, opts.params);
      if (opts.queryParams) Object.assign(mergedQueryParams, opts.queryParams);
      if (opts.fragment !== undefined) fragment = opts.fragment;
      if (opts.queryParamsHandling !== undefined)
        queryParamsHandling = opts.queryParamsHandling;
      if (opts.preserveFragment !== undefined)
        preserveFragment = opts.preserveFragment;
      if (opts.from !== undefined) fromRoute = opts.from;
    }

    if (!toPath) return null;

    // Resolve relative path if `from` is specified
    let target = toPath;
    if (fromRoute && !target.startsWith('/')) {
      target = resolveRelativePath(fromRoute, target);
    }

    // Interpolate path parameters
    const concretePath = interpolatePath(target, mergedParams);

    // Format fragment
    const cleanFrag = fragment ? fragment.replace(/^#/, '') : undefined;

    const commands = pathToCommands(concretePath);

    return this.router.createUrlTree(commands, {
      queryParams:
        Object.keys(mergedQueryParams).length > 0
          ? mergedQueryParams
          : undefined,
      queryParamsHandling: queryParamsHandling ?? undefined,
      fragment: cleanFrag,
      preserveFragment,
      relativeTo:
        this._relativeTo() ?? (target.startsWith('/') ? undefined : this.route),
    });
  });

  /** UrlTree getter matching RouterLink contract for RouterLinkActive */
  get urlTree(): UrlTree | null {
    return this._urlTree();
  }

  /**
   * Reactive href attribute for native anchor tags.
   */
  readonly computedHref = computed<string | null>(() => {
    if (!this.isAnchorElement || this.disabled()) {
      return this.nativeHref ?? null;
    }
    const tree = this._urlTree();
    if (!tree) return null;
    return this.locationStrategy
      ? this.locationStrategy.prepareExternalUrl(this.router.serializeUrl(tree))
      : this.router.serializeUrl(tree);
  });

  /** Effective target attribute. */
  readonly effectiveTarget = computed<string | null>(() => {
    return this._target() ?? null;
  });

  /** Effective tabindex for keyboard accessibility on non-anchor elements. */
  readonly effectiveTabIndex = computed<string | null>(() => {
    if (this.isAnchorElement) return null;
    if (this.disabled()) return '-1';
    return this.nativeTabIndex ?? '0';
  });

  ngOnChanges(_changes: SimpleChanges): void {
    this.onChanges.next(this);
  }

  ngOnDestroy(): void {
    this.onChanges.complete();
  }

  /**
   * Click event handler.
   * Handles modifier keys, accessibility, and navigation execution.
   */
  @HostListener('click', ['$event'])
  onClick(event: Event): boolean {
    const mouseEvent = event as MouseEvent;
    const button = mouseEvent.button ?? 0;
    const ctrlKey = mouseEvent.ctrlKey ?? false;
    const shiftKey = mouseEvent.shiftKey ?? false;
    const altKey = mouseEvent.altKey ?? false;
    const metaKey = mouseEvent.metaKey ?? false;

    if (this.disabled()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return false;
    }

    const tree = this._urlTree();
    if (!tree) return true;

    if (this.isAnchorElement) {
      // Allow browser native navigation on middle click or modifier keys (Cmd/Ctrl/Shift/Alt)
      if (button !== 0 || ctrlKey || shiftKey || altKey || metaKey) {
        return true;
      }
      // Allow browser native navigation if target is set and not '_self' (e.g. '_blank')
      const target = this.effectiveTarget();
      if (target && target !== '_self') {
        return true;
      }
    }

    // Extract navigation options
    const raw = this._input();
    let replaceUrl = this._replaceUrl();
    let skipLocationChange = this._skipLocationChange();
    let state = this._state();

    if (typeof raw === 'object' && raw !== null) {
      const opts = raw as LinkOptions;
      if (opts.replaceUrl !== undefined) replaceUrl = opts.replaceUrl;
      if (opts.skipLocationChange !== undefined)
        skipLocationChange = opts.skipLocationChange;
      if (opts.state !== undefined) state = opts.state as any;
    }

    const extras: NavigationBehaviorOptions = {
      replaceUrl,
      skipLocationChange,
      state,
    };

    this.router.navigateByUrl(tree, extras).catch((err) => {
      // Catch navigation rejection if route guards cancel
      if (typeof console !== 'undefined' && console.error) {
        console.error('[TypedRouterLink] Navigation error:', err);
      }
    });

    // Return false for anchor tags to prevent native browser reload; return true for buttons
    if (this.isAnchorElement) {
      event.preventDefault();
      return false;
    }

    return true;
  }
}

/**
 * Type-safe active router link directive for AnalogJS.
 *
 * Automatically marks host elements with active CSS classes and `aria-current` attributes
 * when the linked route matches the active router state.
 */
@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: '[typedRouterLinkActive]',
  standalone: true,
  exportAs: 'typedRouterLinkActive',
})
export class TypedRouterLinkActive
  implements OnChanges, OnDestroy, AfterContentInit
{
  private readonly router = inject(Router);
  private readonly el = inject(ElementRef);
  private readonly renderer = inject(Renderer2);
  private readonly link =
    inject(TypedRouterLink, { optional: true }) ??
    inject(RouterLink, { optional: true });

  @ContentChildren(TypedRouterLink, { descendants: true })
  links?: QueryList<TypedRouterLink>;

  @ContentChildren(RouterLink, { descendants: true })
  routerLinks?: QueryList<RouterLink>;

  @Input('typedRouterLinkActive')
  set activeClass(classes: string | string[]) {
    this._classes = Array.isArray(classes)
      ? classes
      : classes
        ? classes.split(' ').filter(Boolean)
        : [];
  }
  private _classes: string[] = [];

  @Input()
  typedRouterLinkActiveOptions: { exact: boolean } | IsActiveMatchOptions = {
    exact: false,
  };

  @Input()
  ariaCurrentWhenActive:
    | 'page'
    | 'step'
    | 'location'
    | 'date'
    | 'time'
    | true
    | false = 'page';

  readonly isActive = signal<boolean>(false);

  private sub?: Subscription;
  private linkInputSub?: Subscription;

  ngAfterContentInit(): void {
    this.sub = new Subscription();

    this.sub.add(
      this.router.events
        .pipe(filter((e) => e instanceof NavigationEnd))
        .subscribe(() => {
          this.update();
        }),
    );

    if (this.links) {
      this.sub.add(
        this.links.changes.subscribe(() => {
          this.subscribeToEachLinkOnChanges();
          this.update();
        }),
      );
    }

    if (this.routerLinks) {
      this.sub.add(
        this.routerLinks.changes.subscribe(() => {
          this.subscribeToEachLinkOnChanges();
          this.update();
        }),
      );
    }

    this.subscribeToEachLinkOnChanges();
    this.update();
  }

  private subscribeToEachLinkOnChanges(): void {
    this.linkInputSub?.unsubscribe();
    const allLinks: { onChanges?: Observable<any> }[] = [];
    if (this.link) {
      allLinks.push(this.link as { onChanges?: Observable<any> });
    }
    if (this.links) {
      this.links.forEach((l) => allLinks.push(l));
    }
    if (this.routerLinks) {
      this.routerLinks.forEach((l) =>
        allLinks.push(l as unknown as { onChanges?: Observable<any> }),
      );
    }

    const subs = new Subscription();
    for (const l of allLinks) {
      if (l.onChanges) {
        subs.add(
          l.onChanges.subscribe(() => {
            this.update();
          }),
        );
      }
    }
    this.linkInputSub = subs;
  }

  ngOnChanges(): void {
    this.update();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.linkInputSub?.unsubscribe();
  }

  private hasActiveLinks(): boolean {
    const options = this.typedRouterLinkActiveOptions;
    const matchOptions: boolean | IsActiveMatchOptions =
      typeof options === 'object' &&
      options !== null &&
      'exact' in options &&
      !('paths' in options)
        ? (options as { exact: boolean }).exact
          ? {
              paths: 'exact',
              queryParams: 'exact',
              fragment: 'ignored',
              matrixParams: 'ignored',
            }
          : {
              paths: 'subset',
              queryParams: 'subset',
              fragment: 'ignored',
              matrixParams: 'ignored',
            }
        : (options as IsActiveMatchOptions);

    const allLinks: { urlTree: UrlTree | null }[] = [];

    if (this.link) {
      allLinks.push(this.link);
    }
    if (this.links) {
      this.links.forEach((l) => allLinks.push(l));
    }
    if (this.routerLinks) {
      this.routerLinks.forEach((l) => allLinks.push(l));
    }

    for (const l of allLinks) {
      const tree = l.urlTree;
      if (tree && this.router.isActive(tree, matchOptions as any)) {
        return true;
      }
    }
    return false;
  }

  private update(): void {
    const active = this.hasActiveLinks();
    this.isActive.set(active);

    for (const cls of this._classes) {
      if (active) {
        this.renderer.addClass(this.el.nativeElement, cls);
      } else {
        this.renderer.removeClass(this.el.nativeElement, cls);
      }
    }

    if (active && this.ariaCurrentWhenActive) {
      const val =
        this.ariaCurrentWhenActive === true
          ? 'page'
          : String(this.ariaCurrentWhenActive);
      this.renderer.setAttribute(this.el.nativeElement, 'aria-current', val);
    } else {
      this.renderer.removeAttribute(this.el.nativeElement, 'aria-current');
    }
  }
}

/**
 * Combined standalone directives for easy one-liner imports in component metadata.
 */
export const TYPED_ROUTER_DIRECTIVES = [
  TypedRouterLink,
  TypedRouterLinkActive,
] as const;
