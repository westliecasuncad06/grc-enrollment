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
}

export interface DemoSessionStore {
  clear(): void
  read(): DemoSession | null
  write(session: DemoSession): void
}
