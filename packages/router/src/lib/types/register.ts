import type { NonUndefined, ParseParams } from './params';

/**
 * Permissive fallback Route type for unaugmented applications.
 */
export type AnyRoute = {
  path?: string;
  id?: string;
  fullPath?: string;
  types?: {
    params?: any;
    queryParams?: any;
    data?: any;
  };
};

/**
 * Utility type to check if a type is `any`.
 */
export type IsAny<T> = 0 extends 1 & T ? true : false;

/**
 * Checks whether a given route type represents an unconstrained route
 * (such as `AnyRoute` or `any`).
 */
export type IsAnyRoute<T> =
  IsAny<T> extends true
    ? true
    : [T] extends [AnyRoute]
      ? IsAny<
          T extends { types?: { params?: infer P } } ? P : never
        > extends true
        ? true
        : false
      : false;

/**
 * Global Declaration Merging Registry.
 *
 * Consumer applications or code generators augment this interface:
 *
 * ```typescript
 * declare module '@analogjs/router' {
 *   interface Register {
 *     navigationMap: {
 *       '/users/:userId': UserRoute;
 *       '/posts': PostRoute;
 *     };
 *   }
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-empty-interface
export interface Register {
  // Augmented via declaration merging by applications and file generators.
}

/**
 * Interface augmented via declaration merging by generated routeTree.gen.ts.
 * Maps file path/ID literals to their structural route definitions.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-empty-interface
export interface FileRoutesByPath {
  // Augmented via declaration merging by generated routeTree.gen.ts
}

/**
 * Automatically maps FileRoutesByPath entries by their clean `fullPath`.
 * Used for O(1) compile-time destination route lookup in injectNavigate() and [typedRouterLink].
 */
export type FileRoutesByFullPath<TRoutes = FileRoutesByPath> = {
  [K in keyof TRoutes as TRoutes[K] extends {
    fullPath: infer TFullPath extends string;
  }
    ? TFullPath
    : never]: TRoutes[K] extends { route: infer TRoute } ? TRoute : TRoutes[K];
};

/**
 * Resolves the navigation map from Register.
 * Follows a 3-tier resolution hierarchy:
 * 1. Explicit `navigationMap` defined in `Register`.
 * 2. Inferred from augmented `FileRoutesByPath` via `FileRoutesByFullPath`.
 * 3. Permissive fallback to `Record<string, AnyRoute>`.
 */
export type RegisteredNavigationMap<TRegister = Register> = TRegister extends {
  navigationMap: infer TRouteMap;
}
  ? [TRouteMap] extends [never]
    ? [keyof FileRoutesByPath] extends [never]
      ? Record<string, AnyRoute>
      : FileRoutesByFullPath
    : TRouteMap
  : [keyof FileRoutesByPath] extends [never]
    ? Record<string, AnyRoute>
    : FileRoutesByFullPath;

/**
 * Extracts all navigable path literal keys from a route map.
 * Constrained by Record<string, any> to allow TypeScript interfaces without
 * explicit index signatures to satisfy the constraint without TS2344.
 */
export type AllPaths<
  TRouteMap extends Record<string, any> = RegisteredNavigationMap,
> = keyof TRouteMap;

/**
 * Extracts route parameters from a RouteDefinition or route carrier type.
 */
export type RouteParams<T = any> = T extends {
  types?: { params?: infer TParams };
}
  ? [NonUndefined<TParams>] extends [never]
    ? T extends { fullPath: infer TFullPath extends string }
      ? ParseParams<TFullPath>
      : T extends { path: infer TPath extends string }
        ? ParseParams<TPath>
        : { [K in never]: never }
    : [NonUndefined<TParams>] extends [unknown]
      ? unknown extends NonUndefined<TParams>
        ? T extends { fullPath: infer TFullPath extends string }
          ? ParseParams<TFullPath>
          : T extends { path: infer TPath extends string }
            ? ParseParams<TPath>
            : { [K in never]: never }
        : NonUndefined<TParams>
      : NonUndefined<TParams>
  : T extends { fullPath: infer TFullPath extends string }
    ? ParseParams<TFullPath>
    : T extends { path: infer TPath extends string }
      ? ParseParams<TPath>
      : { [K in never]: never };

/**
 * Resolves parameters for a given path in a route map.
 * Accepts any object mapping path keys to routes (including TypeScript interfaces).
 * Distributes over TPath to support union paths cleanly.
 */
export type ResolveParamsForPath<
  TRouteMap extends Record<string, any>,
  TPath extends string,
> = TPath extends keyof TRouteMap
  ? TPath extends any
    ? IsAnyRoute<TRouteMap[TPath]> extends true
      ? Record<string, any>
      : RouteParams<TRouteMap[TPath]>
    : never
  : Record<string, any>;

/**
 * Resolves parameters for a given path in the route map.
 * Safely discriminates AnyRoute using IsAnyRoute to preserve strict parameter types
 * for concrete routes while permitting Record<string, any> for unaugmented applications.
 * Distributes over TPath to support union paths cleanly.
 *
 * Constrained with `Record<string, any>` to ensure TypeScript interfaces without
 * implicit string index signatures satisfy the generic constraint without TS2344
 * and correctly branch into ResolveParamsForPath rather than degrading to Record<string, any>.
 *
 * Supports both:
 * - `ParamsForPath<TPath, TRouteMap>` (defaulting TRouteMap to RegisteredNavigationMap)
 * - `ParamsForPath<TRouteMap, TPath>`
 */
export type ParamsForPath<
  T1 extends string | Record<string, any>,
  T2 = T1 extends string ? RegisteredNavigationMap : never,
> = [T1] extends [Record<string, any>]
  ? [T2] extends [string]
    ? ResolveParamsForPath<T1, T2>
    : Record<string, any>
  : [T1] extends [string]
    ? [T2] extends [Record<string, any>]
      ? ResolveParamsForPath<T2, T1>
      : Record<string, any>
    : Record<string, any>;
