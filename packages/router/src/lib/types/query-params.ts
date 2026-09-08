/**
 * Standard Schema v1 specification and Query Parameters validation types.
 *
 * Fully compliant with @standard-schema/spec v1 (Zod v3.24+, Valibot v1.0+, ArkType v2.0+).
 */

/**
 * Standard Schema v1 interface.
 */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly '~standard': StandardSchemaV1.Props<Input, Output>;
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace StandardSchemaV1 {
  export interface Props<Input = unknown, Output = Input> {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (
      value: unknown,
    ) => Result<Output> | Promise<Result<Output>>;
    readonly types?: Types<Input, Output> | undefined;
  }

  export type Result<Output> = SuccessResult<Output> | FailureResult;

  export interface SuccessResult<Output> {
    readonly value: Output;
    readonly issues?: undefined;
  }

  export interface FailureResult {
    readonly issues: ReadonlyArray<Issue>;
  }

  export interface Issue {
    readonly message: string;
    readonly path?: ReadonlyArray<PropertyKey | PathSegment> | undefined;
  }

  export interface PathSegment {
    readonly key: PropertyKey;
  }

  export interface Types<Input = unknown, Output = Input> {
    readonly input: Input;
    readonly output: Output;
  }

  export type InferInput<Schema extends StandardSchemaV1<any, any>> =
    NonNullable<Schema['~standard']['types']>['input'];

  export type InferOutput<Schema extends StandardSchemaV1<any, any>> =
    NonNullable<Schema['~standard']['types']>['output'];
}

export type AnyStandardSchema = StandardSchemaV1<any, any>;

/**
 * Custom query param validator function interface.
 */
export type QueryParamValidatorFn<TInput = any, TOutput = any> = (
  input: TInput,
) => TOutput;

/**
 * Validator object with parse method (legacy schema adapters).
 */
export interface QueryParamValidatorObj<TInput = any, TOutput = any> {
  parse: (input: TInput) => TOutput;
}

/**
 * Any valid query param schema or validator accepted by route definitions.
 */
export type QueryParamValidator<TInput = any, TOutput = any> =
  | StandardSchemaV1<TInput, TOutput>
  | QueryParamValidatorFn<TInput, TOutput>
  | QueryParamValidatorObj<TInput, TOutput>;

export type AnyQueryParamValidator = QueryParamValidator<any, any>;

type IsWildcardRecord<T> = string extends keyof T ? true : false;

/**
 * Resolves the acceptable input type for navigation query parameter options.
 */
export type ResolveQueryParamsInput<TValidator> = unknown extends TValidator
  ? unknown
  : [TValidator] extends [undefined]
    ? unknown
    : [TValidator] extends [never]
      ? unknown
      : TValidator extends StandardSchemaV1<infer TInput, any>
        ? TInput
        : TValidator extends { parse: (input: infer TInput) => any }
          ? TInput
          : TValidator extends (...args: infer TArgs) => infer TOutput
            ? TArgs extends [infer TInput, ...any[]]
              ? IsWildcardRecord<TInput> extends true
                ? TOutput
                : TInput
              : TOutput
            : Record<string, unknown>;

/**
 * Resolves the output type produced after query parameter validation.
 */
export type ResolveQueryParamsOutput<TValidator> = unknown extends TValidator
  ? unknown
  : [TValidator] extends [undefined]
    ? unknown
    : [TValidator] extends [never]
      ? unknown
      : TValidator extends StandardSchemaV1<any, infer TOutput>
        ? TOutput
        : TValidator extends { parse: (input: any) => infer TOutput }
          ? TOutput
          : TValidator extends (...args: any[]) => infer TOutput
            ? TOutput
            : Record<string, unknown>;

/**
 * Extracts validated query parameters from a route definition or carrier type.
 */
export type InferRouteQueryParams<TRoute> = TRoute extends {
  types: { queryParams: infer TQueryParams };
}
  ? TQueryParams
  : TRoute extends { validateQueryParams?: (raw: any) => infer TQueryParams }
    ? TQueryParams
    : TRoute extends { types: { search: infer TSearch } }
      ? TSearch
      : TRoute extends { validateSearch?: (raw: any) => infer TSearch }
        ? TSearch
        : unknown;

/**
 * Extracts query param input schema from a route carrier type.
 */
export type InferRouteQueryParamsInput<TRoute> = TRoute extends {
  types: { queryParamsInput: infer TInput };
}
  ? TInput
  : TRoute extends { validateQueryParams?: infer V }
    ? ResolveQueryParamsInput<V>
    : TRoute extends { validateSearch?: infer V }
      ? ResolveQueryParamsInput<V>
      : InferRouteQueryParams<TRoute>;

/**
 * Type guard for Standard Schema v1 compliance.
 * Accepts both schema objects and callable schema functions (e.g. ArkType).
 */
export function isStandardSchema(
  validator: unknown,
): validator is StandardSchemaV1 {
  return (
    (typeof validator === 'object' || typeof validator === 'function') &&
    validator !== null &&
    '~standard' in validator &&
    typeof (validator as any)['~standard'] === 'object' &&
    (validator as any)['~standard'] !== null &&
    typeof (validator as any)['~standard'].validate === 'function'
  );
}

/**
 * Validates raw query parameters using either a Standard Schema or a custom validator function.
 * Throws an Error with descriptive issues if validation fails.
 */
export function parseQueryParamsWith<TOutput>(
  validator: QueryParamValidator<any, TOutput> | undefined,
  raw: Record<string, unknown>,
): TOutput {
  if (!validator) {
    return raw as unknown as TOutput;
  }

  // 1. Standard Schema v1 (evaluated first to capture callable schemas like ArkType)
  if (isStandardSchema(validator)) {
    const result = validator['~standard'].validate(raw);
    // Zone.js Promise duck-typing: ZoneAwarePromise does not satisfy instanceof Promise
    if (
      result != null &&
      (typeof (result as any).then === 'function' || result instanceof Promise)
    ) {
      throw new TypeError(
        'Async query parameter validation is not supported synchronously. Query param validators must be synchronous.',
      );
    }
    if (result.issues && result.issues.length > 0) {
      const messages = result.issues.map((i) => i.message).join(', ');
      throw new Error(`Query param validation failed: ${messages}`);
    }
    return (result as StandardSchemaV1.SuccessResult<TOutput>).value;
  }

  // 2. Custom validator functions
  if (typeof validator === 'function') {
    return validator(raw);
  }

  // 3. Legacy validator objects with .parse()
  if (typeof (validator as any).parse === 'function') {
    return (validator as any).parse(raw);
  }

  return raw as unknown as TOutput;
}

/**
 * Normalizes any query param validator into a standard validation function.
 */
export function normalizeQueryParamsValidator<TOutput>(
  validator: QueryParamValidator<any, TOutput> | undefined,
): ((raw: Record<string, unknown>) => TOutput) | undefined {
  if (!validator) {
    return undefined;
  }
  return (raw: Record<string, unknown>) => parseQueryParamsWith(validator, raw);
}
