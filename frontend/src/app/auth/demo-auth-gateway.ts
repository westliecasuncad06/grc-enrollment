import type {
  DemoAuthGateway,
  DemoSession,
  DemoUser,
} from "@/app/auth/demo-auth-types"

export type DemoAuthErrorCode =
  "INVALID_DEMO_CREDENTIALS" | "DEMO_AUTH_DISABLED"

export const invalidDemoCredentialsMessage =
  "The demo credentials were not recognized."

const authErrorMessages: Record<DemoAuthErrorCode, string> = {
  INVALID_DEMO_CREDENTIALS: invalidDemoCredentialsMessage,
  DEMO_AUTH_DISABLED: "Demo portal access is unavailable in this environment.",
}

export class DemoAuthError extends Error {
  readonly code: DemoAuthErrorCode

  constructor(code: DemoAuthErrorCode) {
    super(authErrorMessages[code])
    this.name = "DemoAuthError"
    this.code = code
  }
}

function createSession(user: DemoUser): DemoSession {
  return {
    schemaVersion: "demo-v1",
    userId: user.id,
    displayName: user.displayName,
    role: user.role,
    signedInAt: new Date().toISOString(),
  }
}

export function createDemoAuthGateway(
  users: readonly DemoUser[],
): DemoAuthGateway {
  return {
    signIn(credentials) {
      const normalizedEmail = credentials.email.trim().toLowerCase()
      const user = users.find(
        (candidate) =>
          candidate.email === normalizedEmail &&
          candidate.password === credentials.password,
      )

      if (!user) {
        return Promise.reject(new DemoAuthError("INVALID_DEMO_CREDENTIALS"))
      }

      return Promise.resolve(createSession(user))
    },
  }
}

export function createDisabledAuthGateway(): DemoAuthGateway {
  return {
    signIn() {
      return Promise.reject(new DemoAuthError("DEMO_AUTH_DISABLED"))
    },
  }
}
