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

  it("defaults to real API authentication when no mode was requested", () => {
    expect(
      selectAuthMode({ requestedMode: undefined, mode: "development" }),
    ).toBe("api")
    expect(
      selectAuthMode({ requestedMode: undefined, mode: "production" }),
    ).toBe("api")
  })

  it("falls back to real API authentication for an unrecognized request", () => {
    expect(selectAuthMode({ requestedMode: "unsupported", mode: "test" })).toBe(
      "api",
    )
  })

  it.each(["development", "test", "production"])(
    "honors an explicit request to disable authentication in %s mode",
    (mode) => {
      expect(selectAuthMode({ requestedMode: "disabled", mode })).toBe(
        "disabled",
      )
    },
  )
})
