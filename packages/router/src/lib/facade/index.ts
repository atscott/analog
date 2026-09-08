/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://analogjs.org/license
 */

export {
  injectParams,
  injectQueryParams,
  injectRouteData,
  type InjectRouteOptions,
  type BaseHookOptions,
  type InjectParamsOptions,
  type InjectQueryParamsOptions,
  type InjectRouteDataOptions,
  type InferParams,
  type InferQueryParams,
  type InferRouteData,
} from './hooks';

export {
  injectNavigate,
  interpolatePath,
  pathToCommands,
  resolveRelativePath,
} from './navigation';

export { TypedRouterLink } from './router-link';
