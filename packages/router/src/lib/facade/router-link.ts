/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://analogjs.org/license
 */

import {
  Directive,
  Input,
  ElementRef,
  Renderer2,
  inject,
  forwardRef,
} from '@angular/core';
import { LocationStrategy } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';

import type { TypedRouteTo } from '../types/router-link';
import type { RegisteredNavigationMap, ParamsForPath } from '../types/register';
import { interpolatePath, pathToCommands } from './navigation';

/**
 * Type-safe router link directive for AnalogJS.
 *
 * Extends Angular's standard `RouterLink` to provide compile-time template checking
 * for routes and parameters, while inheriting full accessibility, SEO, modifier key,
 * and active link state support.
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
})
export class TypedRouterLink<
  TTo extends string = string,
  TRouteMap extends Record<string, any> = RegisteredNavigationMap,
> extends RouterLink {
  constructor() {
    const el = inject(ElementRef);
    super(
      inject(Router),
      inject(ActivatedRoute, { optional: true }) as ActivatedRoute,
      el.nativeElement?.getAttribute?.('tabindex') ?? null,
      inject(Renderer2),
      el,
      inject(LocationStrategy, { optional: true }) ?? undefined,
    );
  }

  private _typedInput:
    | TypedRouteTo<TTo, TRouteMap>
    | string
    | null
    | undefined = null;
  private _params?: Record<string, unknown>;

  @Input()
  set typedRouterLink(
    val: TypedRouteTo<TTo, TRouteMap> | string | null | undefined,
  ) {
    this._typedInput = val;
    this.updateCommands();
  }

  @Input()
  set params(val: ParamsForPath<TRouteMap, TTo> | undefined) {
    this._params = val as Record<string, unknown> | undefined;
    this.updateCommands();
  }

  private updateCommands(): void {
    if (this._typedInput === null || this._typedInput === undefined) {
      this.routerLink = null;
      return;
    }

    if (typeof this._typedInput === 'string') {
      try {
        const path = interpolatePath(this._typedInput, this._params);
        this.routerLink = pathToCommands(path);
      } catch {
        this.routerLink = null;
      }
      return;
    }

    if (typeof this._typedInput === 'object') {
      const { to, params, queryParams, ...rest } = this._typedInput as any;
      const mergedParams = { ...params, ...this._params };
      try {
        const path = interpolatePath(to, mergedParams);
        this.routerLink = pathToCommands(path);
      } catch {
        this.routerLink = null;
      }

      if (queryParams !== undefined) {
        this.queryParams = queryParams;
      }
      if (rest.target !== undefined) this.target = rest.target;
      if (rest.replaceUrl !== undefined) this.replaceUrl = rest.replaceUrl;
      if (rest.skipLocationChange !== undefined)
        this.skipLocationChange = rest.skipLocationChange;
      if (rest.state !== undefined) this.state = rest.state;
      if (rest.fragment !== undefined) this.fragment = rest.fragment;
      if (rest.queryParamsHandling !== undefined)
        this.queryParamsHandling = rest.queryParamsHandling;
      if (rest.preserveFragment !== undefined)
        this.preserveFragment = rest.preserveFragment;
    }
  }
}
