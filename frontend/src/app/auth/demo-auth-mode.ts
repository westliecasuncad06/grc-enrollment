export type AuthMode = "demo" | "disabled"

export interface AuthModeEnvironment {
  requestedMode: string | undefined
  mode: string
}

export function selectAuthMode({
  requestedMode,
  mode,
}: AuthModeEnvironment): AuthMode {
  const isLocalRuntime = mode === "development" || mode === "test"

  return requestedMode === "demo" && isLocalRuntime ? "demo" : "disabled"
}

export function getAuthMode(): AuthMode {
  return selectAuthMode({
    requestedMode: import.meta.env.VITE_AUTH_MODE,
    mode: import.meta.env.MODE,
  })
}
