export type AuthErrorCode = "INVALID_CREDENTIALS"

export class AuthError extends Error {
  readonly code: AuthErrorCode

  constructor(code: AuthErrorCode) {
    super(code)
    this.code = code
    this.name = "AuthError"
  }
}

export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError
}
