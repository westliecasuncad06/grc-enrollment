/// <reference types="node" />

import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

import { demoRoles, demoUsers, sharedDemoPassword } from "@/app/auth/demo-users"

const credentialDocument = readFileSync(
  resolve(process.cwd(), "../docs/testing/DEMO_CREDENTIALS.md"),
  "utf8",
)

const expectedRoles = [
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

describe("demo user fixtures", () => {
  it("provides exactly one identity for every approved role", () => {
    expect(demoRoles).toEqual(expectedRoles)
    expect(demoUsers.map(({ role }) => role)).toEqual(expectedRoles)
  })

  it("uses unique synthetic addresses and no token-shaped fixture fields", () => {
    const emails = demoUsers.map(({ email }) => email)

    expect(new Set(emails).size).toBe(9)
    expect(emails).toHaveLength(9)

    for (const user of demoUsers) {
      expect(user.email).toMatch(/\.test$/)
      expect(user).not.toHaveProperty("token")
      expect(user).not.toHaveProperty("accessToken")
    }
  })

  it("keeps the human credential guide synchronized with every fixture", () => {
    for (const user of demoUsers) {
      expect(credentialDocument).toContain(user.displayName)
      expect(credentialDocument).toContain(user.email)
      expect(credentialDocument).toContain(user.role)
    }

    expect(credentialDocument).toContain(sharedDemoPassword)
  })
})
