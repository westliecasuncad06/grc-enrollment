import { act, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

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
      add_drop_deadline_at: null,
      grading_deadline_at: null,
      status: "semester_ongoing",
      status_label: "Semester Ongoing",
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
  preference_score: null,
  preference_reasons: [],
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
      capacity_source: "plan",
      viability_threshold: null,
      enrolled_count: 0,
      remaining_seats: 30,
      is_block_exclusive: null,
      status: "published",
      status_label: "Published",
      college: "ccs",
      is_own_department: true,
    },
  ],
}

const enrollmentBlock = {
  type: "enrollment_block",
  block_code: "IT201",
  year_level: 2,
  curriculum_id: 9,
  section_plan_id: 12,
  total_units: 6,
  seats_remaining: 7,
  capacity: 40,
  is_selectable: true,
  reasons: [],
  preference_score: null,
  preference_reasons: [],
  subjects: [
    {
      section_id: 5,
      subject_id: 7,
      code: "CS201",
      title: "Data Structures",
      units: 3,
      schedule_days: "MWF",
      starts_at_time: "08:00:00",
      ends_at_time: "09:00:00",
      room: "LAB-1",
      modality: "f2f",
      professor_name: "Dr. Cruz",
      capacity: 40,
      enrolled_count: 33,
      remaining_seats: 7,
    },
    {
      section_id: 6,
      subject_id: 8,
      code: "GE201",
      title: "Ethics",
      units: 3,
      schedule_days: "TTh",
      starts_at_time: "10:00:00",
      ends_at_time: "11:30:00",
      room: "R201",
      modality: "f2f",
      professor_name: "Dr. Reyes",
      capacity: 40,
      enrolled_count: 30,
      remaining_seats: 10,
    },
  ],
}

const regularViewer = {
  audience: "year_2",
  label: "2nd Year",
  opens_at: null,
  closes_at: null,
  is_open: true,
  reason: "open",
}

const addDropClosed = {
  is_open: false,
  reason: "enrollment_still_open",
  reason_message:
    "The add/drop window opens once enrollment closes for this term.",
  opens_at: null,
  closes_at: null,
}

const regularStudentSession = {
  userId: "1",
  displayName: "Student",
  role: "student",
  signedInAt: "2026-07-30T00:00:00Z",
} as const

const irregularViewer = {
  audience: "irregular",
  label: "Irregular Students",
  opens_at: null,
  closes_at: null,
  is_open: true,
  reason: "open",
}

const irregularStudentSession = {
  userId: "1",
  displayName: "Student",
  role: "student",
  signedInAt: "2026-07-30T00:00:00Z",
} as const

/** IT 305 meets MWF only; IT 205 meets TTh — used to exercise the Day filter. */
const filterableSubjects = [
  {
    type: "eligible_subject",
    subject_id: 30,
    code: "IT 305",
    title: "Systems Integration",
    units: 3,
    year_level: 3,
    semester: "1st",
    is_required: true,
    is_eligible: true,
    reasons: [{ code: "eligible", message: "All requirements are met." }],
    preference_score: 40,
    preference_reasons: ["Matches your preferred time block"],
    available_sections: [
      {
        type: "section",
        id: 30,
        academic_term_id: 2,
        subject_id: 30,
        section_code: "A",
        professor_id: 10,
        schedule_days: "MWF",
        starts_at_time: "08:00:00",
        ends_at_time: "09:00:00",
        room: "R101",
        capacity: 30,
        capacity_source: "plan",
        viability_threshold: null,
        enrolled_count: 0,
        remaining_seats: 30,
        is_block_exclusive: null,
        status: "published",
        status_label: "Published",
        college: "ccs",
        is_own_department: true,
      },
    ],
  },
  {
    type: "eligible_subject",
    subject_id: 20,
    code: "IT 205",
    title: "Web Development",
    units: 3,
    year_level: 2,
    semester: "1st",
    is_required: true,
    is_eligible: true,
    reasons: [{ code: "eligible", message: "All requirements are met." }],
    preference_score: 90,
    preference_reasons: ["Matches your preferred days"],
    available_sections: [
      {
        type: "section",
        id: 20,
        academic_term_id: 2,
        subject_id: 20,
        section_code: "A",
        professor_id: 20,
        schedule_days: "TTh",
        starts_at_time: "13:00:00",
        ends_at_time: "14:30:00",
        room: "R202",
        capacity: 30,
        capacity_source: "plan",
        viability_threshold: null,
        enrolled_count: 0,
        remaining_seats: 30,
        is_block_exclusive: null,
        status: "published",
        status_label: "Published",
        college: "ccs",
        is_own_department: true,
      },
    ],
  },
]

