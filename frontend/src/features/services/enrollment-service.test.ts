import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  createEnrollment,
  getEligibleSubjects,
  getEnrollments,
} from "@/features/services/enrollment-service"

const eligibleSubject = {
  type: "eligible_subject",
  subject_id: 7,
  code: "CS101",
  title: "Programming 1",
  units: 3,
  year_level: 1,
  semester: "1st",
  is_required: true,
  is_eligible: true,
  reasons: [{ code: "eligible", message: "All requirements are met." }],
  available_sections: [
    {
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
      viability_threshold: null,
      enrolled_count: 0,
      remaining_seats: 30,
      status: "published",
      status_label: "Published",
    },
  ],
} as const

const enrollment = {
  type: "enrollment",
  id: 9,
  academic_term_id: 2,
  status: "pending_registrar_approval",
  status_label: "Pending Registrar Approval",
  total_units: 3,
  submitted_at: "2026-07-30T00:00:00Z",
  registrar_decided_at: null,
  payment_confirmed_at: null,
  enrolled_at: null,
  subjects: [
    {
      section_id: 5,
      subject_code: "CS101",
      subject_title: "Programming 1",
      status: "selected",
      status_label: "Selected",
    },
  ],
  queue_ticket: {
    ticket_number: "Q000009",
    queue_date: "2026-07-30",
    status: "waiting",
    status_label: "Waiting",
  },
} as const

describe("enrollment-service", () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => vi.stubGlobal("fetch", fetchMock))
  afterEach(() => vi.unstubAllGlobals())

  it("fetches the eligible-subject pool for the given term", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [eligibleSubject] })),
    )

    const result = await getEligibleSubjects(2)

    expect(result).toEqual([eligibleSubject])
    expect(fetchMock.mock.calls[0]?.[0]).toContain(
      "/eligible-subjects?academic_term_id=2",
    )
  })

  it("fetches the authenticated student's enrollments", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [enrollment] })),
    )

    const result = await getEnrollments()

    expect(result).toEqual([enrollment])
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/enrollments")
  })

  it("submits an enrollment and parses the created resource", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: enrollment }), { status: 201 }),
    )

    const result = await createEnrollment({
      academic_term_id: 2,
      sections: [{ section_id: 5 }],
    })

    expect(result).toEqual(enrollment)
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("POST")
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual({
      academic_term_id: 2,
      sections: [{ section_id: 5 }],
    })
  })
})
