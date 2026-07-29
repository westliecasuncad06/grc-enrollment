import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  createScheduleProposal,
  createSection,
  replaceSection,
  toSectionReplacement,
} from "@/features/services/scheduling-service"

const section = {
  type: "section",
  id: 5,
  academic_term_id: 2,
  subject_id: 7,
  section_code: "A",
  professor_id: null,
  schedule_days: "MWF",
  starts_at_time: "08:00:00",
  ends_at_time: "09:00:00",
  room: "R101",
  capacity: 30,
  viability_threshold: 25,
  enrolled_count: 0,
  remaining_seats: 30,
  status: "planned",
  status_label: "Planned",
} as const

describe("scheduling-service", () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => vi.stubGlobal("fetch", fetchMock))
  afterEach(() => vi.unstubAllGlobals())

  it("creates sections, fully replaces them, and creates draft proposals", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: section }), { status: 201 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: section })))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              type: "schedule_proposal",
              id: 9,
              academic_term_id: 2,
              submitted_by: 4,
              status: "draft",
              status_label: "Draft",
              decided_by: null,
              decided_at: null,
              decision_reason: null,
            },
          }),
          { status: 201 },
        ),
      )

    const input = toSectionReplacement(section, { professor_id: 12 })
    expect(input.professor_id).toBe(12)
    expect(input.section_code).toBe("A")

    await createSection(input)
    await replaceSection(5, input)
    await createScheduleProposal({ academic_term_id: 2 })

    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("POST")
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe("PATCH")
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string)).toEqual(
      input,
    )
    expect(fetchMock.mock.calls[2]?.[1]?.method).toBe("POST")
  })
})
