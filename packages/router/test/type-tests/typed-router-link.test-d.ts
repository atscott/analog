/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://analogjs.org/license
 */

import { describe, it, expectTypeOf } from 'vitest';
import type {
  TypedRouteTo,
  StaticRoutes,
  HasRequiredParams,
} from '../../src/lib/types/router-link';

interface TestLinkNavMap {
  '/': { path: '/' };
  '/about': { path: '/about' };
  '/users/:userId': { path: '/users/:userId' };
  '/posts/:slug': { path: '/posts/:slug' };
  '/search': {
    path: '/search';
    types?: {
      queryParams?: { query: string; page?: number };
    };
  };
}

type TestTypedRouteTo<TTo extends string = string> = TypedRouteTo<
  TTo,
  TestLinkNavMap
>;

declare function testLink(link: TestTypedRouteTo): void;

describe('TypedRouterLink Type System', () => {
  it('identifies static routes correctly', () => {
    expectTypeOf<'/' | '/about'>().toMatchTypeOf<
      StaticRoutes<TestLinkNavMap>
    >();
    expectTypeOf<
      HasRequiredParams<'/users/:userId', TestLinkNavMap>
    >().toEqualTypeOf<true>();
    expectTypeOf<
      HasRequiredParams<'/', TestLinkNavMap>
    >().toEqualTypeOf<false>();
    expectTypeOf<
      HasRequiredParams<'/about', TestLinkNavMap>
    >().toEqualTypeOf<false>();
  });

  it('accepts bare string literals only for static routes', () => {
    const _validHome: TestTypedRouteTo = '/';
    const _validAbout: TestTypedRouteTo = '/about';

    // @ts-expect-error: Parameterized route cannot be used as bare string without params
    const _invalidBareParam: TestTypedRouteTo = '/users/:userId';

    // @ts-expect-error: Non-existent route cannot be used
    const _invalidUnknown: TestTypedRouteTo = '/unknown-path';
  });

  it('accepts relative path strings and options objects', () => {
    const _validBack: TestTypedRouteTo = '..';
    const _validBackSlash: TestTypedRouteTo = '../';
    const _validParentPath: TestTypedRouteTo = '../posts';
    const _validChildPath: TestTypedRouteTo = './details';

    testLink({ to: '..' });
    testLink({ to: '../', queryParams: { tab: 'info' } });
  });

  it('enforces required parameters on composite link objects', () => {
    testLink({
      to: '/users/:userId',
      params: { userId: '123' },
    });

    // @ts-expect-error: Property 'params' is missing
    testLink({
      to: '/users/:userId',
    });

    testLink({
      to: '/users/:userId',
      // @ts-expect-error: Property 'userId' is missing in params
      params: {} as Record<string, never>,
    });

    testLink({
      to: '/users/:userId',
      // @ts-expect-error: Parameter type must be string, not number
      params: { userId: 123 },
    });
  });

  it('enforces queryParams schema input on composite link objects', () => {
    testLink({
      to: '/search',
      queryParams: { query: 'angular', page: 1 },
    });

    testLink({
      to: '/search',
      // @ts-expect-error: Search query must match schema (query is required)
      queryParams: { page: 1 },
    });
  });

  it('supports global RegisteredNavigationMap inference seamlessly', () => {
    // '/posts' is registered as static route in hooks.test-d.ts
    const _validGlobalPosts: TypedRouteTo = '/posts';

    // @ts-expect-error: '/users/:userId' has params in global registry, cannot be bare string
    const _invalidGlobalUser: TypedRouteTo = '/users/:userId';

    // With parameters, '/users/:userId' is valid in global registry
    const _validGlobalUserWithOptions: TypedRouteTo = {
      to: '/users/:userId',
      params: { userId: 'u-123' },
    };
  });
});
