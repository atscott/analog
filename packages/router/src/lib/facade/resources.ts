import type {
  ParentData,
  ExtractRouteData,
  ParentResourcesFor,
  RouteResourcesFor,
  FacadeResourceContext,
} from '../types/resources';

export type {
  ParentData,
  ExtractRouteData,
  ParentResourcesFor,
  RouteResourcesFor,
  FacadeResourceContext,
};

/**
 * Symbol key used to store and retrieve the query parameter validator on Angular Route data.
 */
export const QUERY_PARAMS_VALIDATOR_KEY = Symbol.for(
  '@analogjs/router/validateQueryParams',
);

/**
 * Symbol key used to store and retrieve the route ID on Angular Route data.
 */
export const ROUTE_ID_KEY = Symbol.for('@analogjs/router/id');

/**
 * Symbol key used to store and retrieve the full hierarchical path on Angular Route data.
 */
export const FULL_PATH_KEY = Symbol.for('@analogjs/router/fullPath');

/**
 * Symbol key used to store and retrieve route resources config on Angular Route data.
 */
export const RESOURCES_KEY = Symbol.for('@analogjs/router/resources');
