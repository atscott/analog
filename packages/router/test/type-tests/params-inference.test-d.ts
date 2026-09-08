import { describe, expectTypeOf, it } from 'vitest';
import type {
  ParseParams,
  RouteParamsFor,
  EmptyObject,
} from '../../src/lib/types/params';
import type { AnyRoute } from '../../src/lib/types/register';

type MockParentRoute<
  TParams extends Record<string, unknown> = Record<string, unknown>,
> = {
  types: { params: TParams };
};

describe('Parameter Inference Engine (Tier 1 & Tier 2)', () => {
  describe('Tier 1: Feature 3 — Path Parameter Parser (ParseParams)', () => {
    it('T1-F03-01: should parse single and multiple colon-style parameters', () => {
      expectTypeOf<ParseParams<'/users/:userId'>>().toEqualTypeOf<{
        userId: string;
      }>();

      expectTypeOf<
        ParseParams<'/users/:userId/posts/:postId'>
      >().toEqualTypeOf<{
        userId: string;
        postId: string;
      }>();
    });

    it('T1-F03-02: should parse bracket-style parameters ([param])', () => {
      expectTypeOf<ParseParams<'/users/[userId]'>>().toEqualTypeOf<{
        userId: string;
      }>();

      expectTypeOf<
        ParseParams<'/users/[userId]/posts/[postId]'>
      >().toEqualTypeOf<{
        userId: string;
        postId: string;
      }>();
    });

    it('T1-F03-03: should parse optional catch-all parameters ([[...param]])', () => {
      expectTypeOf<ParseParams<'/blog/[[...slug]]'>>().toEqualTypeOf<{
        slug?: string;
      }>();
    });

    it('T1-F03-04: should return empty object for wildcard and catch-all routes (** and [...slug])', () => {
      expectTypeOf<ParseParams<'/docs/**'>>().toEqualTypeOf<EmptyObject>();
      expectTypeOf<
        ParseParams<'/blog/[...slug]'>
      >().toEqualTypeOf<EmptyObject>();
    });

    it('T1-F03-05: should return empty object type for static-only paths', () => {
      expectTypeOf<
        ParseParams<'/dashboard/settings/profile'>
      >().toEqualTypeOf<EmptyObject>();
      expectTypeOf<ParseParams<'/about'>>().toEqualTypeOf<EmptyObject>();
    });
  });

  describe('Tier 1: Feature 4 — Vertical Param Inheritance (RouteParamsFor)', () => {
    it('T1-F04-01: should inherit single-level parent parameters', () => {
      type ParentRoute = MockParentRoute<{ userId: string }>;
      type ChildParams = RouteParamsFor<ParentRoute, '/posts/:postId'>;

      expectTypeOf<ChildParams>().toEqualTypeOf<{
        userId: string;
        postId: string;
      }>();
    });

    it('T1-F04-02: should accumulate parameters across multi-level ancestor hierarchy', () => {
      type GrandparentRoute = MockParentRoute<{ orgId: string }>;
      type ParentRoute = MockParentRoute<{ orgId: string; teamId: string }>;
      type LeafParams = RouteParamsFor<ParentRoute, '/members/:memberId'>;

      expectTypeOf<LeafParams>().toEqualTypeOf<{
        orgId: string;
        teamId: string;
        memberId: string;
      }>();
    });

    it('T1-F04-03: should preserve ancestor parameters across parameterless intermediate layouts', () => {
      type GrandparentRoute = MockParentRoute<{ orgId: string }>;
      type LayoutRoute = MockParentRoute<{ orgId: string }>;
      type ChildParams = RouteParamsFor<LayoutRoute, '/billing'>;

      expectTypeOf<ChildParams>().toEqualTypeOf<{
        orgId: string;
      }>();
    });

    it('T1-F04-04: should infer child parameters when parent route is static root', () => {
      type RootRoute = MockParentRoute<EmptyObject>;
      type ChildParams = RouteParamsFor<RootRoute, '/profile/:username'>;

      expectTypeOf<ChildParams>().toEqualTypeOf<{
        username: string;
      }>();
    });

    it('T1-F04-05: should preserve parent parameters when child route is static', () => {
      type ParentRoute = MockParentRoute<{ storeId: string }>;
      type ChildParams = RouteParamsFor<ParentRoute, '/checkout'>;

      expectTypeOf<ChildParams>().toEqualTypeOf<{
        storeId: string;
      }>();
    });
  });

  describe('Tier 2: Boundary & Corner Cases (ParseParams & RouteParamsFor)', () => {
    it('T2-F03-01: should handle empty strings and bare root slashes', () => {
      expectTypeOf<ParseParams<''>>().toEqualTypeOf<EmptyObject>();
      expectTypeOf<ParseParams<'/'>>().toEqualTypeOf<EmptyObject>();
    });

    it('T2-F03-02: should normalize redundant multiple slashes and trailing slashes', () => {
      expectTypeOf<ParseParams<'///users///:userId///'>>().toEqualTypeOf<{
        userId: string;
      }>();
      expectTypeOf<ParseParams<'/store/:storeId/'>>().toEqualTypeOf<{
        storeId: string;
      }>();
    });

    it('T2-F03-03: should support hyphenated and underscore parameter names', () => {
      expectTypeOf<
        ParseParams<'/items/:item-id/tags/:tag_name'>
      >().toEqualTypeOf<{
        'item-id': string;
        tag_name: string;
      }>();
    });

    it('T2-F03-04: should deduplicate repeated parameter names in the same route path', () => {
      expectTypeOf<ParseParams<'/:id/revisions/:id'>>().toEqualTypeOf<{
        id: string;
      }>();
    });

    it('T2-F03-05: should reject non-string assignments to parsed parameter fields', () => {
      type Params = ParseParams<'/users/:userId'>;
      const valid: Params = { userId: '123' };
      expectTypeOf(valid).toEqualTypeOf<Params>();

      // @ts-expect-error - number cannot be assigned to string parameter
      const invalid: Params = { userId: 123 };
    });

    it('T2-F04-01: should handle deep 10-level hierarchy parameter accumulation', () => {
      type R1 = MockParentRoute<{ p1: string }>;
      type R2 = MockParentRoute<{ p1: string; p2: string }>;
      type R3 = MockParentRoute<{ p1: string; p2: string; p3: string }>;
      type R4 = MockParentRoute<{
        p1: string;
        p2: string;
        p3: string;
        p4: string;
      }>;
      type R5 = MockParentRoute<{
        p1: string;
        p2: string;
        p3: string;
        p4: string;
        p5: string;
      }>;
      type R6 = MockParentRoute<{
        p1: string;
        p2: string;
        p3: string;
        p4: string;
        p5: string;
        p6: string;
      }>;
      type R7 = MockParentRoute<{
        p1: string;
        p2: string;
        p3: string;
        p4: string;
        p5: string;
        p6: string;
        p7: string;
      }>;
      type R8 = MockParentRoute<{
        p1: string;
        p2: string;
        p3: string;
        p4: string;
        p5: string;
        p6: string;
        p7: string;
        p8: string;
      }>;
      type R9 = MockParentRoute<{
        p1: string;
        p2: string;
        p3: string;
        p4: string;
        p5: string;
        p6: string;
        p7: string;
        p8: string;
        p9: string;
      }>;

      type LeafParams = RouteParamsFor<R9, '/l10/:p10'>;
      expectTypeOf<LeafParams>().toEqualTypeOf<{
        p1: string;
        p2: string;
        p3: string;
        p4: string;
        p5: string;
        p6: string;
        p7: string;
        p8: string;
        p9: string;
        p10: string;
      }>();
    });

    it('T2-F04-02: should deduplicate when child shadows parent parameter name', () => {
      type ParentRoute = MockParentRoute<{ id: string }>;
      type ShadowedParams = RouteParamsFor<ParentRoute, '/sub-entity/:id'>;

      expectTypeOf<ShadowedParams>().toEqualTypeOf<{
        id: string;
      }>();
    });

    it('T2-F04-03: should safely fall back when parent route is undefined or AnyRoute', () => {
      type UnspecifiedParentParams = RouteParamsFor<
        undefined,
        '/items/:itemId'
      >;
      expectTypeOf<UnspecifiedParentParams>().toEqualTypeOf<{
        itemId: string;
      }>();

      type AnyParentParams = RouteParamsFor<AnyRoute, '/items/:itemId'>;
      expectTypeOf<AnyParentParams>().toMatchTypeOf<{
        itemId: string;
      }>();
    });

    it('T2-F04-04: should handle empty path child route inheriting parent params', () => {
      type ParentRoute = MockParentRoute<{ userId: string }>;
      type IndexParams = RouteParamsFor<ParentRoute, ''>;

      expectTypeOf<IndexParams>().toEqualTypeOf<{
        userId: string;
      }>();
    });

    it('T2-F04-05: should reject missing inherited parameters', () => {
      type ParentRoute = MockParentRoute<{ userId: string }>;
      type ChildParams = RouteParamsFor<ParentRoute, '/posts/:postId'>;

      // @ts-expect-error - missing required parent param userId
      const incomplete: ChildParams = { postId: 'post-1' };

      // @ts-expect-error - missing required child param postId
      const missingChild: ChildParams = { userId: 'user-1' };

      const complete: ChildParams = { userId: 'user-1', postId: 'post-1' };
      expectTypeOf(complete).toEqualTypeOf<ChildParams>();
    });
  });
});
