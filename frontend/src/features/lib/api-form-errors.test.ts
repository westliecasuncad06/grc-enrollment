import type { FieldValues, UseFormSetError } from "react-hook-form"
import { describe, expect, it, vi } from "vitest"

import { applyApiFieldErrors } from "@/features/lib/api-form-errors"
import { ApiClientError } from "@/features/services/api-client"

describe("applyApiFieldErrors", () => {
  it("maps a 422 API validation error to its named React Hook Form field", () => {
    const setError = vi.fn<UseFormSetError<FieldValues>>()
    const validationError = new ApiClientError({
      kind: "http",
      message: "The submitted data is invalid.",
      code: "VALIDATION_FAILED",
      status: 422,
      fieldErrors: {
        email: ["The email has already been taken."],
      },
    })

    expect(applyApiFieldErrors(validationError, setError)).toBe(true)
    expect(setError).toHaveBeenCalledWith(
      "email",
      expect.objectContaining({
        type: "server",
        message: "The email has already been taken.",
      }),
    )
  })

  it("leaves React Hook Form untouched for a non-validation API error", () => {
    const setError = vi.fn<UseFormSetError<FieldValues>>()
    const conflictError = new ApiClientError({
      kind: "http",
      message: "This record has changed.",
      code: "CONFLICT",
      status: 409,
    })

    expect(applyApiFieldErrors(conflictError, setError)).toBe(false)
    expect(setError).not.toHaveBeenCalled()
  })
})
