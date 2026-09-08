/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://analogjs.org/license
 */

import type { RegisteredNavigationMap } from './register';

/**
 * Ensures a path has a leading slash.
 */
export type AddLeadingSlash<T extends string> = T extends `/${string}`
  ? T
  : `/${T}`;

/**
 * Recursively strips trailing slashes from a path.
 */
export type RemoveTrailingSlashes<T extends string> = T extends `${infer R}/`
  ? RemoveTrailingSlashes<R>
  : T;

/**
 * Strips leading slashes from a path.
 */
export type RemoveLeadingSlashes<T extends string> = T extends `/${infer R}`
  ? RemoveLeadingSlashes<R>
  : T;

/**
 * Normalizes a destination path by adding leading slash and stripping trailing slashes.
 * Empty string normalizes to '/'.
 */
export type CleanToPath<T extends string> = T extends ''
  ? '/'
  : AddLeadingSlash<RemoveTrailingSlashes<T>>;

/**
 * Normalizes root variations ('' or '/') to '/'.
 */
export type NormalizeRoot<T extends string> = T extends '' | '/' ? '/' : T;

/**
 * Joins two path segments with a single slash delimiter.
 */
export type JoinPath<
  TLeft extends string,
  TRight extends string,
> = TRight extends ''
  ? TLeft
  : TLeft extends ''
    ? TRight
    : TLeft extends '/'
      ? `/${RemoveLeadingSlashes<TRight>}`
      : `${RemoveTrailingSlashes<TLeft>}/${RemoveLeadingSlashes<TRight>}`;

/**
 * Recursively strips the last path segment from a normalized path.
 */
export type RemoveLastSegment<
  T extends string,
  TAcc extends string = '',
> = T extends `${infer TSegment}/${infer TRest}`
  ? TRest & `${string}/${string}` extends never
    ? TRest extends ''
      ? TAcc
      : `${TAcc}${TSegment}`
    : RemoveLastSegment<TRest, `${TAcc}${TSegment}/`>
  : TAcc;

/**
 * Resolves a current-directory relative path ('.' or './...').
 */
export type ResolveCurrentPath<
  TFrom extends string,
  TTo extends string,
> = TTo extends '.' | './'
  ? CleanToPath<TFrom>
  : TTo extends `./${infer TRest}`
    ? ResolveRelativePath<TFrom, TRest>
    : never;

/**
 * Resolves a parent-directory relative path ('..' or '../...').
 */
export type ResolveParentPath<
  TFrom extends string,
  TTo extends string,
> = TTo extends '..' | '../'
  ? NormalizeRoot<AddLeadingSlash<RemoveLastSegment<CleanToPath<TFrom>>>>
  : TTo extends `../${infer TRest}`
    ? ResolveRelativePath<
        NormalizeRoot<AddLeadingSlash<RemoveLastSegment<CleanToPath<TFrom>>>>,
        TRest
      >
    : AddLeadingSlash<
        JoinPath<
          NormalizeRoot<AddLeadingSlash<RemoveLastSegment<CleanToPath<TFrom>>>>,
          TTo
        >
      >;

/**
 * Resolves relative or absolute navigation destinations against a base 'from' path.
 *
 * Supports:
 * - Absolute paths: '/users', '/posts'
 * - Current directory: '.', './', './posts'
 * - Parent directory: '..', '../', '../settings'
 * - Multi-level parent: '../..', '../../dashboard'
 * - Descendant paths: 'posts', 'posts/:postId'
 */
export type ResolveRelativePath<
  TFrom extends string,
  TTo extends string = '.',
> = string extends TFrom
  ? TTo
  : string extends TTo
    ? TFrom
    : TTo extends `/${string}`
      ? TTo
      : TTo extends '.' | './'
        ? CleanToPath<TFrom>
        : TTo extends `./${infer TRest}`
          ? ResolveRelativePath<TFrom, TRest>
          : TTo extends '..' | '../'
            ? NormalizeRoot<
                AddLeadingSlash<RemoveLastSegment<CleanToPath<TFrom>>>
              >
            : TTo extends `../${infer TRest}`
              ? ResolveRelativePath<
                  NormalizeRoot<
                    AddLeadingSlash<RemoveLastSegment<CleanToPath<TFrom>>>
                  >,
                  TRest
                >
              : AddLeadingSlash<JoinPath<CleanToPath<TFrom>, TTo>>;

/**
 * Infers valid child relative path completions for a given from path.
 */
export type InferChildRelativePaths<
  TFrom extends string,
  TAllPaths extends string,
> = TAllPaths extends `${CleanToPath<TFrom>}/${infer TRest}`
  ? TRest | `./${TRest}`
  : never;

/**
 * Infers valid parent relative path completions for a given from path.
 */
export type InferParentRelativePaths<
  TFrom extends string,
  TAllPaths extends string,
> =
  NormalizeRoot<
    AddLeadingSlash<RemoveLastSegment<CleanToPath<TFrom>>>
  > extends infer TParent extends string
    ? TParent extends '/'
      ? '..' | '../'
      :
          | ('..' | '../')
          | (TAllPaths extends `${TParent}/${infer TSibling}`
              ? `../${TSibling}`
              : never)
    : never;

/**
 * Union of all statically valid navigation targets from a given from path.
 */
export type ValidNavTargets<
  TFrom extends string,
  TNavMap = RegisteredNavigationMap,
  TAllPaths extends string = keyof TNavMap & string,
> = string extends TAllPaths
  ? string
  :
      | TAllPaths
      | '.'
      | './'
      | '..'
      | '../'
      | InferChildRelativePaths<TFrom, TAllPaths>
      | InferParentRelativePaths<TFrom, TAllPaths>;
