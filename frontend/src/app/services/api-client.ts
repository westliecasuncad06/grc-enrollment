import { apiErrorEnvelopeSchema } from "@/app/schemas/api-error-schema"

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000"

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

export async function getJson(
  path: string,
  signal?: AbortSignal,
): Promise<unknown> {
  let response: Response

  try {
    response = await fetch(buildApiUrl(path), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
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

  const payload = await readJson(response)

  if (!response.ok) {
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
