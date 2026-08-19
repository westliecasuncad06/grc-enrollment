import { describe, expect, it } from "vitest"

import {
  isBacklogSubject,
  semesterOrdinal,
} from "@/features/lib/curriculum-ordinal"

describe("semesterOrdinal", () => {
  it("gives year 1 1st semester the first ordinal", () => {
    expect(semesterOrdinal(1, "1st")).toBe(1)
  })

  it("gives year 1 2nd semester the second ordinal", () => {
    expect(semesterOrdinal(1, "2nd")).toBe(2)
  })

  it("gives year 3 1st semester the fifth ordinal", () => {
    expect(semesterOrdinal(3, "1st")).toBe(5)
  })

  it("gives year 4 2nd semester the eighth ordinal", () => {
    expect(semesterOrdinal(4, "2nd")).toBe(8)
  })
})

describe("isBacklogSubject", () => {
  it("is backlog when the subject's year is earlier than the student's", () => {
    expect(isBacklogSubject(1, "1st", 3, "1st")).toBe(true)
  })

  it("is backlog when same year but an earlier semester", () => {
    expect(isBacklogSubject(3, "1st", 3, "2nd")).toBe(true)
  })

  it("is not backlog for the student's current semester", () => {
    expect(isBacklogSubject(3, "2nd", 3, "2nd")).toBe(false)
  })

  it("is not backlog for a future semester", () => {
    expect(isBacklogSubject(4, "1st", 3, "2nd")).toBe(false)
  })
})
