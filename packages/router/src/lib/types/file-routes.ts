import type { Resource, Type } from '@angular/core';
import type {
  CanActivateChildFn,
  CanActivateFn,
  CanDeactivateFn,
  CanMatchFn,
  DeprecatedGuard,
  ResolveFn,
  Route,
  RunGuardsAndResolvers,
} from '@angular/router';

import type { MetaTag } from '../meta-tags';
import type { RouteParamsFor } from './params';
import type { QueryParamValidator } from './query-params';
import type {
  FacadeResourceContext,
  ExtractResolvedData,
  RouteResourcesFor,
} from './resources';
import type { FileRoutesByPath } from './register';

/**
 * Lazy component loader returning a Component Type or module with default export.
 */
export type RouteComponentLoader = () => Promise<
  Type<unknown> | { default: Type<unknown> }
>;

/**
 * Checks whether `FileRoutesByPath` has been augmented via declaration merging.
 */
export type IsFileRoutesAugmented = [keyof FileRoutesByPath] extends [never]
  ? false
  : true;

/**
 * Resolves the parent route type for a given file path from `FileRoutesByPath`.
 * Returns `unknown` if unaugmented or not found.
 */
export type FileRouteParentRoute<TFilePath> =
  TFilePath extends keyof FileRoutesByPath
    ? FileRoutesByPath[TFilePath] extends { parentRoute: infer P }
      ? P
      : unknown
    : unknown;

/**
 * Resolves the local path segment for a given file path from `FileRoutesByPath`.
 */
export type FileRoutePath<TFilePath> = TFilePath extends keyof FileRoutesByPath
  ? FileRoutesByPath[TFilePath] extends { path: infer P extends string }
    ? P
    : TFilePath extends string
      ? TFilePath
      : string
  : TFilePath extends string
    ? TFilePath
    : string;

/**
 * Resolves the route ID for a given file path from `FileRoutesByPath`.
 */
export type FileRouteId<TFilePath> = TFilePath extends keyof FileRoutesByPath
  ? FileRoutesByPath[TFilePath] extends { id: infer I extends string }
    ? I
    : TFilePath extends string
      ? TFilePath
      : string
  : TFilePath extends string
    ? TFilePath
    : string;

/**
 * Resolves the canonical full path for a given file path from `FileRoutesByPath`.
 */
export type FileRouteFullPath<TFilePath> =
  TFilePath extends keyof FileRoutesByPath
    ? FileRoutesByPath[TFilePath] extends { fullPath: infer FP extends string }
      ? FP
      : TFilePath extends string
        ? TFilePath
        : string
    : TFilePath extends string
      ? TFilePath
      : string;

/**
 * Options accepted by createFileRoute(path)(options).
 * Directly maps to Angular Route configuration properties.
 */
export interface FileRouteOptions<
  TPath extends string = string,
  TResolve extends Record<string, any> = Record<string, any>,
  TQueryParams = unknown,
  TResources extends Record<string, Resource<unknown>> = Record<
    string,
    Resource<unknown>
  >,
  TParams = RouteParamsFor<unknown, TPath>,
> {
  path?: TPath;
  id?: string;
  validateQueryParams?: QueryParamValidator<any, TQueryParams>;
  resolve?: TResolve;
  resources?: (
    ctx: FacadeResourceContext<TParams, TQueryParams>,
  ) => TResources | Promise<TResources>;
  component?: Type<unknown>;
  loadComponent?: RouteComponentLoader;
  title?: string | ResolveFn<string>;
  canActivate?: CanActivateFn[] | DeprecatedGuard[];
  canActivateChild?: CanActivateChildFn[];
  canDeactivate?: CanDeactivateFn<unknown>[];
  canMatch?: CanMatchFn[];
  data?: Record<string, unknown>;
  providers?: any[];
  runGuardsAndResolvers?: RunGuardsAndResolvers;
  redirectTo?: string;
  pathMatch?: Route['pathMatch'];
  meta?: MetaTag[] | ResolveFn<MetaTag[]>;
}

/**
 * File route definition interface returned by createFileRoute.
 * Dual-implements RouteDefinition and RouteMeta compatibility.
 */
export interface FileRouteDefinition<
  TPath extends string = string,
  TId extends string = string,
  TParentRoute = unknown,
  TQueryParams = unknown,
  TResolve extends Record<string, any> = Record<string, any>,
  TResources extends Record<string, Resource<unknown>> = Record<
    string,
    Resource<unknown>
  >,
> {
  path: TPath;
  id: TId;
  fullPath?: string;
  validateQueryParams?: (raw: Record<string, unknown>) => TQueryParams;
  resolve?: TResolve;
  resources?: (
    ctx: FacadeResourceContext<
      RouteParamsFor<TParentRoute, TPath>,
      TQueryParams
    >,
  ) => TResources | Promise<TResources>;
  component?: Type<unknown>;
  loadComponent?: RouteComponentLoader;
  title?: string | ResolveFn<string>;
  canActivate?: CanActivateFn[] | DeprecatedGuard[];
  canActivateChild?: CanActivateChildFn[];
  canDeactivate?: CanDeactivateFn<unknown>[];
  canMatch?: CanMatchFn[];
  data?: Record<string, unknown>;
  providers?: any[];
  runGuardsAndResolvers?: RunGuardsAndResolvers;
  redirectTo?: string;
  pathMatch?: Route['pathMatch'];
  meta?: MetaTag[] | ResolveFn<MetaTag[]>;
  types?: {
    path: TPath;
    id: TId;
    parentRoute?: TParentRoute;
    params: RouteParamsFor<TParentRoute, TPath>;
    queryParams: TQueryParams;
    data: ExtractResolvedData<TResolve>;
    resources: TResources;
  };
}

/**
 * Builder returned by createFileRoute(path), callable as a curried function
 * returning a FileRouteDefinition.
 */
export interface FileRouteBuilder<
  TPath extends string = string,
  TId extends string = string,
  TParentRoute = unknown,
  TQueryParams = unknown,
  TResolve extends Record<string, any> = Record<string, any>,
  TResources extends Record<string, Resource<unknown>> = Record<
    string,
    Resource<unknown>
  >,
> {
  <
    TOptResolve extends Record<string, any> = TResolve,
    TOptQueryParams = TQueryParams,
    TOptResources extends Record<string, Resource<unknown>> = TResources,
  >(
    options?: FileRouteOptions<
      TPath,
      TOptResolve,
      TOptQueryParams,
      TOptResources,
      RouteParamsFor<TParentRoute, TPath>
    >,
  ): FileRouteDefinition<
    TPath,
    TId,
    TParentRoute,
    TOptQueryParams,
    TOptResolve,
    TOptResources
  >;
}
