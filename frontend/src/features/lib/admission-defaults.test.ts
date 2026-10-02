import { describe, expect, it } from "vitest"

import {
  deriveEnrollmentCategoryFromYearLevel,
  deriveStudentTypeFromYearLevel,
} from "@/features/lib/admission-defaults"

describe("admission-defaults", () => {
  it("derives Regular for year level 1", () => {
    expect(deriveEnrollmentCategoryFromYearLevel(1)).toBe("regular")
  })

  it("derives Irregular for year levels 2 through 4", () => {
    for (const yearLevel of [2, 3, 4]) {
      expect(deriveEnrollmentCategoryFromYearLevel(yearLevel)).toBe(
        "irregular",
      )
    }
  })

  it("derives Freshman for year level 1", () => {
    expect(deriveStudentTypeFromYearLevel(1)).toBe("freshman")
  })

  it("derives Transferee for year levels 2 through 4", () => {
    for (const yearLevel of [2, 3, 4]) {
      expect(deriveStudentTypeFromYearLevel(yearLevel)).toBe("transferee")
    }
  })
})
