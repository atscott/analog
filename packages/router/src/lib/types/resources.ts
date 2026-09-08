import type { Signal, Resource } from '@angular/core';
import type { EmptyObject } from './params';

/**
 * Unwraps an RxJS Subscribable / Observable to its emitted item type.
 */
export type UnwrapObservable<T> = T extends {
  subscribe(fn: (value: infer V) => any): any;
}
  ? V
  : T;

/**
 * Unwraps a resolve value or resolver function return type (Observable, Promise, or sync value).
 */
export type UnwrapResolve<T> = T extends (...args: any[]) => infer R
  ? R extends { subscribe(fn: (value: infer V) => any): any }
    ? V
    : Awaited<R>
  : T extends { subscribe(fn: (value: infer V) => any): any }
    ? V
    : Awaited<T>;

/**
 * Extracts and unwraps strongly-typed resolved data from an Angular `resolve` map.
 */
export type ExtractResolvedData<TResolve> = 0 extends 1 & TResolve
  ? any
  : [TResolve] extends [never]
    ? EmptyObject
    : [TResolve] extends [undefined]
      ? EmptyObject
      : unknown extends TResolve
        ? EmptyObject
        : {
            [K in keyof TResolve]: UnwrapResolve<TResolve[K]>;
          };

/**
 * Recursively extracts resolved route data from a route definition, route factory, or carrier type.
 */
export type ExtractRouteData<TRoute> = 0 extends 1 & TRoute
  ? any
  : [TRoute] extends [never]
    ? undefined
    : [TRoute] extends [undefined]
      ? undefined
      : TRoute extends () => infer TResolvedRoute
        ? ExtractRouteData<TResolvedRoute>
        : TRoute extends { types?: { data: infer TData } }
          ? TData
          : TRoute extends { resolve?: infer TResolve }
            ? ExtractResolvedData<TResolve>
            : unknown;

/**
 * Extracts route data for a parent route, resolving to undefined if no parent exists,
 * or unknown if parent route type is unknown.
 */
export type ParentData<TParentRoute> = 0 extends 1 & TParentRoute
  ? any
  : [TParentRoute] extends [never]
    ? undefined
    : [TParentRoute] extends [undefined]
      ? undefined
      : unknown extends TParentRoute
        ? unknown
        : ExtractRouteData<TParentRoute>;

/**
 * Extracts inherited ancestor resources for a given parent route.
 */
export type ParentResourcesFor<TParentRoute> = 0 extends 1 & TParentRoute
  ? Record<string, Resource<any>>
  : [TParentRoute] extends [never]
    ? EmptyObject
    : [TParentRoute] extends [undefined]
      ? EmptyObject
      : unknown extends TParentRoute
        ? EmptyObject
        : TParentRoute extends () => infer TResolvedParent
          ? ParentResourcesFor<TResolvedParent>
          : TParentRoute extends { types?: { resources: infer R } }
            ? R extends Record<string, Resource<unknown>>
              ? R
              : EmptyObject
            : TParentRoute extends {
                  resources?: (ctx: any) => infer R | Promise<infer R>;
                }
              ? R extends Record<string, Resource<unknown>>
                ? R
                : EmptyObject
              : EmptyObject;

/**
 * Accumulated resources for a route: ancestor resources merged with route's own resources.
 * Descendant keys override ancestor keys of the same name.
 */
export type RouteResourcesFor<
  TParentRoute,
  TResources extends Record<string, Resource<unknown>> = Record<
    string,
    Resource<unknown>
  >,
> = {
  [K in keyof (Omit<ParentResourcesFor<TParentRoute>, keyof TResources> &
    TResources)]: (Omit<ParentResourcesFor<TParentRoute>, keyof TResources> &
    TResources)[K];
};

/**
 * Strongly typed ResourceContext passed to RouteDefinition.resources.
 */
export interface FacadeResourceContext<
  TParams = Record<string, string>,
  TQueryParams = Record<string, unknown>,
  TParentResources = Record<string, Resource<unknown>>,
> {
  /** Reactive signal of route path parameters. */
  params: Signal<TParams>;

  /** Reactive signal of route query parameters. */
  queryParams: Signal<TQueryParams>;

  /** Reactive signal of route URL fragment. */
  fragment: Signal<string | null>;

  /** Reactive signal of route static and resolved data. */
  data: Signal<Record<string, any>>;

  /** Inherited ancestor resources signal. */
  resources: Signal<TParentResources>;

  /** Matched route configuration object. */
  routeConfig: any;
}
