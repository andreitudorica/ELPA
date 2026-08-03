import { type FieldPath, type FieldValues, type UseFormSetError } from 'react-hook-form';

import { ApiError } from '@/lib/api/errors';

/**
 * Maps server-side validation errors (ApiError.fieldErrors) onto React Hook
 * Form fields. Unknown field names land on `root.server` so nothing is lost.
 * Returns true when the error was a validation error and has been applied.
 */
export function applyServerErrors<TFieldValues extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<TFieldValues>,
  knownFields: readonly FieldPath<TFieldValues>[],
): boolean {
  if (!(error instanceof ApiError) || error.fieldErrors === undefined) {
    return false;
  }

  let applied = false;
  for (const [field, messages] of Object.entries(error.fieldErrors)) {
    const message = messages[0];
    if (message === undefined) {
      continue;
    }
    if ((knownFields as readonly string[]).includes(field)) {
      setError(field as FieldPath<TFieldValues>, { type: 'server', message });
    } else {
      setError('root.server', { type: 'server', message });
    }
    applied = true;
  }
  return applied;
}