function mockIrregularSchedule(input: RequestInfo | URL) {
  const target = url(input)
  if (
    target.includes("/academic-terms") &&
    target.includes("enrollment-windows")
  )
    return Promise.resolve(
      new Response(
        JSON.stringify({
          data: {
            type: "enrollment_schedule",
            academic_term_id: 2,
            status: "semester_ongoing",
            enrollment_opens_at: null,
            enrollment_closes_at: null,
            audiences: [],
            viewer: irregularViewer,
            add_drop: addDropClosed,
          },
        }),
      ),
    )
  return null
}

function mockIrregularRoutes(overrides: { subjects?: unknown } = {}) {
  return (input: RequestInfo | URL) => {
    const scheduleResponse = mockIrregularSchedule(input)
    if (scheduleResponse) return scheduleResponse

    const target = url(input)
    if (target.includes("/academic-terms"))
      return Promise.resolve(new Response(JSON.stringify(terms)))
    if (target.includes("/eligible-subjects"))
      return Promise.resolve(
        new Response(
          JSON.stringify({ data: overrides.subjects ?? filterableSubjects }),
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
  }
}

function scoredBlock(overrides: {
  block_code: string
  section_id: number
  preference_score: number | null
  preference_reasons: string[]
}) {
  return {
    type: "enrollment_block",
    block_code: overrides.block_code,
    year_level: 2,
    curriculum_id: 9,
    section_plan_id: 12,
    total_units: 3,
    seats_remaining: 7,
    capacity: 40,
    is_selectable: true,
    reasons: [],
    preference_score: overrides.preference_score,
    preference_reasons: overrides.preference_reasons,
    subjects: [
      {
        section_id: overrides.section_id,
        subject_id: overrides.section_id,
        code: "CS201",
        title: "Data Structures",
        units: 3,
        schedule_days: "MWF",
        starts_at_time: "08:00:00",
        ends_at_time: "09:00:00",
        room: "LAB-1",
        modality: "f2f",
        professor_name: "Dr. Cruz",
        capacity: 40,
        enrolled_count: 33,
        remaining_seats: 7,
      },
    ],
  }
}

// IT301/IT302/IT303 exercise the ranked table: a mid score, no score at all
// (still listed — preferences rank, they never gate), and the highest score.
const scoredBlocks = [
  scoredBlock({
    block_code: "IT301",
    section_id: 31,
    preference_score: 40,
    preference_reasons: ["Matches your preferred time block"],
  }),
  scoredBlock({
    block_code: "IT302",
    section_id: 32,
    preference_score: null,
    preference_reasons: [],
  }),
  scoredBlock({
    block_code: "IT303",
    section_id: 33,
    preference_score: 90,
    preference_reasons: ["Matches your preferred days"],
  }),
]

function mockRegularSchedule(input: RequestInfo | URL) {
  const target = url(input)
  if (
    target.includes("/academic-terms") &&
    target.includes("enrollment-windows")
  )
    return Promise.resolve(
      new Response(
        JSON.stringify({
          data: {
            type: "enrollment_schedule",
            academic_term_id: 2,
            status: "semester_ongoing",
            enrollment_opens_at: null,
            enrollment_closes_at: null,
            audiences: [],
            viewer: regularViewer,
            add_drop: addDropClosed,
          },
        }),
      ),
    )
  return null
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
    student_name: null,
    student_year_level: null,
    student_financial_status: null,
    student_financial_status_label: null,
    academic_term_id: 2,
    status: "pending_registrar_approval",
    status_label: "Pending Registrar Approval",
    total_units: 3,
    requires_overload_approval: false,
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
    // No queue ticket yet at submission — it is issued only once Registrar
    // Staff approves (Phase 6).
    queue_ticket: null,
    assessment: null,
  },
}

const studentAccount = {
  type: "student_account",
  student_id: 4,
  student_name: "Maria Santos",
  student_number: "2026-0001",
  year_level: 3,
  currency: "PHP",
  total_assessed: "6000.00",
  total_paid: "1000.00",
  prior_balance: "3500.00",
  outstanding_balance: "5000.00",
  has_promissory_note_on_file: true,
  entries: [
    {
      enrollment_id: 9,
      academic_term_id: 2,
      academic_term_label: "2025-2026 · 2nd",
      assessment_amount: "4500.00",
      confirmed_payment_amount: "1000.00",
      account_payment_amount: "0.00",
      outstanding_balance: "3500.00",
      promissory_note_on_file: true,
    },
  ],
} as const

function url(input: RequestInfo | URL) {
  return typeof input === "string"
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url
}

/** Opens a `Select` trigger and picks an item. */
async function selectOption(
  user: ReturnType<typeof userEvent.setup>,
  labelText: string,
  optionName: string | RegExp,
) {
  const triggers = await screen.findAllByLabelText(labelText)
  await user.click(triggers[0])
  await user.click(await screen.findByRole("option", { name: optionName }))
}

function mockRoutes(
  overrides: {
    enrollments?: unknown
    onSubmit?: () => unknown
  } = {},
) {
  return (input: RequestInfo | URL, init?: RequestInit) => {
    const target = url(input)
    if (target.endsWith("/student-account"))
      return Promise.resolve(
        new Response(JSON.stringify({ data: studentAccount })),
      )
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

function mockRegularRoutes(
  overrides: {
    blocks?: unknown
    onSubmit?: () => unknown
  } = {},
) {
  return (input: RequestInfo | URL, init?: RequestInit) => {
    const scheduleResponse = mockRegularSchedule(input)
    if (scheduleResponse) return scheduleResponse

    const target = url(input)
    if (target.includes("/academic-terms"))
      return Promise.resolve(new Response(JSON.stringify(terms)))
    if (target.includes("/enrollment-blocks"))
      return Promise.resolve(
        new Response(
          JSON.stringify({ data: overrides.blocks ?? [enrollmentBlock] }),
        ),
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
          JSON.stringify({
            data: [],
            links: paginationLinks,
            meta: paginationMeta,
          }),
        ),
      )
    return Promise.resolve(new Response(JSON.stringify({ data: [] })))
  }
}

describe("EnrollmentWorkspace", () => {
  const fetchMock = vi.fn<typeof fetch>()
  beforeEach(() => vi.stubGlobal("fetch", fetchMock))
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

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

    await selectOption(user, "CS101 section", /Section A/)
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
    expect(
      await screen.findByText(/pending registrar approval/),
    ).toBeInTheDocument()
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

    await selectOption(user, "CS101 section", /Section A/)
    await user.click(screen.getByRole("button", { name: "Submit enrollment" }))
    await user.click(screen.getByRole("button", { name: "Confirm submission" }))

    expect(
      await screen.findByText(
        "This section is not currently eligible for selection.",
      ),
    ).toBeInTheDocument()
    expect(screen.getAllByLabelText("CS101 section")[0]).toHaveTextContent(
      "Section A",
    )
  })

  it("shows a clear message and preserves the selection when submission conflicts", async () => {
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
                code: "CONFLICT",
                message:
                  "This section filled up while you were reviewing your selection.",
                errors: {},
                request_id: "request-409",
              },
            }),
            { status: 409 },
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

    await selectOption(user, "CS101 section", /Section A/)
    await user.click(screen.getByRole("button", { name: "Submit enrollment" }))
    await user.click(screen.getByRole("button", { name: "Confirm submission" }))

    expect(
      await screen.findByText(
        "Your enrollment could not be submitted. Check the connection and try again.",
      ),
    ).toBeInTheDocument()
    expect(screen.getAllByLabelText("CS101 section")[0]).toHaveTextContent(
      "Section A",
    )
  })

  it("shows a clear message when the eligible-subject pool cannot be reached", async () => {
    fetchMock.mockImplementation((input) => {
      const target = url(input)
      if (target.endsWith("/student-account"))
        return Promise.resolve(
          new Response(JSON.stringify({ data: studentAccount })),
        )
      if (target.includes("/academic-terms"))
        return Promise.resolve(new Response(JSON.stringify(terms)))
      if (target.includes("/eligible-subjects"))
        return Promise.reject(new TypeError("Failed to fetch"))
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

    expect(
      await screen.findByText("Connection interrupted", {}, { timeout: 3_000 }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "The public enrollment API is not available right now. Confirm that the Laravel service is running, then try again.",
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument()
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

    expect(await screen.findByText("Enrollment #9")).toBeInTheDocument()
    expect(screen.queryByLabelText("Section")).not.toBeInTheDocument()
  })

  it("shows the overall stepper and embeds the Queue & Payment panel once an enrollment exists", async () => {
    fetchMock.mockImplementation(
      mockRoutes({
        enrollments: {
          data: [
            {
              ...createdEnrollment.data,
              status: "pending_payment",
              registrar_decided_at: "2026-07-31T00:00:00Z",
              queue_ticket: {
                ticket_number: "Q000001",
                queue_date: "2026-07-31",
                status: "waiting",
                status_label: "Waiting",
                priority: "regular",
                priority_label: "Regular",
                position: 0,
              },
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

    expect(await screen.findByText("Enrollment #9")).toBeInTheDocument()
    expect(screen.getAllByText(/Q000001/).length).toBeGreaterThan(0)
    // Not yet enrolled -- the Add/Drop panel only appears once `enrolled`.
    expect(
      screen.queryByRole("heading", { name: "Add/Drop requests" }),
    ).not.toBeInTheDocument()
  })

  it("shows the student's own account balance as read-only information", async () => {
    fetchMock.mockImplementation(mockRoutes())
    renderWithSession(<EnrollmentWorkspace />, {
      session: regularStudentSession,
    })

    expect(
      await screen.findByRole("heading", { name: "Account balance" }),
    ).toBeInTheDocument()
    expect(screen.getByText("₱5,000.00")).toBeInTheDocument()
    expect(screen.getByText("2025-2026 · 2nd")).toBeInTheDocument()
    expect(screen.getByText("Promissory note on file")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /record.*payment/i }),
    ).not.toBeInTheDocument()
  })

  it("does not request a student account for a non-student session", async () => {
    fetchMock.mockImplementation(mockRoutes())
    renderWithSession(<EnrollmentWorkspace />, {
      session: {
        userId: "7",
        displayName: "Registrar Staff",
        role: "registrar_staff",
        signedInAt: "2026-07-30T00:00:00Z",
      },
    })

    await screen.findAllByLabelText("CS101 section")
    expect(
      fetchMock.mock.calls.some(([input]) =>
        url(input).endsWith("/student-account"),
      ),
    ).toBe(false)
  })

  it("embeds the Add/Drop panel once the enrollment is enrolled", async () => {
    fetchMock.mockImplementation(
      mockRoutes({
        enrollments: {
          data: [
            {
              ...createdEnrollment.data,
              status: "enrolled",
              registrar_decided_at: "2026-07-31T00:00:00Z",
              payment_confirmed_at: "2026-08-01T00:00:00Z",
              enrolled_at: "2026-08-01T00:00:00Z",
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
      await screen.findByRole("heading", { name: "Add/Drop requests" }),
    ).toBeInTheDocument()
  })

  it("embeds the Withdraw panel once the enrollment is enrolled", async () => {
    fetchMock.mockImplementation(
      mockRoutes({
        enrollments: {
          data: [
            {
              ...createdEnrollment.data,
              status: "enrolled",
              registrar_decided_at: "2026-07-31T00:00:00Z",
              payment_confirmed_at: "2026-08-01T00:00:00Z",
              enrolled_at: "2026-08-01T00:00:00Z",
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
      await screen.findByRole("heading", { name: "Withdraw from this term" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Withdraw" })).toBeInTheDocument()
  })

  it("shows a closed banner and disables selection and submission when the enrollment window is closed", async () => {
    fetchMock.mockImplementation((input) => {
      const target = url(input)
      if (
        target.includes("/academic-terms") &&
        target.includes("enrollment-windows")
      )
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: {
                type: "enrollment_schedule",
                academic_term_id: 2,
                status: "semester_ongoing",
                enrollment_opens_at: null,
                enrollment_closes_at: null,
                audiences: [],
                viewer: {
                  audience: "irregular",
                  label: "Irregular Students",
                  opens_at: "2028-08-01T00:00:00Z",
                  closes_at: null,
                  is_open: false,
                  reason: "before_window",
                },
                add_drop: {
                  is_open: false,
                  reason: "enrollment_still_open",
                  reason_message:
                    "The add/drop window opens once enrollment closes for this term.",
                  opens_at: null,
                  closes_at: null,
                },
              },
            }),
          ),
        )
      if (target.includes("/academic-terms"))
        return Promise.resolve(new Response(JSON.stringify(terms)))
      if (target.includes("/eligible-subjects"))
        return Promise.resolve(
          new Response(JSON.stringify({ data: [eligibleSubject] })),
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

    expect(
      await screen.findByText("Enrollment has not opened yet"),
    ).toBeInTheDocument()
    const sectionTriggers = await screen.findAllByLabelText("CS101 section")
    for (const trigger of sectionTriggers) {
      expect(trigger).toBeDisabled()
    }
  })

  it("a regular student selects an inline section, confirms, and submits", async () => {
    const user = userEvent.setup()
    let submitCall: [RequestInfo | URL, RequestInit | undefined] | null = null
    fetchMock.mockImplementation((input, init) => {
      if (url(input).includes("/enrollments") && init?.method === "POST") {
        submitCall = [input, init]
      }
      return mockRegularRoutes()(input, init)
    })
    renderWithSession(<EnrollmentWorkspace />, {
      session: {
        userId: "1",
        displayName: "Student",
        role: "student",
        signedInAt: "2026-07-30T00:00:00Z",
      },
    })

    const section = await screen.findByRole("article", {
      name: "IT201 section",
    })
    expect(screen.queryByText("Schedule preference")).not.toBeInTheDocument()
    expect(
      within(section).getByRole("table", { name: "IT201 schedule" }),
    ).toBeInTheDocument()
    expect(within(section).getAllByText("Section ID")).not.toHaveLength(0)
    expect(within(section).getAllByText("Data Structures")).not.toHaveLength(0)
    expect(within(section).getAllByText("LAB-1")).not.toHaveLength(0)
    await user.click(
      within(section).getByRole("button", { name: "Choose IT201" }),
    )
    expect(
      screen.queryByRole("dialog", { name: /IT201/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Change section" }),
    ).toBeInTheDocument()
    expect(screen.queryByText("Review your section")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Submit enrollment" }))
    expect(
      screen.getByText(/enrolls you in all 2 subjects of section IT201/),
    ).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Confirm submission" }))

    await vi.waitFor(() => expect(submitCall).not.toBeNull())
    const [, init] = submitCall!
    expect(JSON.parse(init?.body as string)).toEqual({
      academic_term_id: 2,
      block_code: "IT201",
    })
    expect(
      await screen.findByText(/pending registrar approval/),
    ).toBeInTheDocument()
  })

  it("shows only the chosen section and returns to all sections when changed", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation(mockRegularRoutes({ blocks: scoredBlocks }))
    renderWithSession(<EnrollmentWorkspace />, {
      session: regularStudentSession,
    })

    const section = await screen.findByRole("article", {
      name: "IT301 section",
    })
    expect(
      screen.getByRole("article", { name: "IT302 section" }),
    ).toBeInTheDocument()
    await user.click(
      within(section).getByRole("button", { name: "Choose IT301" }),
    )
    expect(
      screen.getByRole("article", { name: "IT301 section" }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("article", { name: "IT302 section" }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Change section" }))

    expect(
      screen.getByRole("article", { name: "IT301 section" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("article", { name: "IT302 section" }),
    ).toBeInTheDocument()
  })

  it("keeps a low-scoring section selectable", async () => {
    fetchMock.mockImplementation(mockRegularRoutes({ blocks: scoredBlocks }))
    renderWithSession(<EnrollmentWorkspace />, {
      session: regularStudentSession,
    })

    // IT302 has no preference_score at all — it must still be listed and
    // choosable, since preferences rank sections but never gate them.
    const section = await screen.findByRole("article", {
      name: "IT302 section",
    })

    expect(
      within(section).getByRole("button", { name: "Choose IT302" }),
    ).toBeEnabled()
  })

  it("shows an explicit empty state when no sections exist for a regular student's curriculum", async () => {
    fetchMock.mockImplementation(mockRegularRoutes({ blocks: [] }))
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
        "No sections were generated for your year level and curriculum yet. Contact the Registrar.",
      ),
    ).toBeInTheDocument()
  })

  it("disables section selection when the enrollment window is closed", async () => {
    fetchMock.mockImplementation((input) => {
      const target = url(input)
      if (
        target.includes("/academic-terms") &&
        target.includes("enrollment-windows")
      )
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: {
                type: "enrollment_schedule",
                academic_term_id: 2,
                status: "semester_ongoing",
                enrollment_opens_at: null,
                enrollment_closes_at: null,
                audiences: [],
                viewer: {
                  ...regularViewer,
                  is_open: false,
                  reason: "before_window",
                },
                add_drop: addDropClosed,
              },
            }),
          ),
        )
      return mockRegularRoutes()(input)
    })
    renderWithSession(<EnrollmentWorkspace />, {
      session: {
        userId: "1",
        displayName: "Student",
        role: "student",
        signedInAt: "2026-07-30T00:00:00Z",
      },
    })

    const section = await screen.findByRole("article", {
      name: "IT201 section",
    })
    expect(
      within(section).getByRole("button", { name: "Choose IT201" }),
    ).toBeDisabled()
  })

  it("has no detectable accessibility violations once loaded", async () => {
    fetchMock.mockImplementation(mockRoutes())
    const { container } = renderWithSession(<EnrollmentWorkspace />, {
      session: {
        userId: "1",
        displayName: "Student",
        role: "student",
        signedInAt: "2026-07-30T00:00:00Z",
      },
    })

    await screen.findAllByLabelText("CS101 section")
    expect(await axe(container)).toHaveNoViolations()
  })

  it("polls so a Registrar decision appears without a manual refresh", async () => {
    let status: "pending_registrar_approval" | "pending_payment" =
      "pending_registrar_approval"
    const baseRoutes = mockRoutes()
    fetchMock.mockImplementation((input, init) => {
      const target = url(input)
      if (target.includes("/enrollments") && init?.method !== "POST")
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: [
                {
                  ...createdEnrollment.data,
                  status,
                  status_label:
                    status === "pending_registrar_approval"
                      ? "Pending Registrar Approval"
                      : "Pending Payment",
                },
              ],
              links: paginationLinks,
              meta: paginationMeta,
            }),
          ),
        )
      return baseRoutes(input, init)
    })

    vi.useFakeTimers({ shouldAdvanceTime: true })

    renderWithSession(<EnrollmentWorkspace />, {
      session: {
        userId: "1",
        displayName: "Student",
        role: "student",
        signedInAt: "2026-07-30T00:00:00Z",
      },
    })

    expect(
      (await screen.findAllByText("Pending Registrar Approval")).length,
    ).toBeGreaterThan(0)

    status = "pending_payment"
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })

    expect(
      (await screen.findAllByText("Pending Payment")).length,
    ).toBeGreaterThan(0)
    expect(
      screen.queryByText("Pending Registrar Approval"),
    ).not.toBeInTheDocument()
  })

  it("does not render schedule preference for an irregular student", async () => {
    fetchMock.mockImplementation(mockIrregularRoutes())
    renderWithSession(<EnrollmentWorkspace />, {
      session: irregularStudentSession,
    })

    await screen.findByRole("heading", { name: /eligible subjects/i })
    expect(screen.queryByText("Schedule preference")).not.toBeInTheDocument()
  })

  it("filters the irregular subject pool by day without refetching", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation(mockIrregularRoutes())
    renderWithSession(<EnrollmentWorkspace />, {
      session: irregularStudentSession,
    })

    await screen.findByRole("heading", { name: /eligible subjects/i })
    const callsBefore = fetchMock.mock.calls.length

    await user.selectOptions(screen.getByLabelText("Day"), "2")

    expect(fetchMock.mock.calls).toHaveLength(callsBefore)
    expect(screen.queryByText("IT 305")).not.toBeInTheDocument()
    expect(screen.getAllByText(/IT 205/).length).toBeGreaterThan(0)
  })

  it("lets an irregular student choose a cross-department section for a shared subject", async () => {
    const user = userEvent.setup()
    const sharedSubject = {
      ...eligibleSubject,
      available_sections: [
        {
          ...eligibleSubject.available_sections[0],
          id: 55,
          college: "coe",
          is_own_department: false,
        },
      ],
    }
    fetchMock.mockImplementation((input, init) => {
      const target = url(input)
      if (target.includes("/eligible-subjects"))
        return Promise.resolve(
          new Response(JSON.stringify({ data: [sharedSubject] })),
        )
      return mockRoutes()(input, init)
    })
    renderWithSession(<EnrollmentWorkspace />, {
      session: {
        userId: "1",
        displayName: "Student",
        role: "student",
        signedInAt: "2026-07-30T00:00:00Z",
      },
    })

    const triggers = await screen.findAllByLabelText("CS101 section")
    await user.click(triggers[0])
    await user.click(
      await screen.findByRole("option", { name: /Section A.*COE/ }),
    )

    expect(screen.getAllByText("COE section").length).toBeGreaterThan(0)
  })
})
