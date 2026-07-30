import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { RegistrarEnrollmentWorkspace } from "@/features/components/portal/registrar-enrollment-workspace"
import { renderWithSession } from "@/tests/render-app"

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
  submitted_at: "2026-07-30T00:00:00Z",
  registrar_decided_at: null,
  payment_confirmed_at: null,
  enrolled_at: null,
  subjects: [],
  queue_ticket: null,
} as const

const pendingPaymentEnrollment = {
  ...pendingApprovalEnrollment,
  id: 10,
  status: "pending_payment",
  status_label: "Pending Payment",
} as const

const registrarSession = {
  userId: "5",
  displayName: "Registrar Head",
  role: "registrar_head",
  signedInAt: "2026-07-29T12:00:00Z",
} as const

describe("RegistrarEnrollmentWorkspace", () => {
  const fetchMock = vi.fn<typeof fetch>()
  beforeEach(() => vi.stubGlobal("fetch", fetchMock))
  afterEach(() => vi.unstubAllGlobals())

  it("does not render the queue for an unauthorized role", () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [],
          links: paginationLinks,
          meta: paginationMeta,
        }),
      ),
    )
    renderWithSession(<RegistrarEnrollmentWorkspace />, {
      session: {
        userId: "1",
        displayName: "Student",
        role: "student",
        signedInAt: "2026-07-29T12:00:00Z",
      },
    })
    expect(
      screen.getByText("This workspace is not available for your role."),
    ).toBeInTheDocument()
  })

  it("offers approve/reject for a pending-approval enrollment and void for a pending-payment one", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [pendingApprovalEnrollment, pendingPaymentEnrollment],
          links: paginationLinks,
          meta: { ...paginationMeta, total: 2 },
        }),
      ),
    )
    renderWithSession(<RegistrarEnrollmentWorkspace />, {
      session: registrarSession,
    })

    expect(await screen.findByText(/Enrollment #9/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Void" })).toBeInTheDocument()
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
    renderWithSession(<RegistrarEnrollmentWorkspace />, {
      session: registrarSession,
    })

    await user.click(await screen.findByRole("button", { name: "Reject" }))
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
})
