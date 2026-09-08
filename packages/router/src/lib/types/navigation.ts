/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://analogjs.org/license
 */

import type { Injector } from '@angular/core';
import type { ActivatedRoute, QueryParamsHandling } from '@angular/router';

import type { RegisteredNavigationMap } from './register';
import type { ParseParams, Simplify } from './params';
import type { ResolveQueryParamsInput } from './query-params';
import type { CleanToPath } from './relative-path';

/**
 * Parameter difference algebra:
 * Retains shared keys between TFrom and TTo as optional, while keeping
 * newly introduced parameters in TTo strictly required.
 */
export type MakeDifferenceOptional<TFrom, TTo> = Simplify<
  { [K in Exclude<keyof TTo, keyof TFrom>]: TTo[K] } & {
    [K in Extract<keyof TTo, keyof TFrom>]?: TTo[K];
  }
>;

/**
 * Resolves route parameters for a given path from a navigation map.
 */
export type RouteParamsForPath<
  TPath extends string,
  TNavMap = RegisteredNavigationMap,
> = TPath extends keyof TNavMap
  ? TNavMap[TPath] extends { types?: { params: infer P } }
    ? P
    : ParseParams<TPath>
  : ParseParams<TPath>;

/**
 * Resolves query parameters for a given path from a navigation map.
 */
export type RouteQueryParamsForPath<
  TPath extends string,
  TNavMap = RegisteredNavigationMap,
> = TPath extends keyof TNavMap
  ? TNavMap[TPath] extends { types?: { queryParams: infer Q } }
    ? Q
    : TNavMap[TPath] extends { validateQueryParams?: infer V }
      ? ResolveQueryParamsInput<V>
      : TNavMap[TPath] extends { types?: { search: infer S } }
        ? S
        : TNavMap[TPath] extends { search: infer S }
          ? S
          : TNavMap[TPath] extends { validateSearch?: infer V }
            ? ResolveQueryParamsInput<V>
            : Record<string, any>
  : Record<string, any>;

/** Backward-compatibility alias */
export type RouteSearchForPath<
  TPath extends string,
  TNavMap = RegisteredNavigationMap,
> = RouteQueryParamsForPath<TPath, TNavMap>;

/**
 * Functional parameter updater function.
 */
export type ParamsUpdaterFn<TFromParams, TTargetParams> = (
  prev: TFromParams,
) => TTargetParams;

/**
 * Base navigation options directly mirroring Angular's NavigationExtras.
 */
export interface BaseNavigateOptions {
  /** Target route relative to which the destination URL should be resolved (Angular standard). */
  relativeTo?: ActivatedRoute | null;
  /** When true, navigates without creating a new browser history entry. */
  replaceUrl?: boolean;
  /** Custom state object passed to browser History state and NavigationExtras. */
  state?: { [k: string]: any } | unknown;
  /** Target URL fragment (leading '#' is automatically stripped). */
  fragment?: string;
  /** Handling strategy for existing query parameters. */
  queryParamsHandling?: QueryParamsHandling | null;
  /** Preserves the existing URL fragment when navigating. */
  preserveFragment?: boolean;
  /** Navigates without updating the browser URL bar. */
  skipLocationChange?: boolean;
  /** Optional developer-defined navigation info passed along with navigation events. */
  info?: unknown;
  /** Strategy when navigation to the same URL is requested ('reload' | 'ignore'). */
  onSameUrlNavigation?: 'reload' | 'ignore';
  /** Optional Angular Injector to use for DI resolution. */
  injector?: Injector;
}

/**
 * Comprehensive compile-time navigation options.
 *
 * Enforces:
 * - Statically valid destination routes.
 * - Required path parameters (cannot be omitted if route has mandatory params).
 * - Strongly typed query parameters.
 * - Optional functional parameter updaters `(prev) => ({ ...prev })`.
 */
export type NavigateOptions<
  TTo extends string = string,
  TFrom extends string | undefined = undefined,
  TParams = unknown,
  TQueryParams = unknown,
> = Simplify<
  BaseNavigateOptions & {
    to: TTo;
    from?: TFrom;
    queryParams?: TQueryParams | ((prev: Record<string, any>) => TQueryParams);
  } & (Record<never, never> extends TParams
      ? {
          params?:
            | TParams
            | ParamsUpdaterFn<
                [TFrom] extends [string]
                  ? RouteParamsForPath<TFrom>
                  : Record<string, string>,
                TParams
              >;
        }
      : {
          params:
            | TParams
            | ParamsUpdaterFn<
                [TFrom] extends [string]
                  ? RouteParamsForPath<TFrom>
                  : Record<string, string>,
                TParams
              >;
        })
