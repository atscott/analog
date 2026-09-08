import { describe, expectTypeOf, it } from 'vitest';
import type { ParseParams, EmptyObject } from '../../src/lib/types/params';

describe('Parameter Inference Engine (ParseParams)', () => {
  describe('Path Parameter Parser (ParseParams)', () => {
    it('should parse single and multiple colon-style parameters', () => {
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

    it('should parse bracket-style parameters ([param])', () => {
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

    it('should parse optional catch-all parameters ([[...param]])', () => {
      expectTypeOf<ParseParams<'/blog/[[...slug]]'>>().toEqualTypeOf<{
        slug?: string;
      }>();
    });

    it('should parse catch-all routes [...slug] and return empty object for wildcard (**)', () => {
      expectTypeOf<ParseParams<'/docs/**'>>().toEqualTypeOf<EmptyObject>();
      expectTypeOf<ParseParams<'/blog/[...slug]'>>().toEqualTypeOf<{
        slug: string;
      }>();
    });

    it('should return empty object type for static-only paths', () => {
      expectTypeOf<
        ParseParams<'/dashboard/settings/profile'>
      >().toEqualTypeOf<EmptyObject>();
      expectTypeOf<ParseParams<'/about'>>().toEqualTypeOf<EmptyObject>();
    });
  });

  describe('Boundary & Corner Cases', () => {
    it('should handle empty strings and bare root slashes', () => {
      expectTypeOf<ParseParams<''>>().toEqualTypeOf<EmptyObject>();
      expectTypeOf<ParseParams<'/'>>().toEqualTypeOf<EmptyObject>();
    });

    it('should normalize redundant multiple slashes and trailing slashes', () => {
      expectTypeOf<ParseParams<'///users///:userId///'>>().toEqualTypeOf<{
        userId: string;
      }>();
      expectTypeOf<ParseParams<'/store/:storeId/'>>().toEqualTypeOf<{
        storeId: string;
      }>();
    });

    it('should support hyphenated and underscore parameter names', () => {
      expectTypeOf<
        ParseParams<'/items/:item-id/tags/:tag_name'>
      >().toEqualTypeOf<{
        'item-id': string;
        tag_name: string;
      }>();
    });

    it('should deduplicate repeated parameter names in the same route path', () => {
      expectTypeOf<ParseParams<'/:id/revisions/:id'>>().toEqualTypeOf<{
        id: string;
      }>();
    });

    it('should reject non-string assignments to parsed parameter fields', () => {
      type Params = ParseParams<'/users/:userId'>;
      const valid: Params = { userId: '123' };
      expectTypeOf(valid).toEqualTypeOf<Params>();

      // @ts-expect-error - number cannot be assigned to string parameter
      const invalid: Params = { userId: 123 };
    });
  });
});
