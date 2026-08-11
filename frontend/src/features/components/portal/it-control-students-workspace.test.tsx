import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { ItControlStudentsWorkspace } from "@/features/components/portal/it-control-students-workspace"
import { renderWithSession } from "@/tests/render-app"

const students = {
  data: [
    {
      type: "it-control-student-account",
      id: 12,
      user_id: 32,
      student_number: "2026-08-30001",
      name: "Avery Student",
      email: "avery.student@grc.test",
      program_code: "BSCS",
      college: "ccs",
      year_level: 3,
      enrollment_category: "irregular",
      academic_standing: "good",
      status: "active",
      current_term_enrollment_status: "pending_payment",
      password_hint: "password",
    },
  ],
  links: {
    first: "https://api.test/it-control/students?page=1",
    last: "https://api.test/it-control/students?page=1",
    prev: null,
    next: null,
  },
  meta: {
    current_page: 1,
    from: 1,
    last_page: 1,
    links: [
      {
        url: null,
        label: "&laquo; Previous",
        active: false,
      },
      {
        url: "https://api.test/it-control/students?page=1",
        label: "1",
        active: true,
      },
      { url: null, label: "Next &raquo;", active: false },
    ],
    path: "https://api.test/it-control/students",
    per_page: 20,
    to: 1,
    total: 1,
  },
} as const

function renderWorkspace(role: "it_admin" | "registrar_head" = "it_admin") {
  return renderWithSession(<ItControlStudentsWorkspace />, {
    session: {
      userId: "it-1",
      displayName: "IT Control",
      role,
      signedInAt: "2026-08-11T00:00:00Z",
    },
  })
}

describe("ItControlStudentsWorkspace", () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock)
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify(students))),
    )
  })

  afterEach(() => vi.unstubAllGlobals())

  it("sends the applied student account filters in the fetch URL", async () => {
    const user = userEvent.setup()
    renderWorkspace()

    await screen.findAllByText("Avery Student")
    await user.type(screen.getByLabelText("Search student accounts"), "Avery")
    await user.click(screen.getByRole("combobox", { name: "College" }))
    await user.click(
      screen.getByRole("option", { name: "College of Computer Studies" }),
    )
    await user.click(screen.getByRole("combobox", { name: "Year level" }))
    await user.click(screen.getByRole("option", { name: "3rd Year" }))
    await user.click(
      screen.getByRole("combobox", { name: "Enrollment category" }),
    )
    await user.click(screen.getByRole("option", { name: "Irregular" }))
    await user.click(
      screen.getByRole("button", { name: "Apply student filters" }),
    )

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        expect.stringContaining(
          "/api/v1/it-control/students?q=Avery&college=ccs&year_level=3&enrollment_category=irregular&page=1&per_page=20",
        ),
        expect.anything(),
      ),
    )
    expect(
      screen.getAllByRole("button", { name: "Copy email for Avery Student" }),
    ).not.toHaveLength(0)
  })

  it("renders the current-term enrollment status returned by the account API", async () => {
    renderWorkspace()

    expect(
      await screen.findByRole("columnheader", { name: "Current enrollment" }),
    ).toBeInTheDocument()
    expect(screen.getAllByText("Pending payment")).not.toHaveLength(0)
  })

  it("renders the role guard without fetching student accounts for an unauthorized role", () => {
    renderWorkspace("registrar_head")

    expect(
      screen.getByText("This workspace is not available for your role."),
    ).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("has no detectable accessibility violations once student accounts load", async () => {
    const { container } = renderWorkspace()

    await screen.findAllByText("Avery Student")
    expect(await axe(container)).toHaveNoViolations()
  })
})
