import { normalizeQueryParamsValidator } from '../types/query-params';
import type { FileRoutesByPath } from '../types/register';
import type {
  FileRouteBuilder,
  FileRouteDefinition,
} from '../types/file-routes';

export type { FileRouteDefinition as FileRoute };

/**
 * Factory for creating a type-safe file-based route definition.
 *
 * Supports curried callable form: `createFileRoute(path)(options)`
 * Returns a plain route definition object compatible with Analog's route loading.
 */
export function createFileRoute<
  TFilePath extends keyof FileRoutesByPath,
  TParentRoute = FileRoutesByPath[TFilePath] extends { parentRoute: infer P }
    ? P
    : unknown,
  TPath extends string = FileRoutesByPath[TFilePath] extends {
    path: infer P extends string;
  }
    ? P
    : TFilePath,
  TId extends string = FileRoutesByPath[TFilePath] extends {
    id: infer I extends string;
  }
    ? I
    : TFilePath,
>(path: TFilePath): FileRouteBuilder<TPath, TId, TParentRoute>;

export function createFileRoute<TPath extends string, TParentRoute = unknown>(
  path: TPath,
): FileRouteBuilder<TPath, TPath, TParentRoute>;

export function createFileRoute(path: string): any {
  const defaultPath = path === '__root__' ? '/' : path;
  const defaultId = path;

  return function fileRouteBuilder(
    options?: any,
  ): FileRouteDefinition<any, any, any, any, any, any> {
    const validator = options?.validateQueryParams;
    const normalized = validator
      ? normalizeQueryParamsValidator(validator)
      : undefined;
    return {
      path: defaultPath,
      id: defaultId,
      ...(options ?? {}),
      ...(normalized ? { validateQueryParams: normalized } : {}),
    };
  };
}
