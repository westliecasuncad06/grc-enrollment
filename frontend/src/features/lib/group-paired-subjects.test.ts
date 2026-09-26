import { describe, expect, it } from "vitest"

import { groupPairedSubjects } from "@/features/lib/group-paired-subjects"

const row = (subject_id: number, paired_subject_id: number | null) => ({
  subject_id,
  paired_subject_id,
})

describe("groupPairedSubjects", () => {
  it("leaves a list with no pairs exactly as it is", () => {
    const rows = [row(1, null), row(2, null), row(3, null)]

    expect(groupPairedSubjects(rows)).toEqual(rows)
  })

  it("pulls a laboratory up to sit right after its lecture", () => {
    const rows = [row(1, 3), row(2, null), row(3, 1), row(4, null)]

    expect(groupPairedSubjects(rows).map((r) => r.subject_id)).toEqual([
      1, 3, 2, 4,
    ])
  })

  it("works when the laboratory comes first in the list", () => {
    const rows = [row(3, 1), row(2, null), row(1, 3)]

    expect(groupPairedSubjects(rows).map((r) => r.subject_id)).toEqual([
      3, 1, 2,
    ])
  })

  it("ignores a partner that is not in the list", () => {
    const rows = [row(1, 9), row(2, null)]

    expect(groupPairedSubjects(rows).map((r) => r.subject_id)).toEqual([1, 2])
  })

  it("keeps every row exactly once and does not change its input", () => {
    const rows = [row(1, 2), row(3, 4), row(2, 1), row(4, 3)]
    const before = rows.map((r) => r.subject_id)

    const grouped = groupPairedSubjects(rows)

    expect(grouped.map((r) => r.subject_id)).toEqual([1, 2, 3, 4])
    expect(rows.map((r) => r.subject_id)).toEqual(before)
  })
})
