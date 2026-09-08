/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://analogjs.org/license
 */

export { createFileRoute, type FileRoute } from './file-route';

export {
  QUERY_PARAMS_VALIDATOR_KEY,
  ROUTE_ID_KEY,
  FULL_PATH_KEY,
  RESOURCES_KEY,
  type FacadeResourceContext,
} from './resources';

export {
  injectParams,
  injectQueryParams,
  getQueryParams,
  injectRouteData,
  injectRouteResources,
  injectRoute,
  type InjectedRoute,
  type InjectParamsOptions,
  type InjectQueryParamsOptions,
  type GetQueryParamsOptions,
  type InjectRouteDataOptions,
  type InjectRouteResourcesOptions,
  type InferParams,
  type InferQueryParams,
  type InferRouteData,
  type InferRouteResource,
} from './hooks';

export { navigate, injectNavigate } from './navigation';

export {
  TypedRouterLink,
  TypedRouterLinkActive,
  TYPED_ROUTER_DIRECTIVES,
} from './router-link';
