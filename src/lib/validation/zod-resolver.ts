import type {
  FieldError,
  FieldErrors,
  FieldValues,
  Resolver,
} from "react-hook-form";
import type { ZodIssue, ZodType } from "zod";

type Translator = (
  key: string,
  params?: Record<string, string | number | Date>
) => string;

/** Extract min/max numbers zod reports on `too_small`/`too_big` issues. */
function issueParams(
  issue: ZodIssue
): Record<string, string | number | Date> | undefined {
  const params: Record<string, string | number | Date> = {};
  const candidate = issue as ZodIssue & { minimum?: number; maximum?: number };
  if (typeof candidate.minimum === "number") params.min = candidate.minimum;
  if (typeof candidate.maximum === "number") params.max = candidate.maximum;
  return Object.keys(params).length > 0 ? params : undefined;
}

/**
 * Build a react-hook-form resolver from a Zod schema whose error messages are
 * i18n keys. The caller injects the `validation` translator, so messages are
 * resolved in the active locale while the schema stays pure.
 */
export function createAuthResolver<T extends FieldValues>(
  schema: ZodType<T>,
  translate: Translator
): Resolver<T> {
  return async (values: unknown) => {
    const result = schema.safeParse(values);
    if (result.success) {
      return { values: result.data, errors: {} };
    }

    const errors = {} as Record<string, FieldError>;
    for (const issue of result.error.issues) {
      const path = issue.path.join(".") || "root";
      if (errors[path]) continue;
      errors[path] = {
        type: issue.code,
        message: translate(
          issue.message || "validation.invalidValue",
          issueParams(issue)
        ),
      };
    }

    return { values: {}, errors: errors as FieldErrors<T> };
  };
}
