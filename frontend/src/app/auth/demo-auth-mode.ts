/**
 * - `api`      — real Laravel/Sanctum authentication. The default everywhere.
 * - `demo`     — UI-only fixtures, for working on the interface without a
 *                running backend. Local development and test builds only.
 * - `disabled` — no sign-in is possible.
 */
export type AuthMode = "api" | "demo" | "disabled"

export interface AuthModeEnvironment {
  requestedMode: string | undefined
  mode: string
}

export function selectAuthMode({
  requestedMode,
  mode,
}: AuthModeEnvironment): AuthMode {
  const isLocalRuntime = mode === "development" || mode === "test"

  // Demo fixtures are committed to the repository, so they must never be an
  // accepted credential in a production build.
  if (requestedMode === "demo") {
    return isLocalRuntime ? "demo" : "disabled"
  }

  if (requestedMode === "disabled") {
    return "disabled"
  }

  return "api"
}

export function getAuthMode(): AuthMode {
  return selectAuthMode({
    requestedMode: import.meta.env.VITE_AUTH_MODE,
    mode: import.meta.env.MODE,
  })
}
