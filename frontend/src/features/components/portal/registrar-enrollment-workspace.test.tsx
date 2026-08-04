import { screen, within } from "@testing-library/react"
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
  afterEach(() => vi.unstubAllGlobals())

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
        expect(url(input)).toContain('status=pending_registrar_approval')
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
        expect(url(input)).toContain('status=pending_payment')
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
