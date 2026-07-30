import { describe, expect, it } from "vitest"

import { gradeBadgeVariant } from "@/features/lib/grade-presentation"

describe("gradeBadgeVariant", () => {
  it("maps locked to default", () => {
    expect(gradeBadgeVariant("locked")).toBe("default")
  })

  it("maps submitted to secondary", () => {
    expect(gradeBadgeVariant("submitted")).toBe("secondary")
  })

  it("maps draft to outline", () => {
    expect(gradeBadgeVariant("draft")).toBe("outline")
  })
})
