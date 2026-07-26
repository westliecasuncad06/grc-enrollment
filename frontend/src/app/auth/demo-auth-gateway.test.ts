import { describe, expect, it } from "vitest"

import {
  createDemoAuthGateway,
  createDisabledAuthGateway,
  DemoAuthError,
} from "@/app/auth/demo-auth-gateway"
import { demoUsers, sharedDemoPassword } from "@/app/auth/demo-users"

describe("createDemoAuthGateway", () => {
  const gateway = createDemoAuthGateway(demoUsers)

  it("signs in every approved demo identity without returning credentials", async () => {
    for (const user of demoUsers) {
      const session = await gateway.signIn({
        email: user.email,
        password: sharedDemoPassword,
      })

      expect(session).toMatchObject({
        schemaVersion: "demo-v1",
        userId: user.id,
        displayName: user.displayName,
        role: user.role,
      })
      expect(session).not.toHaveProperty("email")
      expect(session).not.toHaveProperty("password")
      expect(Number.isNaN(Date.parse(session.signedInAt))).toBe(false)
    }
  })

  it("normalizes email case and surrounding whitespace", async () => {
    const session = await gateway.signIn({
      email: "  STUDENT.DEMO@GRC.TEST  ",
      password: sharedDemoPassword,
    })

    expect(session.userId).toBe("demo-student")
  })

  it.each([
    { email: "unknown@grc.test", password: sharedDemoPassword },
    { email: "student.demo@grc.test", password: "wrong-password" },
    { email: "unknown@grc.test", password: "wrong-password" },
  ])(
    "uses one generic rejection for unrecognized credentials",
    async (input) => {
      await expect(gateway.signIn(input)).rejects.toEqual(
        new DemoAuthError("INVALID_DEMO_CREDENTIALS"),
      )
    },
  )
})

describe("createDisabledAuthGateway", () => {
  it("rejects all sign-in attempts with the disabled boundary", async () => {
    const gateway = createDisabledAuthGateway()

    await expect(
      gateway.signIn({
        email: "student.demo@grc.test",
        password: sharedDemoPassword,
      }),
    ).rejects.toEqual(new DemoAuthError("DEMO_AUTH_DISABLED"))
  })
})
