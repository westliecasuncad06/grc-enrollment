import { act, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { RegistrarEnrollmentWorkspace } from "@/features/components/portal/registrar-enrollment-workspace"
import { renderWithSession } from "@/tests/render-app"

function url(input: RequestInfo | URL) {
  if (typeof input === "string") return input
  return input instanceof URL ? input.toString() : input.url
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
  total: 1,
}

const pendingApprovalEnrollment = {
  type: "enrollment",
  id: 9,
  student_id: 4,
  student_number: "2026-0001",
  student_name: "Test Student",
  student_year_level: 1,
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
  subjects: [],
  queue_ticket: null,
  assessment: null,
} as const

const pendingPaymentEnrollment = {
  ...pendingApprovalEnrollment,
  id: 10,
  status: "pending_payment",
  status_label: "Pending Payment",
} as const

const overloadFlaggedEnrollment = {
  ...pendingApprovalEnrollment,
  id: 11,
  total_units: 24,
  requires_overload_approval: true,
} as const

const registrarStaffSession = {
  userId: "6",
  displayName: "Registrar Staff",
  role: "registrar_staff",
  signedInAt: "2026-07-29T12:00:00Z",
} as const

const registrarHeadSession = {
  userId: "5",
  displayName: "Registrar Head",
  role: "registrar_head",
  signedInAt: "2026-07-29T12:00:00Z",
} as const

describe("RegistrarEnrollmentWorkspace", () => {
  const fetchMock = vi.fn<typeof fetch>()
  beforeEach(() => vi.stubGlobal("fetch", fetchMock))
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it("does not render the approvals queue for an unauthorized role", () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [],
          links: paginationLinks,
          meta: paginationMeta,
        }),
      ),
    )
    renderWithSession(
      <RegistrarEnrollmentWorkspace initialModuleId="enrollment-approvals" />,
      {
        session: {
          userId: "1",
          displayName: "Student",
          role: "student",
          signedInAt: "2026-07-29T12:00:00Z",
        },
      },
    )
    expect(
      screen.getByText("This workspace is not available for your role."),
    ).toBeInTheDocument()
  })

  it("no longer lets a Registrar Head open the approvals queue (moved to Registrar Staff)", () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [],
          links: paginationLinks,
          meta: paginationMeta,
        }),
      ),
    )
    renderWithSession(
      <RegistrarEnrollmentWorkspace initialModuleId="enrollment-approvals" />,
      { session: registrarHeadSession },
    )
    expect(
      screen.getByText("This workspace is not available for your role."),
    ).toBeInTheDocument()
  })

  it("does not let Registrar Staff open the overrides & voids queue", () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [],
          links: paginationLinks,
          meta: paginationMeta,
        }),
      ),
    )
    renderWithSession(
      <RegistrarEnrollmentWorkspace initialModuleId="overrides-voids" />,
      { session: registrarStaffSession },
    )
    expect(
      screen.getByText("This workspace is not available for your role."),
    ).toBeInTheDocument()
  })

  it("offers approve/reject to Registrar Staff on the approvals queue, filtered by status", async () => {
    fetchMock.mockImplementation((input) =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            data: [pendingApprovalEnrollment],
            links: paginationLinks,
            meta: paginationMeta,
          }),
        ),
      ).then((response) => {
        expect(url(input)).toContain("status=pending_registrar_approval")
        return response
      }),
    )
    renderWithSession(
      <RegistrarEnrollmentWorkspace initialModuleId="enrollment-approvals" />,
      { session: registrarStaffSession },
    )

    const table = await screen.findByRole("table", { name: "Enrollment queue" })
    expect(within(table).getByText("#9")).toBeInTheDocument()
    expect(
      within(table).getByRole("button", { name: "Approve" }),
    ).toBeInTheDocument()
    expect(
      within(table).getByRole("button", { name: "Reject" }),
    ).toBeInTheDocument()
    expect(
      within(table).queryByRole("button", { name: "Void" }),
    ).not.toBeInTheDocument()
  })

  it("shows the student's financial status as a badge when set", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              ...pendingApprovalEnrollment,
              student_financial_status: "payee",
              student_financial_status_label: "Payee",
            },
          ],
          links: paginationLinks,
          meta: paginationMeta,
        }),
      ),
    )
    renderWithSession(
      <RegistrarEnrollmentWorkspace initialModuleId="enrollment-approvals" />,
      { session: registrarStaffSession },
    )

    const table = await screen.findByRole("table", { name: "Enrollment queue" })
    expect(within(table).getByText("Payee")).toBeInTheDocument()
  })

  it("reviews a student's chosen subjects in the student-style schedule table", async () => {
    const user = userEvent.setup()
    const enrollmentWithSubjects = {
      ...pendingApprovalEnrollment,
      total_units: 3,
      subjects: [
        {
          section_id: 55,
          subject_code: "CS101",
          subject_title: "Programming 1",
          status: "selected",
          status_label: "Selected",
        },
      ],
    }
    fetchMock.mockImplementation((input) => {
      const target = url(input)
      if (target.includes("/sections"))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: [
                {
                  type: "section",
                  id: 55,
                  academic_term_id: 2,
                  subject_id: 7,
                  section_code: "A",
                  professor_id: null,
                  schedule_days: "MWF",
                  starts_at_time: "08:00:00",
                  ends_at_time: "09:00:00",
                  room: "RM-101",
                  capacity: 40,
                  capacity_source: "manual",
                  viability_threshold: null,
                  enrolled_count: 1,
                  remaining_seats: 39,
                  is_block_exclusive: null,
                  status: "published",
                  status_label: "Published",
                },
              ],
            }),
          ),
        )
      if (target.includes("/subjects"))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: [
                {
                  type: "subject",
                  id: 7,
                  code: "CS101",
                  title: "Programming 1",
                  units: 3,
                  status: "active",
                  status_label: "Active",
                  is_completion_only: false,
                },
              ],
            }),
          ),
        )
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: [enrollmentWithSubjects],
            links: paginationLinks,
            meta: paginationMeta,
          }),
        ),
      )
    })
    renderWithSession(
      <RegistrarEnrollmentWorkspace initialModuleId="enrollment-approvals" />,
      { session: registrarStaffSession },
    )

    const table = await screen.findByRole("table", { name: "Enrollment queue" })
    await user.click(within(table).getByRole("button", { name: "Review" }))
    const dialog = await screen.findByRole("dialog")
    const scheduleTable = within(dialog).getByRole("table", {
      name: "Enrollment #9 schedule",
    })
    expect(within(dialog).getByText("Name")).toBeInTheDocument()
    expect(within(dialog).getByText("Test Student")).toBeInTheDocument()
    expect(within(dialog).getByText("Year")).toBeInTheDocument()
    expect(within(dialog).getByText("Year 1")).toBeInTheDocument()
    expect(within(dialog).getByText("Student number")).toBeInTheDocument()
    expect(within(dialog).getByText("2026-0001")).toBeInTheDocument()
    expect(
      within(scheduleTable)
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual([
      "Subject code",
      "Description",
      "Units",
      "Section ID",
      "Day",
      "Time",
      "Room",
    ])
    expect(within(scheduleTable).getByText("CS101")).toBeInTheDocument()
    expect(within(scheduleTable).getByText("Programming 1")).toBeInTheDocument()
    expect(within(scheduleTable).getByText("3")).toBeInTheDocument()
    expect(within(scheduleTable).getByText("55")).toBeInTheDocument()
    expect(within(scheduleTable).getByText("MWF")).toBeInTheDocument()
    expect(within(scheduleTable).getByText("08:00–09:00")).toBeInTheDocument()
    expect(within(scheduleTable).getByText("RM-101")).toBeInTheDocument()
  })

  it("refreshes the approvals queue when a student submits without a page reload", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let submitted = false
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            data: submitted ? [pendingApprovalEnrollment] : [],
            links: paginationLinks,
            meta: paginationMeta,
          }),
        ),
      ),
    )

    renderWithSession(
      <RegistrarEnrollmentWorkspace initialModuleId="enrollment-approvals" />,
      { session: registrarStaffSession },
    )

    expect(
      await screen.findByText("No enrollments match this queue."),
    ).toBeInTheDocument()

    submitted = true
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000)
    })

    const table = await screen.findByRole("table", { name: "Enrollment queue" })
    expect(within(table).getByText("#9")).toBeInTheDocument()
  })

  it("offers void to Registrar Head on the overrides & voids queue, filtered by status", async () => {
    fetchMock.mockImplementation((input) =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            data: [pendingPaymentEnrollment],
            links: paginationLinks,
            meta: paginationMeta,
          }),
        ),
      ).then((response) => {
        expect(url(input)).toContain("status=pending_payment")
        return response
      }),
    )
    renderWithSession(
      <RegistrarEnrollmentWorkspace initialModuleId="overrides-voids" />,
      { session: registrarHeadSession },
    )

    const table = await screen.findByRole("table", { name: "Enrollment queue" })
    expect(within(table).getByText("#10")).toBeInTheDocument()
    expect(
      within(table).getByRole("button", { name: "Void" }),
    ).toBeInTheDocument()
    expect(
      within(table).queryByRole("button", { name: "Approve" }),
    ).not.toBeInTheDocument()
  })

  it("requires a reason before confirming a rejection", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation((_input, init) => {
      if (init?.method === "PATCH")
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: { ...pendingApprovalEnrollment, status: "rejected" },
            }),
          ),
        )
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: [pendingApprovalEnrollment],
            links: paginationLinks,
            meta: paginationMeta,
          }),
        ),
      )
    })
    renderWithSession(
      <RegistrarEnrollmentWorkspace initialModuleId="enrollment-approvals" />,
      { session: registrarStaffSession },
    )

    const table = await screen.findByRole("table", { name: "Enrollment queue" })
    await user.click(within(table).getByRole("button", { name: "Reject" }))
    expect(
      screen.getByRole("button", { name: "Confirm decision" }),
    ).toBeDisabled()
    await user.type(screen.getByLabelText("Reason"), "Missing prerequisite.")
    await user.click(screen.getByRole("button", { name: "Confirm decision" }))

    await vi.waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/enrollments/9"),
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            action: "registrar_reject",
            reason: "Missing prerequisite.",
          }),
        }),
      ),
    )
  })

  it("requires acknowledgement before approving an overload-flagged enrollment", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation((_input, init) => {
      if (init?.method === "PATCH")
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: { ...overloadFlaggedEnrollment, status: "pending_payment" },
            }),
          ),
        )
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: [overloadFlaggedEnrollment],
            links: paginationLinks,
            meta: paginationMeta,
          }),
        ),
      )
    })
    renderWithSession(
      <RegistrarEnrollmentWorkspace initialModuleId="enrollment-approvals" />,
      { session: registrarStaffSession },
    )

    const table = await screen.findByRole("table", { name: "Enrollment queue" })
    expect(within(table).getByText("Overload")).toBeInTheDocument()
    await user.click(within(table).getByRole("button", { name: "Approve" }))

    expect(
      screen.getByRole("button", { name: "Confirm decision" }),
    ).toBeDisabled()

    await user.click(
      screen.getByRole("checkbox", {
        name: /I acknowledge this enrollment exceeds/,
      }),
    )
    await user.click(screen.getByRole("button", { name: "Confirm decision" }))

    await vi.waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/enrollments/11"),
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            action: "registrar_approve",
            overload_acknowledged: true,
          }),
        }),
      ),
    )
  })

  it("does not require acknowledgement for an enrollment that was never flagged", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation((_input, init) => {
      if (init?.method === "PATCH")
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: { ...pendingApprovalEnrollment, status: "pending_payment" },
            }),
          ),
        )
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: [pendingApprovalEnrollment],
            links: paginationLinks,
            meta: paginationMeta,
          }),
        ),
      )
    })
    renderWithSession(
      <RegistrarEnrollmentWorkspace initialModuleId="enrollment-approvals" />,
      { session: registrarStaffSession },
    )

    const table = await screen.findByRole("table", { name: "Enrollment queue" })
    expect(within(table).queryByText("Overload")).not.toBeInTheDocument()
    await user.click(within(table).getByRole("button", { name: "Approve" }))

    expect(
      screen.getByRole("button", { name: "Confirm decision" }),
    ).not.toBeDisabled()
  })

  it("renders a complete phone-sized approval card with review and decision actions", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              ...overloadFlaggedEnrollment,
              student_financial_status: "scholar",
              student_financial_status_label: "Scholar",
            },
          ],
          links: paginationLinks,
          meta: paginationMeta,
        }),
      ),
    )
    renderWithSession(
      <RegistrarEnrollmentWorkspace initialModuleId="enrollment-approvals" />,
      { session: registrarStaffSession },
    )

    const card = await screen.findByRole("article", {
      name: "Enrollment #11",
    })
    expect(within(card).getByText("2026-0001")).toBeInTheDocument()
    expect(within(card).getByText("Scholar")).toBeInTheDocument()
    expect(within(card).getByText("24 units")).toBeInTheDocument()
    expect(within(card).getByText("Overload")).toBeInTheDocument()
    expect(
      within(card).getByRole("button", { name: "Review" }),
    ).toBeInTheDocument()
    expect(
      within(card).getByRole("button", { name: "Approve" }),
    ).toBeInTheDocument()
    expect(
      within(card).getByRole("button", { name: "Reject" }),
    ).toBeInTheDocument()
  })

  it("has no detectable accessibility violations once loaded", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [pendingApprovalEnrollment],
          links: paginationLinks,
          meta: paginationMeta,
        }),
      ),
    )
    const { container } = renderWithSession(
      <RegistrarEnrollmentWorkspace initialModuleId="enrollment-approvals" />,
      { session: registrarStaffSession },
    )

    await screen.findByRole("table", { name: "Enrollment queue" })
    expect(await axe(container)).toHaveNoViolations()
  })
})
