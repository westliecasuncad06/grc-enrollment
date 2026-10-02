import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { EnrollmentReviewDialog } from "@/features/components/portal/enrollment-review-dialog"
import { EnrollmentRevisionReviewCard } from "@/features/components/portal/enrollment-revision-review-card"
import { ProgramChairIrregularEnrollmentsWorkspace } from "@/features/components/portal/program-chair-irregular-enrollments-workspace"
import type { Enrollment } from "@/features/schemas/enrollment-schema"
import { renderWithSession } from "@/tests/render-app"

/** The JSON body a request carried (these requests are all JSON strings). */
function bodyOf(init: RequestInit | undefined): unknown {
  return JSON.parse(typeof init?.body === "string" ? init.body : "{}")
}

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === "string") return input
  return input instanceof URL ? input.toString() : input.url
}

const studentSession = {
  userId: "4",
  displayName: "Student",
  role: "student" as const,
  signedInAt: "2026-10-03T00:00:00Z",
}

const chairSession = {
  userId: "7",
  displayName: "Program Chair",
  role: "program_chair" as const,
  college: "ccs" as const,
  signedInAt: "2026-10-03T00:00:00Z",
}

const revision = {
  id: 1,
  note: "CS101 clashes with your other class, so CS102 replaces it.",
  added_subjects: [
    { section_id: 6, section_code: "B", subject_code: "CS102", subject_title: "Data Structures", units: 3 },
  ],
  removed_subjects: [
    { section_id: 5, section_code: "A", subject_code: "CS101", subject_title: "Programming 1", units: 3 },
  ],
  units_before: 3,
  units_after: 3,
  status: "pending",
  student_reason: null,
  proposed_at: "2026-10-03T02:00:00Z",
  responded_at: null,
} as const

function enrollment(overrides: Record<string, unknown> = {}): Enrollment {
  return {
    type: "enrollment",
    id: 21,
    student_id: 8,
    student_number: "2026-0300",
    student_name: "Irregular Student",
    student_year_level: 3,
    student_financial_status: null,
    student_financial_status_label: null,
    student_enrollment_category: "irregular",
    is_irregular: true,
    academic_term_id: 2,
    status: "pending_student_review",
    status_label: "Awaiting Student Review",
    total_units: 3,
    requires_overload_approval: false,
    program_head_comment: null,
    submitted_at: "2026-10-02T00:00:00Z",
    program_head_decided_at: null,
    registrar_decided_at: null,
    payment_confirmed_at: null,
    enrolled_at: null,
    subjects: [
      {
        section_id: 6, section_code: "B", subject_id: 2, subject_code: "CS102", paired_subject_id: null,
        subject_title: "Data Structures", units: 3, schedule_days: "TTh", starts_at_time: "08:00:00",
        ends_at_time: "09:30:00", room: "R1", modality: "f2f", professor_name: null, status: "selected", status_label: "Selected",
      },
    ],
    revisions: [revision],
    queue_ticket: null,
    assessment: null,
    ...overrides,
  } as unknown as Enrollment
}

describe("EnrollmentRevisionReviewCard (the student's answer)", () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => vi.stubGlobal("fetch", fetchMock))
  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllGlobals()
  })

  function patched(enrollmentBody: Enrollment) {
    return Promise.resolve(new Response(JSON.stringify({ data: enrollmentBody })))
  }

  it("shows why the Program Chair changed the subjects and what changed", () => {
    renderWithSession(<EnrollmentRevisionReviewCard enrollment={enrollment()} />, { session: studentSession })

    const card = screen.getByRole("region", { name: "Review your Program Chair's changes" })
    expect(within(card).getByText(/CS101 clashes with your other class/)).toBeInTheDocument()
    expect(within(card).getByText("Added")).toBeInTheDocument()
    expect(within(card).getByText(/Data Structures/)).toBeInTheDocument()
    expect(within(card).getByText("Removed")).toBeInTheDocument()
    expect(within(card).getByText(/Programming 1/)).toBeInTheDocument()
  })

  it("is not shown unless the Program Chair is waiting for the student", () => {
    renderWithSession(
      <EnrollmentRevisionReviewCard enrollment={enrollment({ status: "pending_registrar_approval", status_label: "Pending Registrar Approval" })} />,
      { session: studentSession },
    )

    expect(screen.queryByRole("region", { name: "Review your Program Chair's changes" })).not.toBeInTheDocument()
  })

  it("accepting the changes sends student_accept_revision", async () => {
    const user = userEvent.setup()
    const bodies: unknown[] = []
    fetchMock.mockImplementation((_input, init) => {
      bodies.push(bodyOf(init))
      return patched(enrollment({ status: "pending_registrar_approval", status_label: "Pending Registrar Approval" }))
    })
    renderWithSession(<EnrollmentRevisionReviewCard enrollment={enrollment()} />, { session: studentSession })

    await user.click(screen.getByRole("button", { name: "Accept the changes" }))

    await waitFor(() => expect(bodies[0]).toEqual({ action: "student_accept_revision" }))
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/enrollments/21"),
      expect.objectContaining({ method: "PATCH" }),
    )
  })

  it("not accepting needs a reason, and sends it with student_decline_revision", async () => {
    const user = userEvent.setup()
    const bodies: unknown[] = []
    fetchMock.mockImplementation((_input, init) => {
      bodies.push(bodyOf(init))
      return patched(enrollment({ status: "pending_program_head_approval", status_label: "Pending Program Head Approval" }))
    })
    renderWithSession(<EnrollmentRevisionReviewCard enrollment={enrollment()} />, { session: studentSession })

    await user.click(screen.getByRole("button", { name: "I do not accept" }))
    const dialog = await screen.findByRole("alertdialog")
    const send = within(dialog).getByRole("button", { name: "Send to my Program Chair" })
    expect(send).toBeDisabled()

    await user.type(within(dialog).getByLabelText("Your reason"), "CS102 meets on Tuesdays and I work then.")
    expect(send).toBeEnabled()
    await user.click(send)

    await waitFor(() =>
      expect(bodies[0]).toEqual({
        action: "student_decline_revision",
        reason: "CS102 meets on Tuesdays and I work then.",
      }),
    )
  })

  it("tells the student when the answer could not be saved", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            error: {
              code: "VALIDATION_FAILED",
              message: "This action requires the enrollment to currently be 'pending_student_review'; it is currently 'pending_registrar_approval'.",
              errors: {},
              request_id: "r-1",
            },
          }),
          { status: 422 },
        ),
      ),
    )
    renderWithSession(<EnrollmentRevisionReviewCard enrollment={enrollment()} />, { session: studentSession })

    await user.click(screen.getByRole("button", { name: "Accept the changes" }))

    expect(await screen.findByText(/currently 'pending_registrar_approval'/)).toBeInTheDocument()
  })
})

