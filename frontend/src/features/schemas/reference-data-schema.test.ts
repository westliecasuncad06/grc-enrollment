import { describe, expect, it } from "vitest"

import { curriculumSchema } from "@/features/schemas/reference-data-schema"

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
        subjects: [],
      }).status,
    ).toBe("archived")
  })
})
