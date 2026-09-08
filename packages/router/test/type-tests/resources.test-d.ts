import { describe, expectTypeOf, it } from 'vitest';
import type { Resource, Signal } from '@angular/core';
import type { Observable } from 'rxjs';
import { of } from 'rxjs';
import { createFileRoute } from '../../src/lib/facade/file-route';
import type {
  ExtractResolvedData,
  ExtractRouteData,
  ParentData,
  ParentResourcesFor,
  RouteResourcesFor,
  FacadeResourceContext,
  UnwrapResolve,
} from '../../src/lib/types/resources';

describe('Router Resources & Data Resolution Type Engine', () => {
  describe('UnwrapResolve Type Utility', () => {
    it('unwraps synchronous values and functions', () => {
      expectTypeOf<UnwrapResolve<() => string>>().toEqualTypeOf<string>();
      expectTypeOf<UnwrapResolve<() => number>>().toEqualTypeOf<number>();
      expectTypeOf<UnwrapResolve<string>>().toEqualTypeOf<string>();
    });

    it('unwraps Promises', () => {
      expectTypeOf<
        UnwrapResolve<() => Promise<{ user: string }>>
      >().toEqualTypeOf<{ user: string }>();
    });

    it('unwraps RxJS Observables', () => {
      expectTypeOf<
        UnwrapResolve<() => Observable<{ id: number }>>
      >().toEqualTypeOf<{ id: number }>();
    });
  });

  describe('ParentData and ExtractRouteData', () => {
    it('extracts resolved data from root route with Promise resolver', () => {
      const rootRoute = createFileRoute('/')({
        resolve: {
          appEnv: () => Promise.resolve('production'),
        },
      });

      expectTypeOf<ParentData<typeof rootRoute>>().toEqualTypeOf<{
        appEnv: string;
      }>();
      expectTypeOf<ExtractRouteData<typeof rootRoute>>().toEqualTypeOf<{
        appEnv: string;
      }>();
    });

    it('extracts resolved data from child route with sync resolver', () => {
      const usersRoute = createFileRoute('/users')({
        resolve: {
          userCount: (): number => 42,
        },
      });

      expectTypeOf<ExtractRouteData<typeof usersRoute>>().toEqualTypeOf<{
        userCount: number;
      }>();
    });

    it('returns undefined for undefined parent route', () => {
      expectTypeOf<ParentData<undefined>>().toEqualTypeOf<undefined>();
    });

    it('returns unknown for unknown parent route', () => {
      expectTypeOf<ParentData<unknown>>().toEqualTypeOf<unknown>();
    });
  });

  describe('Parent-to-Child Resolved Data Inheritance', () => {
    it('chains resolved parent data through route hierarchies', () => {
      const rootRoute = createFileRoute('/')({
        resolve: {
          orgId: () => Promise.resolve('org-42'),
        },
      });

      const teamRoute = createFileRoute('/teams/:teamId')({
        resolve: {
          teamName: (): string => 'Team Analog',
        },
      });

      expectTypeOf<ParentData<typeof rootRoute>>().toEqualTypeOf<{
        orgId: string;
      }>();
      expectTypeOf<ExtractRouteData<typeof teamRoute>>().toEqualTypeOf<{
        teamName: string;
      }>();
    });
  });

  describe('Resource Type Inheritance', () => {
    it('merges parent and child resource types', () => {
      type ParentRes = { userRes: Resource<{ id: string }> };
      type ChildRes = { feedRes: Resource<string[]> };

      type Merged = RouteResourcesFor<
        { types: { resources: ParentRes } },
        ChildRes
      >;
      expectTypeOf<Merged>().toEqualTypeOf<{
        userRes: Resource<{ id: string }>;
        feedRes: Resource<string[]>;
      }>();
    });

    it('allows child resources to override parent resource keys', () => {
      type ParentRes = { sharedRes: Resource<string> };
      type ChildRes = { sharedRes: Resource<number> };

      type Merged = RouteResourcesFor<
        { types: { resources: ParentRes } },
        ChildRes
      >;
      expectTypeOf<Merged>().toEqualTypeOf<{
        sharedRes: Resource<number>;
      }>();
    });

    it('supplies typed inherited resources on FacadeResourceContext', () => {
      type UserResource = Resource<{ name: string }>;
      type Ctx = FacadeResourceContext<
        Record<string, string>,
        Record<string, unknown>,
        { user: UserResource }
      >;
      expectTypeOf<Ctx['resources']>().toEqualTypeOf<
        Signal<{ user: UserResource }>
      >();
    });
  });

  describe('Resolver Return Types: Sync, Promise, Observable, Null, Undefined', () => {
    it('allows synchronous null resolver and infers null', () => {
      const r = createFileRoute('/sync-null')({
        resolve: { val: () => null },
      });
      expectTypeOf<ExtractRouteData<typeof r>>().toEqualTypeOf<{
        val: null;
      }>();
    });

    it('allows synchronous undefined resolver and infers undefined', () => {
      const r = createFileRoute('/sync-undef')({
        resolve: { val: () => undefined },
      });
      expectTypeOf<ExtractRouteData<typeof r>>().toEqualTypeOf<{
        val: undefined;
      }>();
    });

    it('allows asynchronous null resolver and infers null', () => {
      const r = createFileRoute('/async-null')({
        resolve: { val: async () => null },
      });
      expectTypeOf<ExtractRouteData<typeof r>>().toEqualTypeOf<{
        val: null;
      }>();
    });

    it('allows asynchronous undefined resolver and infers undefined', () => {
      const r = createFileRoute('/async-undef')({
        resolve: { val: async () => undefined },
      });
      expectTypeOf<ExtractRouteData<typeof r>>().toEqualTypeOf<{
        val: undefined;
      }>();
    });

    it('allows RxJS Observable resolvers and infers emitted value type', () => {
      const r = createFileRoute('/obs')({
        resolve: { val: () => of({ count: 1 }) },
      });
      expectTypeOf<ExtractRouteData<typeof r>>().toEqualTypeOf<{
        val: { count: number };
      }>();
    });
  });

  describe('Negative Assertions with @ts-expect-error', () => {
    it('strictly rejects non-Resource objects returned from resources', () => {
      createFileRoute('/invalid-resource')({
        // @ts-expect-error - resources function must return Record<string, Resource<unknown>>
        resources: () => ({ notAResource: 123 }),
      });
    });
  });
});
