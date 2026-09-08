import { describe, expectTypeOf, it } from 'vitest';
import type { Signal, Type } from '@angular/core';

import {
  createFileRoute,
  type FileRoute,
} from '../../src/lib/facade/file-route';
import type {
  FileRoutesByPath,
  FileRoutesByFullPath,
  FileRoutesById,
  RegisteredNavigationMap,
  RegisteredRouteMap,
  Register,
  AnyRoute,
} from '../../src/lib/types/register';
import type {
  FileRouteDefinition,
  FileRouteBuilder,
  FileRouteOptions,
  IsFileRoutesAugmented,
  FileRouteParentRoute,
} from '../../src/lib/types/file-routes';
import type { EmptyObject, ParseParams } from '../../src/lib/types/params';

class DummyComponent {}

describe('File-Based Routing Type Engine (Milestone 5)', () => {
  describe('Tier 1: Feature 19 — createFileRoute Facade & Inference', () => {
    it('T1-F19-01: should infer single path parameter from createFileRoute', () => {
      const route = createFileRoute('/users/:userId')({
        component: DummyComponent,
      });

      expectTypeOf(route.path).toEqualTypeOf<'/users/:userId'>();
      expectTypeOf(route.types!.params).toEqualTypeOf<{ userId: string }>();
    });

    it('T1-F19-02: should infer bracket parameters [id] and colon parameters :id', () => {
      const bracketRoute = createFileRoute('/posts/[postId]')({
        component: DummyComponent,
      });

      const colonRoute = createFileRoute('/items/:itemId')({
        component: DummyComponent,
      });

      expectTypeOf(bracketRoute.types!.params).toEqualTypeOf<{
        postId: string;
      }>();
      expectTypeOf(colonRoute.types!.params).toEqualTypeOf<{
        itemId: string;
      }>();
    });

    it('T1-F19-03: should infer multiple nested path parameters', () => {
      const nestedRoute = createFileRoute(
        '/orgs/:orgId/teams/:teamId/members/:memberId',
      )({
        component: DummyComponent,
      });

      expectTypeOf(nestedRoute.types!.params).toEqualTypeOf<{
        orgId: string;
        teamId: string;
        memberId: string;
      }>();
    });

    it('T1-F19-04: should infer wildcard and catch-all routes [...slug] and **', () => {
      const catchAllRoute = createFileRoute('/blog/[...slug]')({
        component: DummyComponent,
      });

      const wildcardRoute = createFileRoute('/docs/**')({
        component: DummyComponent,
      });

      const optCatchAllRoute = createFileRoute('/blog/[[...slug]]')({
        component: DummyComponent,
      });

      expectTypeOf(catchAllRoute.types!.params).toEqualTypeOf<EmptyObject>();
      expectTypeOf(wildcardRoute.types!.params).toEqualTypeOf<EmptyObject>();
      expectTypeOf(optCatchAllRoute.types!.params).toEqualTypeOf<{
        slug?: string;
      }>();
    });

    it('T1-F19-05: should infer validated query parameters', () => {
      interface SearchFilter {
        query: string;
        page: number;
        sort?: 'asc' | 'desc';
      }

      const routeWithQueryParams = createFileRoute('/products')({
        validateQueryParams: (raw: Record<string, unknown>): SearchFilter => ({
          query: String(raw['query'] ?? ''),
          page: Number(raw['page'] ?? 1),
          sort: raw['sort'] === 'desc' ? 'desc' : 'asc',
        }),
      });

      expectTypeOf(
        routeWithQueryParams.types!.queryParams,
      ).toEqualTypeOf<SearchFilter>();
    });

    it('T1-F19-06: should support options object with full type retention', () => {
      interface PageSearch {
        tab: string;
      }

      const builderRoute = createFileRoute('/dashboard')({
        component: DummyComponent,
        validateQueryParams: (raw: Record<string, unknown>): PageSearch => ({
          tab: String(raw['tab'] ?? 'home'),
        }),
        resolve: {
          activeTab: (): string => 'home',
        },
      });

      expectTypeOf(builderRoute.path).toEqualTypeOf<'/dashboard'>();
      expectTypeOf(builderRoute.types!.queryParams).toEqualTypeOf<PageSearch>();
      expectTypeOf(builderRoute.types!.data).toEqualTypeOf<{
        activeTab: string;
      }>();
    });

    it('T1-F19-07: should satisfy RouteMeta compatibility directly', () => {
      const fileRoute = createFileRoute('/about')({
        component: DummyComponent,
      });

      expectTypeOf(fileRoute).toMatchTypeOf<
        import('../../src/lib/models').RouteMeta
      >();
    });
  });

  describe('Tier 2: Feature 19 — Type Safety & Context Validation', () => {
    it('T2-F19-01: should infer resources context with typed params and search', () => {
      interface SearchFilter {
        query: string;
      }

      createFileRoute('/users/:userId')({
        validateQueryParams: (): SearchFilter => ({ query: 'test' }),
        resources: (ctx) => {
          expectTypeOf(ctx.params).toEqualTypeOf<Signal<{ userId: string }>>();
          expectTypeOf(ctx.queryParams).toEqualTypeOf<Signal<SearchFilter>>();
          return {};
        },
      });
    });

    it('T2-F19-02: should reject invalid search property access with @ts-expect-error', () => {
      interface StrictSearch {
        page: number;
      }

      createFileRoute('/users')({
        validateQueryParams: (): StrictSearch => ({
          page: 1,
          // @ts-expect-error - 'nonExistent' is not part of StrictSearch
          nonExistent: true,
        }),
      });
    });
  });

  describe('Tier 1: Feature 20 — Declaration Merging & 3-Tier Resolution', () => {
    it('T1-F20-01: should map FileRoutesByFullPath and FileRoutesById on fixture routes', () => {
      type RootRoute = FileRouteDefinition<'/', '__root__'>;
      type UsersRoute = FileRouteDefinition<'/users', '/users', RootRoute>;
      type UserDetailRoute = FileRouteDefinition<
        ':id',
        '/users/:id',
        UsersRoute
      >;

      interface FixtureFileRoutes {
        '/': {
          id: '/';
          path: '/';
          fullPath: '/';
          route: RootRoute;
          parentRoute: RootRoute;
        };
        '/users': {
          id: '/users';
          path: '/users';
          fullPath: '/users';
          route: UsersRoute;
          parentRoute: RootRoute;
        };
        '/users/:id': {
          id: '/users/:id';
          path: ':id';
          fullPath: '/users/:id';
          route: UserDetailRoute;
          parentRoute: UsersRoute;
        };
      }

      type NavMap = FileRoutesByFullPath<FixtureFileRoutes>;
      type RouteIdMap = FileRoutesById<FixtureFileRoutes>;

      expectTypeOf<keyof NavMap>().toEqualTypeOf<
        '/' | '/users' | '/users/:id'
      >();
      expectTypeOf<NavMap['/users/:id']>().toEqualTypeOf<UserDetailRoute>();

      expectTypeOf<keyof RouteIdMap>().toEqualTypeOf<
        '/' | '/users' | '/users/:id'
      >();
      expectTypeOf<RouteIdMap['/users/:id']>().toEqualTypeOf<UserDetailRoute>();
    });

    it('T1-F20-02: should verify 3-tier resolution hierarchy in RegisteredNavigationMap', () => {
      // Tier 1: Explicit navigationMap takes absolute precedence
      interface Tier1Register {
        navigationMap: {
          '/explicit': FileRouteDefinition<'/explicit', 'explicit'>;
        };
      }
      type Tier1Map = RegisteredNavigationMap<Tier1Register>;
      expectTypeOf<keyof Tier1Map>().toEqualTypeOf<'/explicit'>();

      // Tier 3: Unaugmented fallback defaults to Record<string, AnyRoute>
      // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-empty-interface
      interface EmptyRegister {}
      type Tier3Map = RegisteredNavigationMap<EmptyRegister>;
      expectTypeOf<Tier3Map>().toEqualTypeOf<Record<string, AnyRoute>>();
    });

    it('T1-F20-03: should resolve parent parameter inheritance through route hierarchy', () => {
      type OrgRouteDef = FileRouteDefinition<
        '/orgs/:orgId',
        '/orgs/:orgId',
        unknown,
        unknown,
        { orgName: string }
      >;

      type TeamRouteDef = FileRouteDefinition<
        'teams/:teamId',
        '/orgs/:orgId/teams/:teamId',
        OrgRouteDef,
        unknown,
        { teamName: string }
      >;

      // Team route receives inherited parent params { orgId: string; teamId: string }
      type InferredParams = NonNullable<TeamRouteDef['types']>['params'];
      expectTypeOf<InferredParams>().toEqualTypeOf<{
        orgId: string;
        teamId: string;
      }>();
    });

    it('T1-F20-04: should fall back to ParseParams<TPath> when FileRoutesByPath is unaugmented', () => {
      type FallbackParams =
        ParseParams<'/categories/:category/products/:productId'>;
      expectTypeOf<FallbackParams>().toEqualTypeOf<{
        category: string;
        productId: string;
      }>();
    });
  });
});
