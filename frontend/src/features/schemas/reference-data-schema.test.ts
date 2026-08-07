import { describe, expect, it } from "vitest"

import {
  curriculumSchema,
  subjectSchema,
} from "@/features/schemas/reference-data-schema"

describe("curriculumSchema", () => {
  it("accepts the backend's archived curriculum status", () => {
    expect(
      curriculumSchema.parse({
        type: "curriculum",
        id: 22,
        program_id: 11,
        name: "BSCS 2023 Curriculum",
        effective_school_year: "2023-2024",
        status: "archived",
        status_label: "Archived",
        decided_at: null,
        last_decision_reason: null,
        subjects: [],
      }).status,
    ).toBe("archived")
  })

  it.each([
    "draft",
    "pending_dean_review",
    "pending_executive_review",
    "active",
    "archived",
  ] as const)(
    "accepts the '%s' curriculum status along with the decision fields",
    (status) => {
      expect(
        curriculumSchema.parse({
          type: "curriculum",
          id: 22,
          program_id: 11,
          name: "BSCS 2023 Curriculum",
          effective_school_year: "2023-2024",
          status,
          status_label: "Whatever",
          decided_at: "2026-08-07T00:00:00.000000Z",
          last_decision_reason: "Missing PATHFIT 2.",
          subjects: [],
        }).status,
      ).toBe(status)
    },
  )
})

describe("subjectSchema", () => {
  it("accepts catalog placeholders with zero units without rejecting the subject list", () => {
    expect(
      subjectSchema.parse({
        type: "subject",
        id: 166,
        code: "PHILHIST",
        title: "Readings in Philippine History",
        units: 0,
        status: "active",
        status_label: "Active",
        is_completion_only: false,
      }).units,
    ).toBe(0)
  })
})
