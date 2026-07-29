import type { FieldValues, Path, UseFormSetError } from "react-hook-form"

import { isApiClientError } from "@/features/services/api-client"

/**
 * Applies Laravel's named validation messages to matching React Hook Form
 * fields. Other API failures remain available to the caller for global UI.
 */
export function applyApiFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
): boolean {
  if (!isApiClientError(error) || error.status !== 422) {
    return false
  }

  for (const [fieldName, messages] of Object.entries(error.fieldErrors ?? {})) {
    const message = messages[0]

    if (message) {
      setError(fieldName as Path<T>, { type: "server", message })
    }
  }

  return true
}
