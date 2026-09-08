/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://analogjs.org/license
 */

import { describe, expect, it } from 'vitest';
import {
  isStandardSchema,
  normalizeQueryParamsValidator,
  parseQueryParamsWith,
  type QueryParamValidatorObj,
  type StandardSchemaV1,
} from '../../src/lib/types/query-params';

describe('Runtime Query Params Schema Validation & StandardSchemaV1 Edge Cases', () => {
  it('should parse valid search query via StandardSchemaV1 object', () => {
    const objectSchema: StandardSchemaV1<
      { page?: string; filter?: string },
      { page: number; filter: string }
    > = {
      '~standard': {
        version: 1,
        vendor: 'test-vendor',
        validate: (raw: unknown) => {
          const obj = (raw as Record<string, unknown>) ?? {};
          return {
            value: {
              page: Number(obj.page ?? 1),
              filter: String(obj.filter ?? 'all'),
            },
          };
        },
        types: {
          input: { page: '1' },
          output: { page: 1, filter: 'all' },
        },
      },
    };

    expect(isStandardSchema(objectSchema)).toBe(true);

    const result = parseQueryParamsWith(objectSchema, {
      page: '10',
      filter: 'active',
    });
    expect(result).toEqual({ page: 10, filter: 'active' });
  });

  it('should throw descriptive Error on StandardSchemaV1 validation failure with issues', () => {
    const strictSchema: StandardSchemaV1<{ count: string }, { count: number }> =
      {
        '~standard': {
          version: 1,
          vendor: 'test-vendor',
          validate: (raw: unknown) => {
            const obj = (raw as Record<string, unknown>) ?? {};
            const num = Number(obj.count);
            if (isNaN(num)) {
              return {
                issues: [
                  {
                    message: 'count must be a valid number',
                    path: [{ key: 'count' }],
                  },
                  { message: 'minimum value is 1', path: [{ key: 'count' }] },
                ],
              };
            }
            return { value: { count: num } };
          },
        },
      };

    expect(() =>
      parseQueryParamsWith(strictSchema, { count: 'invalid' }),
    ).toThrow(
      'Query param validation failed: count must be a valid number, minimum value is 1',
    );
  });

  it('should reject async StandardSchema with TypeError under Zone.js via duck typing', () => {
    const asyncSchema: StandardSchemaV1<{ query: string }, { query: string }> =
      {
        '~standard': {
          version: 1,
          vendor: 'async-vendor',
          validate: async (raw: unknown) => {
            const obj = (raw as Record<string, unknown>) ?? {};
            return { value: { query: String(obj.query ?? '') } };
          },
        },
      };

    expect(isStandardSchema(asyncSchema)).toBe(true);

    expect(() =>
      parseQueryParamsWith(asyncSchema, { query: 'analog' }),
    ).toThrow(TypeError);
    expect(() =>
      parseQueryParamsWith(asyncSchema, { query: 'analog' }),
    ).toThrow(
      'Async query parameter validation is not supported synchronously. Query param validators must be synchronous.',
    );
  });

  it('should reject custom thenable objects and classes via duck typing in parseQueryParamsWith', () => {
    // Custom thenable object
    const customThenableSchema: StandardSchemaV1<unknown, unknown> = {
      '~standard': {
        version: 1,
        vendor: 'custom-thenable',
        validate: () =>
          ({
            then(
              onFulfilled: (res: StandardSchemaV1.Result<unknown>) => unknown,
            ) {
              return onFulfilled({ value: { ok: true } });
            },
          }) as unknown as Promise<StandardSchemaV1.Result<unknown>>,
      },
    };

    expect(() => parseQueryParamsWith(customThenableSchema, {})).toThrow(
      TypeError,
    );
    expect(() => parseQueryParamsWith(customThenableSchema, {})).toThrow(
      'Async query parameter validation is not supported synchronously. Query param validators must be synchronous.',
    );

    // Custom thenable class instance
    class CustomPromiseLike {
      then(onFulfilled: (res: StandardSchemaV1.Result<unknown>) => unknown) {
        return onFulfilled({ value: 123 });
      }
    }

    const classThenableSchema: StandardSchemaV1<unknown, unknown> = {
      '~standard': {
        version: 1,
        vendor: 'class-thenable',
        validate: () =>
          new CustomPromiseLike() as unknown as Promise<
            StandardSchemaV1.Result<unknown>
          >,
      },
    };

    expect(() => parseQueryParamsWith(classThenableSchema, {})).toThrow(
      TypeError,
    );

    // Native Promise.resolve()
    const nativePromiseSchema: StandardSchemaV1<unknown, unknown> = {
      '~standard': {
        version: 1,
        vendor: 'native-promise',
        validate: () =>
          Promise.resolve({ value: { done: true } }) as Promise<
            StandardSchemaV1.Result<unknown>
          >,
      },
    };

    expect(() => parseQueryParamsWith(nativePromiseSchema, {})).toThrow(
      TypeError,
    );
  });

  it('should NOT treat non-function "then" properties or nested "then" in value as thenables', () => {
    // Result object has a numeric 'then' property
    const nonFunctionThenSchema: StandardSchemaV1<unknown, unknown> = {
      '~standard': {
        version: 1,
        vendor: 'non-fn-then',
        validate: () =>
          ({
            value: { success: true },
            then: 12345, // Not a function
          }) as unknown as StandardSchemaV1.Result<unknown>,
      },
    };

    const res1 = parseQueryParamsWith(nonFunctionThenSchema, {});
    expect(res1).toEqual({ success: true });

    // Result value contains a function named 'then'
    const valueContainsThenSchema: StandardSchemaV1<unknown, unknown> = {
      '~standard': {
        version: 1,
        vendor: 'value-then',
        validate: () => ({
          value: {
            name: 'action',
            then: () => 'execute',
          },
        }),
      },
    };

    interface ActionWithValue {
      name: string;
      then: () => string;
    }
    const res2 = parseQueryParamsWith<ActionWithValue>(
      valueContainsThenSchema,
      {},
    );
    expect(res2.name).toBe('action');
    expect(typeof res2.then).toBe('function');
  });

  it('should correctly identify and validate callable StandardSchema (ArkType style)', () => {
    interface TestSearchOutput {
      validatedViaStandard: boolean;
      raw: unknown;
    }

    const callableSchema = Object.assign(
      (raw: unknown) => ({ rawFnBypass: true, received: raw }),
      {
        '~standard': {
          version: 1 as const,
          vendor: 'arktype',
          validate: (
            value: unknown,
          ): StandardSchemaV1.Result<TestSearchOutput> => {
            return { value: { validatedViaStandard: true, raw: value } };
          },
        },
      },
    );

    // Callable schemas must be identified as Standard Schema
    expect(isStandardSchema(callableSchema)).toBe(true);

    // parseQueryParamsWith must route through ~standard.validate instead of invoking raw function
    const parsed = parseQueryParamsWith<TestSearchOutput>(callableSchema, {
      test: 123,
    });
    expect(parsed).toEqual({ validatedViaStandard: true, raw: { test: 123 } });
  });

  it('should handle validation failures and transformations in callable Standard Schemas', () => {
    interface FilterOutput {
      page: number;
      filter: string;
    }

    // Callable schema with issue reporting and value coercion
    const callableCoercionSchema = Object.assign(
      (_raw: unknown) => {
        throw new Error('Raw function must not be invoked');
      },
      {
        '~standard': {
          version: 1 as const,
          vendor: 'arktype',
          validate: (raw: unknown): StandardSchemaV1.Result<FilterOutput> => {
            const obj = (raw as Record<string, unknown>) ?? {};
            if (obj['fail']) {
              return {
                issues: [
                  {
                    message: 'invalid search parameter',
                    path: [{ key: 'fail' }],
                  },
                  { message: 'must be positive', path: [{ key: 'fail' }] },
                ],
              };
            }
            return {
              value: {
                page: Number(obj['page'] ?? 1),
                filter: String(obj['filter'] ?? 'all'),
              },
            };
          },
        },
      },
    );

    expect(isStandardSchema(callableCoercionSchema)).toBe(true);

    // Transformation case
    const validResult = parseQueryParamsWith<FilterOutput>(
      callableCoercionSchema,
      {
        page: '5',
        filter: 'pending',
      },
    );
    expect(validResult).toEqual({ page: 5, filter: 'pending' });

    // Issues failure case
    expect(() =>
      parseQueryParamsWith(callableCoercionSchema, { fail: true }),
    ).toThrow(
      'Query param validation failed: invalid search parameter, must be positive',
    );
  });

  it('should reject async callable Standard Schemas with TypeError', () => {
    const asyncCallableSchema = Object.assign((raw: unknown) => raw, {
      '~standard': {
        version: 1 as const,
        vendor: 'arktype',
        validate: async (
          value: unknown,
        ): Promise<StandardSchemaV1.Result<unknown>> => {
          return { value };
        },
      },
    });

    expect(isStandardSchema(asyncCallableSchema)).toBe(true);
    expect(() => parseQueryParamsWith(asyncCallableSchema, {})).toThrow(
      TypeError,
    );
    expect(() => parseQueryParamsWith(asyncCallableSchema, {})).toThrow(
      'Async query parameter validation is not supported synchronously. Query param validators must be synchronous.',
    );
  });

  it('should treat plain functions and functions with malformed ~standard as custom validator functions', () => {
    // 1. Plain validator function without ~standard
    const plainFn = (raw: Record<string, unknown>) => ({
      plain: true,
      count: Number(raw['count'] ?? 0),
    });
    expect(isStandardSchema(plainFn)).toBe(false);
    expect(parseQueryParamsWith(plainFn, { count: '10' })).toEqual({
      plain: true,
      count: 10,
    });

    // 2. Function with ~standard = null
    const fnWithNullStandard = Object.assign(
      (raw: Record<string, unknown>) => ({
        fallback: 'null-standard',
        val: raw,
      }),
      { '~standard': null },
    );
    expect(isStandardSchema(fnWithNullStandard)).toBe(false);
    expect(parseQueryParamsWith(fnWithNullStandard, { key: 'test' })).toEqual({
      fallback: 'null-standard',
      val: { key: 'test' },
    });

    // 3. Function with ~standard as non-object (e.g. string)
    const fnWithStringStandard = Object.assign(
      (raw: Record<string, unknown>) => ({
        fallback: 'string-standard',
        val: raw,
      }),
      { '~standard': 'v1' },
    );
    expect(isStandardSchema(fnWithStringStandard)).toBe(false);
    expect(parseQueryParamsWith(fnWithStringStandard, { key: 'test' })).toEqual(
      {
        fallback: 'string-standard',
        val: { key: 'test' },
      },
    );

    // 4. Function with ~standard object missing validate method
    const fnWithoutValidate = Object.assign(
      (raw: Record<string, unknown>) => ({
        fallback: 'no-validate',
        val: raw,
      }),
      { '~standard': { version: 1, vendor: 'test' } },
    );
    expect(isStandardSchema(fnWithoutValidate)).toBe(false);
    expect(parseQueryParamsWith(fnWithoutValidate, { key: 'test' })).toEqual({
      fallback: 'no-validate',
      val: { key: 'test' },
    });

    // 5. Primitive inputs to isStandardSchema
    expect(isStandardSchema(null)).toBe(false);
    expect(isStandardSchema(undefined)).toBe(false);
    expect(isStandardSchema(123)).toBe(false);
    expect(isStandardSchema('string')).toBe(false);
    expect(isStandardSchema({})).toBe(false);
  });

  it('should execute custom validator function and normalizeQueryParamsValidator wrapper', () => {
    const customFn = (raw: Record<string, unknown>) => ({
      query: String(raw['q'] ?? '').toUpperCase(),
    });

    const normalized = normalizeQueryParamsValidator(customFn);
    expect(normalized).toBeDefined();

    const result = normalized!({ q: 'hello' });
    expect(result).toEqual({ query: 'HELLO' });

    expect(normalizeQueryParamsValidator(undefined)).toBeUndefined();
  });

  it('should support validator objects with .parse() method', () => {
    const objectValidator: QueryParamValidatorObj<
      Record<string, unknown>,
      { timestamp: number }
    > = {
      parse: (raw: Record<string, unknown>) => ({
        timestamp: Number(raw['t'] ?? 0),
      }),
    };

    const result = parseQueryParamsWith(objectValidator, { t: '1600000000' });
    expect(result).toEqual({ timestamp: 1600000000 });
  });
});
