import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { EnrollmentWorkspace } from "@/features/components/portal/enrollment-workspace"
import { renderWithSession } from "@/tests/render-app"

const terms = {
  data: [
    {
      type: "academic-term",
      id: 2,
      school_year: "2026-2027",
      semester: "1st",
      starts_at: null,
      ends_at: null,
      enrollment_opens_at: null,
      enrollment_closes_at: null,
      status: "active",
      status_label: "Active",
    },
  ],
}

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
}

const paginationLinks = {
  first: "https://api.test/enrollments?page=1",
  last: "https://api.test/enrollments?page=1",
  prev: null,
  next: null,
}
const paginationMeta = {
  current_page: 1,
  last_page: 1,
  per_page: 20,
  total: 0,
}

const createdEnrollment = {
  data: {
    type: "enrollment",
    id: 9,
    student_id: 4,
    student_number: "2026-0001",
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
  },
}

function url(input: RequestInfo | URL) {
  return typeof input === "string"
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url
}

function mockRoutes(
  overrides: {
    enrollments?: unknown
    onSubmit?: () => unknown
  } = {},
) {
  return (input: RequestInfo | URL, init?: RequestInit) => {
    const target = url(input)
    if (target.includes("/academic-terms"))
      return Promise.resolve(new Response(JSON.stringify(terms)))
    if (target.includes("/eligible-subjects"))
      return Promise.resolve(
        new Response(JSON.stringify({ data: [eligibleSubject] })),
      )
    if (target.includes("/enrollments") && init?.method === "POST")
      return Promise.resolve(
        new Response(
          JSON.stringify(overrides.onSubmit?.() ?? createdEnrollment),
          { status: 201 },
        ),
      )
    if (target.includes("/enrollments"))
      return Promise.resolve(
        new Response(
          JSON.stringify(
            overrides.enrollments ?? {
              data: [],
              links: paginationLinks,
              meta: paginationMeta,
            },
          ),
        ),
      )
    return Promise.resolve(new Response(JSON.stringify({ data: [] })))
  }
}

describe("EnrollmentWorkspace", () => {
  const fetchMock = vi.fn<typeof fetch>()
  beforeEach(() => vi.stubGlobal("fetch", fetchMock))
  afterEach(() => vi.unstubAllGlobals())

  it("selects a section, reviews, confirms, and submits the enrollment", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation(mockRoutes())
    renderWithSession(<EnrollmentWorkspace />, {
      session: {
        userId: "1",
        displayName: "Student",
        role: "student",
        signedInAt: "2026-07-30T00:00:00Z",
      },
    })

    await user.selectOptions(await screen.findByLabelText("Section"), "5")
    expect(
      await screen.findByText("Review your enrollment"),
    ).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Submit enrollment" }))
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Confirm submission" }))

    await vi.waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/enrollments"),
        expect.objectContaining({ method: "POST" }),
      ),
    )
    const submitCall = fetchMock.mock.calls.find(
      ([request, init]) =>
        url(request).includes("/enrollments") && init?.method === "POST",
    )
    expect(JSON.parse(submitCall?.[1]?.body as string)).toEqual({
      academic_term_id: 2,
      sections: [{ section_id: 5 }],
    })
    expect(await screen.findByText(/Queue ticket: Q000009/)).toBeInTheDocument()
  })

  it("preserves the selected section when submission fails", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation((input, init) => {
      const target = url(input)
      if (target.includes("/academic-terms"))
        return Promise.resolve(new Response(JSON.stringify(terms)))
      if (target.includes("/eligible-subjects"))
        return Promise.resolve(
          new Response(JSON.stringify({ data: [eligibleSubject] })),
        )
      if (target.includes("/enrollments") && init?.method === "POST")
        return Promise.resolve(
          new Response(
            JSON.stringify({
              error: {
                code: "VALIDATION_FAILED",
                message: "Validation failed.",
                errors: {
                  "sections.0.section_id": [
                    "This section is not currently eligible for selection.",
                  ],
                },
                request_id: "req-1",
              },
            }),
            { status: 422 },
          ),
        )
      if (target.includes("/enrollments"))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: [],
              links: paginationLinks,
              meta: paginationMeta,
            }),
          ),
        )
      return Promise.resolve(new Response(JSON.stringify({ data: [] })))
    })
    renderWithSession(<EnrollmentWorkspace />, {
      session: {
        userId: "1",
        displayName: "Student",
        role: "student",
        signedInAt: "2026-07-30T00:00:00Z",
      },
    })

    await user.selectOptions(await screen.findByLabelText("Section"), "5")
    await user.click(screen.getByRole("button", { name: "Submit enrollment" }))
    await user.click(screen.getByRole("button", { name: "Confirm submission" }))

    expect(
      await screen.findByText(
        "This section is not currently eligible for selection.",
      ),
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Section")).toHaveValue("5")
  })

  it("hides selection when the student already has an active enrollment this term", async () => {
    fetchMock.mockImplementation(
      mockRoutes({
        enrollments: {
          data: [
            {
              ...createdEnrollment.data,
              status: "pending_registrar_approval",
            },
          ],
          links: paginationLinks,
          meta: { ...paginationMeta, total: 1 },
        },
      }),
    )
    renderWithSession(<EnrollmentWorkspace />, {
      session: {
        userId: "1",
        displayName: "Student",
        role: "student",
        signedInAt: "2026-07-30T00:00:00Z",
      },
    })

    expect(
      await screen.findByText(
        "You already have an active enrollment for this term. View its status below.",
      ),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText("Section")).not.toBeInTheDocument()
  })
})