describe("EnrollmentReviewDialog (the Program Chair changes the subjects)", () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => vi.stubGlobal("fetch", fetchMock))
  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllGlobals()
  })

  const section = (id: number, subjectId: number, code: string) => ({
    type: "section", id, academic_term_id: 2, section_plan_id: null, subject_id: subjectId, section_code: code,
    professor_id: null, schedule_days: "MWF", starts_at_time: "08:00:00", ends_at_time: "09:00:00", room: "R1",
    capacity: 40, capacity_source: "plan", viability_threshold: null, enrolled_count: 0, remaining_seats: 40,
    is_block_exclusive: null, status: "published", status_label: "Published",
  })
  const subject = (id: number, code: string, title: string) => ({
    type: "subject", id, code, title, units: 3, status: "active", status_label: "Active", is_completion_only: false,
  })

  function mockReferenceData(onRevise: (body: unknown) => Response) {
    fetchMock.mockImplementation((input, init) => {
      const url = urlOf(input)
      if (init?.method === "PATCH") return Promise.resolve(onRevise(bodyOf(init)))
      if (url.includes("/sections"))
        return Promise.resolve(new Response(JSON.stringify({ data: [section(5, 1, "A"), section(6, 2, "B")] })))
      if (url.includes("/subjects"))
        return Promise.resolve(new Response(JSON.stringify({ data: [subject(1, "CS101", "Programming 1"), subject(2, "CS102", "Data Structures")] })))
      return Promise.resolve(new Response(JSON.stringify({ data: [] })))
    })
  }

  const awaitingChair = () =>
    enrollment({
      status: "pending_program_head_approval",
      status_label: "Pending Program Head Approval",
      revisions: [],
      subjects: [
        {
          section_id: 5, section_code: "A", subject_id: 1, subject_code: "CS101", paired_subject_id: null,
          subject_title: "Programming 1", units: 3, schedule_days: "MWF", starts_at_time: "08:00:00",
          ends_at_time: "09:00:00", room: "R1", modality: "f2f", professor_name: null, status: "selected", status_label: "Selected",
        },
      ],
    })

  async function addSubject(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole("combobox", { name: /Add a subject/i }))
    await user.click(await screen.findByRole("option", { name: /CS102/ }))
  }

  it("asks why before the changes go to the student, then sends the note", async () => {
    const user = userEvent.setup()
    const bodies: unknown[] = []
    mockReferenceData((body) => {
      bodies.push(body)
      return new Response(JSON.stringify({ data: enrollment() }))
    })
    renderWithSession(
      <EnrollmentReviewDialog enrollment={awaitingChair()} editable onOpenChange={vi.fn()} />,
      { session: chairSession },
    )

    await addSubject(user)
    await user.click(await screen.findByRole("button", { name: "Send changes to the student" }))

    // No reason yet: nothing is sent.
    expect(await screen.findByText("Tell the student why you are changing their subjects.")).toBeInTheDocument()
    expect(bodies).toHaveLength(0)

    await user.type(screen.getByLabelText("Why are you changing these subjects?"), "CS101 clashes with your other class.")
    await user.click(screen.getByRole("button", { name: "Send changes to the student" }))

    await waitFor(() =>
      expect(bodies[0]).toEqual({
        section_ids: [5, 6],
        note: "CS101 clashes with your other class.",
        overload_acknowledged: false,
      }),
    )
  })

  it("asks for the overload acknowledgement when the server requires it", async () => {
    const user = userEvent.setup()
    const bodies: Record<string, unknown>[] = []
    mockReferenceData((body) => {
      bodies.push(body as Record<string, unknown>)
      return bodies.length === 1
        ? new Response(
            JSON.stringify({
              error: {
                code: "VALIDATION_FAILED",
                message: "The submitted data is invalid.",
                errors: { overload_acknowledged: ["This schedule exceeds the regular unit load and requires explicit overload acknowledgement before it is sent to the student."] },
                request_id: "r-2",
              },
            }),
            { status: 422 },
          )
        : new Response(JSON.stringify({ data: enrollment() }))
    })
    renderWithSession(
      <EnrollmentReviewDialog enrollment={awaitingChair()} editable onOpenChange={vi.fn()} />,
      { session: chairSession },
    )

    await addSubject(user)
    await user.type(await screen.findByLabelText("Why are you changing these subjects?"), "Adding CS102 so you finish on time.")
    await user.click(screen.getByRole("button", { name: "Send changes to the student" }))

    const acknowledge = await screen.findByRole("checkbox", { name: /acknowledge this schedule exceeds/i })
    await user.click(acknowledge)
    await user.click(screen.getByRole("button", { name: "Send changes to the student" }))

    await waitFor(() => expect(bodies).toHaveLength(2))
    expect(bodies[1]).toMatchObject({ overload_acknowledged: true })
  })

  it("while the student is deciding, shows the history and no way to edit", () => {
    mockReferenceData(() => new Response("{}"))
    renderWithSession(
      <EnrollmentReviewDialog enrollment={enrollment()} onOpenChange={vi.fn()} />,
      { session: chairSession },
    )

    expect(screen.getByText(/Waiting for the student to accept or decline your changes/)).toBeInTheDocument()
    const history = screen.getByRole("region", { name: "Changes to the subjects" })
    expect(within(history).getByText(/CS101 clashes with your other class/)).toBeInTheDocument()
    expect(within(history).getByText("Waiting for the student")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Send changes to the student" })).not.toBeInTheDocument()
  })

  it("after a decline, shows the student's reason in the history", () => {
    mockReferenceData(() => new Response("{}"))
    const declined = enrollment({
      status: "pending_program_head_approval",
      status_label: "Pending Program Head Approval",
      revisions: [{ ...revision, status: "declined", student_reason: "I work on Tuesdays.", responded_at: "2026-10-03T03:00:00Z" }],
    })
    renderWithSession(<EnrollmentReviewDialog enrollment={declined} onOpenChange={vi.fn()} />, { session: chairSession })

    expect(screen.getByText("Why the student did not accept")).toBeInTheDocument()
    expect(screen.getByText("I work on Tuesdays.")).toBeInTheDocument()
  })
})

