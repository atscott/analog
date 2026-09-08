/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://analogjs.org/license
 */

/**
 * Extracts query parameters from a route definition or carrier type.
 */
export type InferRouteQueryParams<TRoute> = TRoute extends {
  types: { queryParams: infer TQueryParams };
}
  ? TQueryParams
  : TRoute extends { queryParams: infer TQueryParams }
    ? TQueryParams
    : Record<string, any>;