>;

/**
 * Discriminated navigation options for a specific route entry.
 */
export type RouteNavigateOptions<
  TPath extends string,
  TRoute,
  TParams = RouteParamsForPath<TPath, Record<TPath, TRoute>>,
  TQueryParams = RouteQueryParamsForPath<TPath, Record<TPath, TRoute>>,
> = Simplify<
  BaseNavigateOptions & {
    to: TPath;
    from?: string;
    queryParams?: TQueryParams | ((prev: Record<string, any>) => TQueryParams);
  } & (Record<never, never> extends TParams
      ? {
          params?: TParams | ParamsUpdaterFn<Record<string, string>, TParams>;
        }
      : {
          params: TParams | ParamsUpdaterFn<Record<string, string>, TParams>;
        })
>;

/**
 * Discriminated mapped union over all registered navigation routes.
 * Prevents generic deferral and widening, ensuring instant compiler narrowing.
 */
export type NavigateOptionsForMap<TNavMap = RegisteredNavigationMap> = {
  [K in keyof TNavMap & string]: RouteNavigateOptions<K, TNavMap[K]>;
}[keyof TNavMap & string];

/**
 * Relative navigation options for route-scoped transitions.
 */
export type RelativeNavigateOptionsForRoute<
  TFrom extends string,
  TTo extends string,
  TFromParams,
  TTargetParams,
  TQueryParams,
  TEffectiveParams = MakeDifferenceOptional<TFromParams, TTargetParams>,
> = Simplify<
  BaseNavigateOptions & {
    to: TTo;
    from?: TFrom;
    queryParams?: TQueryParams | ((prev: Record<string, any>) => TQueryParams);
  } & (Record<never, never> extends TEffectiveParams
      ? {
          params?:
            | TEffectiveParams
            | ParamsUpdaterFn<TFromParams, TEffectiveParams>;
        }
      : {
          params:
            | TEffectiveParams
            | ParamsUpdaterFn<TFromParams, TEffectiveParams>;
        })
>;

/**
 * Discriminated mapped union of relative options available from a reference `from` route.
 */
export type RelativeOptionsForMap<
  TFrom extends string,
  TNavMap = RegisteredNavigationMap,
> = {
  [K in keyof TNavMap & string]:
    | RelativeNavigateOptionsForRoute<
        TFrom,
        K,
        RouteParamsForPath<TFrom, TNavMap>,
        RouteParamsForPath<K, TNavMap>,
        RouteQueryParamsForPath<K, TNavMap>
      >
    | (K extends CleanToPath<TFrom>
        ? RelativeNavigateOptionsForRoute<
            TFrom,
            '.' | './',
            RouteParamsForPath<TFrom, TNavMap>,
            RouteParamsForPath<K, TNavMap>,
            RouteQueryParamsForPath<K, TNavMap>
          >
        : never)
    | (K extends `${CleanToPath<TFrom>}/${infer TChild}`
        ? RelativeNavigateOptionsForRoute<
            TFrom,
            TChild | `./${TChild}`,
            RouteParamsForPath<TFrom, TNavMap>,
            RouteParamsForPath<K, TNavMap>,
            RouteQueryParamsForPath<K, TNavMap>
          >
        : never)
    | (CleanToPath<TFrom> extends `${K}/${string}`
        ? RelativeNavigateOptionsForRoute<
            TFrom,
            '..' | '../',
            RouteParamsForPath<TFrom, TNavMap>,
            RouteParamsForPath<K, TNavMap>,
            RouteQueryParamsForPath<K, TNavMap>
          >
        : never);
}[keyof TNavMap & string];

/**
 * Route-bound navigator function created via `injectNavigate({ from })`.
 */
export type RouteBoundNavigator<
  TFrom extends string,
  TNavMap = RegisteredNavigationMap,
> = (options: RelativeOptionsForMap<TFrom, TNavMap>) => Promise<boolean>;

/**
 * Global navigator function created via `injectNavigate()`.
 */
export type GlobalNavigator<TNavMap = RegisteredNavigationMap> = (
  options: NavigateOptionsForMap<TNavMap>,
) => Promise<boolean>;
