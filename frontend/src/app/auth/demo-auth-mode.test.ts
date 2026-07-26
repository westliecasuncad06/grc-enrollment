import { describe, expect, it } from "vitest"

import { selectAuthMode } from "@/app/auth/demo-auth-mode"

describe("selectAuthMode", () => {
  it.each(["development", "test"])(
    "enables requested demo authentication in %s mode",
    (mode) => {
      expect(selectAuthMode({ requestedMode: "demo", mode })).toBe("demo")
    },
  )

  it("disables demo authentication in production even when requested", () => {
    expect(selectAuthMode({ requestedMode: "demo", mode: "production" })).toBe(
      "disabled",
    )
  })

  it("keeps authentication disabled when demo mode was not requested", () => {
    expect(
      selectAuthMode({ requestedMode: undefined, mode: "development" }),
    ).toBe("disabled")
    expect(selectAuthMode({ requestedMode: "unsupported", mode: "test" })).toBe(
      "disabled",
    )
  })
})
