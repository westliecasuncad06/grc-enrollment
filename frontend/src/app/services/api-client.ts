import { apiErrorEnvelopeSchema } from "@/app/schemas/api-error-schema"

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000"

/**
 * Supplies the bearer token for outgoing requests. Registered once at startup
 * so this module never imports the token store directly, keeping
 * `auth-token.ts` the single owner of token storage (PRD §9.1).
 */
type TokenProvider = () => string | null

let provideToken: TokenProvider = () => null

/** Invoked whenever the API rejects a token, so the app can sign the user out. */
type UnauthorizedHandler = () => void

let handleUnauthorized: UnauthorizedHandler = () => undefined

export function setAuthTokenProvider(provider: TokenProvider): void {
  provideToken = provider
}

export function setUnauthorizedHandler(handler: UnauthorizedHandler): void {
  handleUnauthorized = handler
}

export type ApiClientErrorKind =
  "configuration" | "connection" | "contract" | "http"

interface ApiClientErrorOptions {
  kind: ApiClientErrorKind
  message: string
  cause?: unknown
  code?: string
  requestId?: string
  status?: number
}

export class ApiClientError extends Error {
  readonly kind: ApiClientErrorKind
  readonly code?: string
  readonly requestId?: string
  readonly status?: number

  constructor({
    kind,
    message,
    cause,
    code,
    requestId,
    status,
  }: ApiClientErrorOptions) {
    super(message, { cause })
    this.name = "ApiClientError"
    this.kind = kind
    this.code = code
    this.requestId = requestId
    this.status = status
  }
}

export function isApiClientError(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError
}

function buildApiUrl(path: string): string {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim()
  const baseUrl = configuredBaseUrl ?? DEFAULT_API_BASE_URL

  try {
    return new URL(path, baseUrl).toString()
  } catch (cause) {
    throw new ApiClientError({
      kind: "configuration",
      message: "The public API address is not configured correctly.",
      cause,
    })
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown
  } catch (cause) {
    throw new ApiClientError({
      kind: "contract",
      message: "The public API returned a response that was not valid JSON.",
      cause,
      status: response.status,
    })
  }
}

interface RequestOptions {
  authenticated?: boolean
  body?: unknown
  method: "GET" | "POST"
  signal?: AbortSignal
}

async function request(
  path: string,
  { authenticated = false, body, method, signal }: RequestOptions,
): Promise<unknown> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  }

  if (body !== undefined) {
    headers["Content-Type"] = "application/json"
  }

  if (authenticated) {
    const token = provideToken()

    if (token !== null) {
      headers.Authorization = `Bearer ${token}`
    }
  }

  let response: Response

  try {
    response = await fetch(buildApiUrl(path), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "omit",
      cache: "no-store",
      signal,
    })
  } catch (cause) {
    if (cause instanceof Error && cause.name === "AbortError") {
      throw cause
    }

    throw new ApiClientError({
      kind: "connection",
      message:
        "The public enrollment API could not be reached from this browser.",
      cause,
    })
  }

  if (response.status === 204) {
    return null
  }

  const payload = await readJson(response)

  if (!response.ok) {
    // A rejected token must never leave the app in a half-signed-in state.
    // Login itself returns 401 for bad credentials, so it opts out.
    if (response.status === 401 && authenticated) {
      handleUnauthorized()
    }

    const parsedError = apiErrorEnvelopeSchema.safeParse(payload)

    if (parsedError.success) {
      throw new ApiClientError({
        kind: "http",
        message: parsedError.data.error.message,
        code: parsedError.data.error.code,
        requestId: parsedError.data.error.request_id,
        status: response.status,
      })
    }

    throw new ApiClientError({
      kind: "http",
      message: "The public API returned an unexpected error response.",
      status: response.status,
    })
  }

  return payload
}

export function getJson(path: string, signal?: AbortSignal): Promise<unknown> {
  return request(path, { method: "GET", signal })
}

export function getAuthenticatedJson(
  path: string,
  signal?: AbortSignal,
): Promise<unknown> {
  return request(path, { authenticated: true, method: "GET", signal })
}

export function postJson(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<unknown> {
  return request(path, { body, method: "POST", signal })
}

export function postAuthenticatedJson(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<unknown> {
  return request(path, {
    authenticated: true,
    body: body ?? {},
    method: "POST",
    signal,
  })
}