describe("ProgramChairIrregularEnrollmentsWorkspace and the student's answer", () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => vi.stubGlobal("fetch", fetchMock))
  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllGlobals()
  })

  const page = (rows: readonly unknown[]) =>
    new Response(
      JSON.stringify({
        data: rows,
        links: { first: "http://x/1", last: "http://x/1", prev: null, next: null },
        meta: { current_page: 1, last_page: 1, per_page: 20, total: rows.length },
      }),
    )

  it("shows why a student declined, right in the list of what awaits the Chair", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        page([
          enrollment({
            status: "pending_program_head_approval",
            status_label: "Pending Program Head Approval",
            revisions: [{ ...revision, status: "declined", student_reason: "CS102 meets when I work." }],
          }),
        ]),
      ),
    )
    renderWithSession(<ProgramChairIrregularEnrollmentsWorkspace />, { session: chairSession })

    // The list renders a table and a phone card for each row, so the line appears twice.
    expect(
      (await screen.findAllByText(/The student did not accept your changes: CS102 meets when I work\./)).length,
    ).toBeGreaterThan(0)
  })

  it("has a Waiting for Student list for the enrollments the Chair has sent back", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation(() => Promise.resolve(page([enrollment()])))
    renderWithSession(<ProgramChairIrregularEnrollmentsWorkspace />, { session: chairSession })
    await screen.findByRole("table")

    await user.click(screen.getByRole("button", { name: "Waiting for Student" }))

    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([input]) => urlOf(input).includes("status=pending_student_review"))).toBe(true),
    )
    // Read-only while the student decides: no Approve or Reject.
    const table = await screen.findByRole("table")
    expect(within(table).getByText("Awaiting Student Review")).toBeInTheDocument()
    expect(within(table).queryByRole("button", { name: "Approve" })).not.toBeInTheDocument()
  })
})
