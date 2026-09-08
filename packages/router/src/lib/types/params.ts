import type { AnyRoute, IsAny, IsAnyRoute } from './register';
export type { IsAny, IsAnyRoute };

/**
 * Clean empty object type equivalent to `{}` without permitting primitive values.
 */
export type EmptyObject = { [K in never]: never };

/**
 * Flattens an intersection of object types into a single clean object type.
 * Ensures Vitest `toEqualTypeOf` and TypeScript hover tooltips show
 * `{ a: string; b: string }` rather than `{ a: string } & { b: string }`.
 */
export type Simplify<T> = { [K in keyof T]: T[K] } & {};

/**
 * Normalizes a route path string by collapsing redundant consecutive slashes (`//` -> `/`)
 * and removing leading and trailing slashes.
 *
 * Examples:
 * - `'///users///:userId///'` -> `'users/:userId'`
 * - `'/store/:storeId/'` -> `'store/:storeId'`
 * - `'/'` -> `''`
 * - `''` -> `''`
 */
export type CleanPath<T extends string> =
  T extends `${infer Pre}//${infer Post}`
    ? CleanPath<`${Pre}/${Post}`>
    : T extends `/${infer Rest}`
      ? CleanPath<Rest>
      : T extends `${infer Rest}/`
        ? CleanPath<Rest>
        : T;

/**
 * Parses a single path segment and extracts parameter definitions into an object type.
 *
 * Supported formats matching Angular Router and Analog file-based conventions:
 * - Colon parameters: `:param` -> `{ [param]: string }`
 * - Bracket parameters (file-based): `[param]` -> `{ [param]: string }`
 * - Optional catch-all (Analog custom matcher): `[[...param]]` -> `{ [param]?: string }`
 * - Wildcards / Catch-alls: `**` and `[...param]` -> `{}` (Angular default matcher does not extract params for wildcards)
 * - Route groups: `(group)` -> `{}` (route groups do not create URL parameters)
 * - Static segments: `dashboard`, `users`, etc. -> `{}`
 */
export type ParseSegment<TSegment extends string> = TSegment extends ''
  ? EmptyObject
  : TSegment extends '**'
    ? EmptyObject
    : TSegment extends `[...${string}]`
      ? EmptyObject
      : TSegment extends `[[...${infer Param}]]`
        ? { [K in Param]?: string }
        : TSegment extends `:${infer Param}`
          ? { [K in Param]: string }
          : TSegment extends `[${infer Param}]`
            ? { [K in Param]: string }
            : EmptyObject;

/**
 * Splits a normalized path by `/` and recursively parses each segment.
 */
export type ParseRawSegments<T extends string> =
  T extends `${infer Head}/${infer Tail}`
    ? ParseSegment<Head> & ParseRawSegments<Tail>
    : ParseSegment<T>;

/**
 * Extracts route parameters from a path string literal based on Angular Router matching.
 *
 * Supports:
 * - Angular colon parameters: `'/users/:userId'` -> `{ userId: string }`
 * - Analog bracket parameters: `'/users/[userId]'` -> `{ userId: string }`
 * - Analog optional catch-all: `'/blog/[[...slug]]'` -> `{ slug?: string }`
 * - Wildcards & catch-alls: `'/docs/**'`, `'/blog/[...slug]'` -> `{}` (no params extracted)
 * - Hyphenated and underscored params: `'/items/:item-id/tags/:tag_name'` -> `{ 'item-id': string; tag_name: string }`
 * - Deduplication: `'/:id/revisions/:id'` -> `{ id: string }`
 * - Static paths, empty strings, and root: `'/about'`, `''`, `'/'` -> `{}`
 */
export type ParseParams<TPath extends string> =
  CleanPath<TPath> extends ''
    ? EmptyObject
    : Simplify<ParseRawSegments<CleanPath<TPath>>>;

/**
 * Extracts route parameter definitions from a parent route.
 * Inspects `Route` brand types, `{ types: { params } }`, `{ type: { params } }`,
 * `{ params }`, or infers directly from `{ path: string }`.
 */
export type ExtractRouteParams<T> = T extends {
  types?: { params: infer TParams };
}
  ? TParams
  : T extends { type?: { params: infer TParams } }
    ? TParams
    : T extends { params: infer TParams }
      ? TParams
      : T extends { path: infer TPath extends string }
        ? ParseParams<TPath>
        : EmptyObject;

/**
 * Calculates accumulated parameters for a child route by combining
 * the inherited parameters of `TParentRoute` with the parsed parameters of `TPath`.
 *
 * Rules:
 * 1. If `TParentRoute` is `undefined` or `never`, returns `ParseParams<TPath>`.
 * 2. If `TParentRoute` is `AnyRoute` (or unspecialized `Route`), returns `Record<string, any> & ParseParams<TPath>`.
 * 3. Otherwise, extracts parent params and merges them with child params, with child
 *    parameters shadowing any conflicting parent keys (`Omit<Parent, ChildKeys> & Child`).
 * 4. The resulting composite type is simplified via `Simplify` to avoid nested intersections.
 */
export type RouteParamsFor<TParentRoute, TPath extends string = string> = [
  TParentRoute,
] extends [never]
  ? ParseParams<TPath>
  : [TParentRoute] extends [undefined]
    ? ParseParams<TPath>
    : IsAnyRoute<TParentRoute> extends true
      ? Simplify<Record<string, any> & ParseParams<TPath>>
      : [unknown] extends [TParentRoute]
        ? ParseParams<TPath>
        : [keyof ExtractRouteParams<TParentRoute>] extends [never]
          ? ParseParams<TPath>
          : Simplify<
              Omit<ExtractRouteParams<TParentRoute>, keyof ParseParams<TPath>> &
                ParseParams<TPath>
            >;
