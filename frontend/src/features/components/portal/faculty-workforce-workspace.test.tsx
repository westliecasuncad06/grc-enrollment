import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { FacultyWorkforceWorkspace } from "@/features/components/portal/faculty-workforce-workspace"
import { renderWithSession } from "@/tests/render-app"

const facultyCcs = {
  data: [
    {
      type: "faculty_member",
      id: 12,
      name: "Prof. Reyes",
      college: "ccs",
      status: "active",
      status_label: "Active",
      employment_type: "full_time",
      employment_type_label: "Full-time",
      planning_unit_reference: 33,
      is_assignable: true,
    },
  ],
} as const

const facultyAllColleges = {
  data: [
    ...facultyCcs.data,
    {
      type: "faculty_member",
      id: 40,
      name: "Prof. Santos",
      college: "coe",
      status: "active",
      status_label: "Active",
      employment_type: "part_time",
      employment_type_label: "Part-time",
      planning_unit_reference: null,
      is_assignable: true,
    },
  ],
} as const

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input
  return input instanceof URL ? input.toString() : input.url
}

function mockFetch(
  fetchMock: ReturnType<typeof vi.fn<typeof fetch>>,
  facultyPayload: unknown,
) {
  fetchMock.mockImplementation((input) => {
    const url = requestUrl(input)
    const body = url.includes("/faculty-members")
      ? facultyPayload
      : url.includes("/faculty-specializations")
        ? { data: [] }
        : { data: [] }
    return Promise.resolve(new Response(JSON.stringify(body)))
  })
}

describe("FacultyWorkforceWorkspace", () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => vi.stubGlobal("fetch", fetchMock))
  afterEach(() => vi.unstubAllGlobals())

  it("lets a Program Chair search the roster, open a professor, and edit their workforce profile", async () => {
    mockFetch(fetchMock, facultyCcs)
    const user = userEvent.setup()
    renderWithSession(<FacultyWorkforceWorkspace />, {
      session: {
        userId: "chair-1",
        displayName: "Program Chair",
        role: "program_chair",
        college: "ccs",
        signedInAt: "2026-08-09T00:00:00Z",
      },
    })

    await user.type(
      await screen.findByLabelText("Search faculty by name"),
      "Reyes",
    )
    expect(await screen.findByText("Prof. Reyes")).toBeInTheDocument()

    await user.click(screen.getByText("Prof. Reyes"))
    const dialog = await screen.findByRole("dialog", { name: "Prof. Reyes" })
    expect(within(dialog).getByLabelText("Account status")).toBeInTheDocument()
    expect(
      within(dialog).queryByText("You have read-only access."),
    ).not.toBeInTheDocument()
  })

  it("gives Registrar Head a read-only view with a college filter and no edit access", async () => {
    mockFetch(fetchMock, facultyAllColleges)
    const user = userEvent.setup()
    renderWithSession(<FacultyWorkforceWorkspace />, {
      session: {
        userId: "registrar-1",
        displayName: "Registrar Head",
        role: "registrar_head",
        college: null,
        signedInAt: "2026-08-09T00:00:00Z",
      },
    })

    expect(await screen.findByText("Prof. Reyes")).toBeInTheDocument()
    expect(screen.getByText("Prof. Santos")).toBeInTheDocument()
    expect(screen.getByLabelText("College")).toBeInTheDocument()

    await user.click(screen.getByText("Prof. Santos"))
    const dialog = await screen.findByRole("dialog", { name: "Prof. Santos" })
    expect(
      within(dialog).queryByLabelText("Account status"),
    ).not.toBeInTheDocument()
    expect(
      within(dialog).getByText("You have read-only access."),
    ).toBeInTheDocument()
  })
})
