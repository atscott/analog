/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://analogjs.org/license
 */

import type { QueryParamsHandling } from '@angular/router';

import type { RegisteredNavigationMap } from './register';
import type { RouteParamsForPath, RouteQueryParamsForPath } from './navigation';

/**
 * Checks whether a route path contains required path parameters.
 */
export type HasRequiredParams<
  TPath extends string,
  TRouteMap extends Record<string, any> = RegisteredNavigationMap,
> =
  Record<never, never> extends RouteParamsForPath<TPath, TRouteMap>
    ? false
    : true;

/**
 * Extracts all routes from the navigation map that require no path parameters.
 * These routes can be used as bare string literals in templates.
 */
export type StaticRoutes<
  TRouteMap extends Record<string, any> = RegisteredNavigationMap,
> = string extends keyof TRouteMap
  ? string
  : {
      [K in keyof TRouteMap & string]: HasRequiredParams<
        K,
        TRouteMap
      > extends false
        ? K
        : never;
    }[keyof TRouteMap & string];

/**
 * Resolves the query parameters input schema for a given route in the navigation map.
 */
export type QueryParamsInputForPath<
  TRouteMap extends Record<string, any>,
  TPath extends string,
> = RouteQueryParamsForPath<TPath, TRouteMap>;

/**
 * Common navigation and DOM options for links.
 */
export interface LinkBaseOptions {
  /** Target frame or browsing context (e.g. '_blank', '_self'). */
  target?: string;
  /** Whether to replace the current URL in browser history (Angular standard). */
  replaceUrl?: boolean;
  /** Whether to navigate without updating the browser URL bar. */
  skipLocationChange?: boolean;
  /** State object persisted into history.state. */
  state?: unknown;
  /** Fragment identifier (Angular standard). */
  fragment?: string;
  /** Query params handling strategy ('merge' | 'preserve'). */
  queryParamsHandling?: QueryParamsHandling | null;
  /** Whether to preserve the current URL fragment. */
  preserveFragment?: boolean;
  /** Whether navigation is disabled on this link. */
  disabled?: boolean;
}

/**
 * Relative path string patterns accepted for relative navigation.
 */
export type RelativePathString =
  | '.'
  | './'
  | '..'
  | '../'
  | `./${string}`
  | `../${string}`;

/**
 * Strongly typed composite link options.
 * Statically enforces required parameters and queryParams schema.
 */
export type LinkOptions<
  TTo extends string = string,
  TFrom extends string | undefined = undefined,
  TRouteMap extends Record<string, any> = RegisteredNavigationMap,
> = LinkBaseOptions & {
  /** Destination route path. Must be a valid registered route or relative path. */
  to: TTo;
  /**
   * Origin route for relative path calculus.
   * If provided, `to` is resolved relatively against `from` at compile time.
   */
  from?: TFrom;
  /** Query parameters validated against the route's queryParams schema. */
  queryParams?: QueryParamsInputForPath<TRouteMap, TTo>;
} & (HasRequiredParams<TTo, TRouteMap> extends true
    ? {
        /** Path parameters required by the destination route. */
        params: RouteParamsForPath<TTo, TRouteMap>;
      }
    : {
        /** Optional parameters for unparameterized routes. */
        params?: RouteParamsForPath<TTo, TRouteMap>;
      });

/**
 * Unified input type accepted by `[typedRouterLink]`.
 * Supports:
 * 1. Bare string literals for static routes requiring no parameters
 * 2. Relative navigation string paths (e.g. '../', './child')
 * 3. Composite options objects matching navigation options for full type safety
 */
export type TypedRouteTo<
  TTo extends string = string,
  TRouteMap extends Record<string, any> = RegisteredNavigationMap,
> = [TTo] extends [keyof TRouteMap & string]
  ?
      | (HasRequiredParams<TTo, TRouteMap> extends false ? TTo : never)
      | LinkOptions<TTo, any, TRouteMap>
  : [TTo] extends [RelativePathString]
    ?
        | TTo
        | (LinkBaseOptions & {
            to: TTo;
            from?: string;
            params?: Record<string, unknown>;
            queryParams?: Record<string, any>;
          })
    :
        | StaticRoutes<TRouteMap>
        | RelativePathString
        | {
            [K in keyof TRouteMap & string]: LinkOptions<K, any, TRouteMap>;
          }[keyof TRouteMap & string]
        | (LinkBaseOptions & {
            to: RelativePathString;
            from?: string;
            params?: Record<string, unknown>;
            queryParams?: Record<string, any>;
          });
