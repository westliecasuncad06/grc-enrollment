import { screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { StudentQueuePaymentWorkspace } from "@/features/components/portal/student-queue-payment-workspace"
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

const enrollment = {
  type: "enrollment",
  id: 9,
  student_id: 4,
  student_number: "2026-0001",
  academic_term_id: 2,
  status: "pending_payment",
  status_label: "Pending Payment",
  total_units: 3,
  submitted_at: "2026-07-30T00:00:00Z",
  registrar_decided_at: "2026-07-30T00:00:00Z",
  payment_confirmed_at: null,
  enrolled_at: null,
  subjects: [],
  queue_ticket: {
    ticket_number: "Q000009",
    queue_date: "2026-07-30",
    status: "waiting",
    status_label: "Waiting",
  },
} as const

const pendingApprovalEnrollment = {
  ...enrollment,
  status: "pending_registrar_approval",
  status_label: "Pending Registrar Approval",
  registrar_decided_at: null,
  queue_ticket: null,
} as const

const studentSession = {
  userId: "4",
  displayName: "Student",
  role: "student",
  signedInAt: "2026-07-29T12:00:00Z",
} as const

describe("StudentQueuePaymentWorkspace", () => {
  const fetchMock = vi.fn<typeof fetch>()
  beforeEach(() => vi.stubGlobal("fetch", fetchMock))
  afterEach(() => vi.unstubAllGlobals())

  it("does not render for an unauthorized role", () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: [] })))
    renderWithSession(<StudentQueuePaymentWorkspace />, {
      session: {
        userId: "5",
        displayName: "Registrar Head",
        role: "registrar_head",
        signedInAt: "2026-07-29T12:00:00Z",
      },
    })
    expect(
      screen.getByText("This workspace is not available for your role."),
    ).toBeInTheDocument()
  })

  it("shows the student's queue ticket and enrollment status", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [enrollment],
          links: paginationLinks,
          meta: paginationMeta,
        }),
      ),
    )
    renderWithSession(<StudentQueuePaymentWorkspace />, {
      session: studentSession,
    })

    expect(await screen.findByText(/Q000009/)).toBeInTheDocument()
    expect(screen.getByText(/Pending Payment/)).toBeInTheDocument()
  })

  it("shows a waiting-for-approval message with no queue number before approval", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [pendingApprovalEnrollment],
          links: paginationLinks,
          meta: paginationMeta,
        }),
      ),
    )
    renderWithSession(<StudentQueuePaymentWorkspace />, {
      session: studentSession,
    })

    expect(
      await screen.findByText(/Waiting for registrar approval/),
    ).toBeInTheDocument()
  })

  it("has no detectable accessibility violations once loaded", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [enrollment],
          links: paginationLinks,
          meta: paginationMeta,
        }),
      ),
    )
    const { container } = renderWithSession(<StudentQueuePaymentWorkspace />, {
      session: studentSession,
    })

    await screen.findByText(/Q000009/)
    expect(await axe(container)).toHaveNoViolations()
  })
})
