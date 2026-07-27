export const demoRoles = [
  "student",
  "admission_staff",
  "faculty",
  "program_chair",
  "dean",
  "executive_director",
  "registrar_head",
  "registrar_staff",
  "accounting_staff",
] as const

export type DemoRole = (typeof demoRoles)[number]

export interface DemoUser {
  id: string
  displayName: string
  email: string
  password: string
  role: DemoRole
}

export interface DemoSession {
  schemaVersion: "demo-v1"
  userId: string
  displayName: string
  role: DemoRole
  signedInAt: string
}

export interface DemoCredentials {
  email: string
  password: string
}

export interface DemoAuthGateway {
  signIn(credentials: DemoCredentials): Promise<DemoSession>

  /**
   * True when the gateway persists sessions itself (API mode, which stores a
   * bearer token and re-reads the identity from the server). When false the
   * AuthProvider persists the session through its injected session store,
   * which is how demo mode has always worked.
   */
  readonly persistsSessions?: boolean

  /**
   * Rebuilds a session from the gateway's own storage on page load. Only
   * gateways with `persistsSessions: true` implement this.
   */
  restore?(): Promise<DemoSession | null>

  /** Revokes the session server-side. Failures must not block local sign-out. */
  signOut?(): Promise<void>

  /**
   * Reports whether the gateway's own storage actually persisted the last
   * session (e.g. browser storage disabled or full). Only gateways with
   * `persistsSessions: true` implement this; its result drives the same
   * "cannot be restored after refresh" warning that the injected session
   * store's write result drives for demo mode.
   */
  persistenceAvailable?(): boolean
}

export interface DemoSessionStore {
  clear(): void
  read(): DemoSession | null
  write(session: DemoSession): void
}
