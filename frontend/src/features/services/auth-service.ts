import {
  authEnvelopeSchema,
  userEnvelopeSchema,
  type AuthenticatedUser,
} from "@/features/schemas/auth-schema"
import {
  ApiClientError,
  type AuthenticatedRequestOptions,
  getAuthenticatedJson,
  postAuthenticatedJson,
  postJson,
} from "@/features/services/api-client"

export const AUTH_LOGIN_PATH = "/api/v1/auth/login"
export const AUTH_LOGOUT_PATH = "/api/v1/auth/logout"
export const AUTH_ME_PATH = "/api/v1/auth/me"

export interface LoginCredentials {
  email: string
  password: string
}

export interface AuthSessionPayload {
  token: string
  expiresAt: string | null
  user: AuthenticatedUser
}

function contractError(cause: unknown): ApiClientError {
  return new ApiClientError({
    kind: "contract",
    message:
      "The API responded, but its authentication payload did not match the published v1 contract.",
    cause,
  })
}

export async function login(
  credentials: LoginCredentials,
  signal?: AbortSignal,
): Promise<AuthSessionPayload> {
  const payload = await postJson(AUTH_LOGIN_PATH, credentials, signal)
  const parsed = authEnvelopeSchema.safeParse(payload)

  if (!parsed.success) {
    throw contractError(parsed.error)
  }

  return {
    token: parsed.data.data.token,
    expiresAt: parsed.data.data.expires_at,
    user: parsed.data.data.user,
  }
}

export async function fetchCurrentUser(
  signal?: AbortSignal,
  options?: AuthenticatedRequestOptions,
): Promise<AuthenticatedUser> {
  const payload = await getAuthenticatedJson(AUTH_ME_PATH, signal, options)
  const parsed = userEnvelopeSchema.safeParse(payload)

  if (!parsed.success) {
    throw contractError(parsed.error)
  }

  return parsed.data.data
}

export async function logout(
  signal?: AbortSignal,
  options?: AuthenticatedRequestOptions,
): Promise<void> {
  await postAuthenticatedJson(AUTH_LOGOUT_PATH, undefined, signal, options)
}
