import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { CurriculumWorkspace } from "@/features/components/portal/curriculum-workspace"
import { renderWithSession } from "@/tests/render-app"

const programs = {
  data: [
    {
      type: "program",
      id: 1,
      code: "BSCS",
      name: "Computer Science",
      status: "active",
      status_label: "Active",
    },
  ],
} as const
const subjects = {
  data: [
    {
      type: "subject",
      id: 11,
      code: "CS101",
      title: "Programming 1",
      units: 3,
      status: "active",
      status_label: "Active",
    },
  ],
} as const
const curriculum = {
  data: [
    {
      type: "curriculum",
      id: 9,
      program_id: 1,
      name: "BSCS 2026",
      effective_school_year: "2026-2027",
      status: "draft",
      status_label: "Draft",
      subjects: [
        {
          subject_id: 11,
          code: "CS101",
          title: "Programming 1",
          year_level: 1,
          semester: "1st",
          is_required: true,
          prerequisites: [],
        },
      ],
    },
  ],
} as const

function url(input: RequestInfo | URL) {
  if (typeof input === "string") return input
  return input instanceof URL ? input.toString() : input.url
}
function renderWorkspace() {
  return renderWithSession(<CurriculumWorkspace />, {
    session: {
      userId: "4",
      displayName: "Chair",
      role: "program_chair",
      signedInAt: "2026-07-29T12:00:00Z",
    },
  })
}

describe("CurriculumWorkspace", () => {
  const fetchMock = vi.fn<typeof fetch>()
  beforeEach(() => vi.stubGlobal("fetch", fetchMock))
  afterEach(() => vi.unstubAllGlobals())

  it("replaces a selected curriculum with the complete graph", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation((input, init) => {
      if (url(input).endsWith("/programs"))
        return Promise.resolve(new Response(JSON.stringify(programs)))
      if (url(input).endsWith("/subjects"))
        return Promise.resolve(new Response(JSON.stringify(subjects)))
      if (url(input).endsWith("/curricula") && init?.method !== "POST")
        return Promise.resolve(new Response(JSON.stringify(curriculum)))
      return Promise.resolve(
        new Response(JSON.stringify({ data: curriculum.data[0] })),
      )
    })
    renderWorkspace()
    await screen.findByRole("option", { name: "BSCS 2026" })
    await user.selectOptions(screen.getByLabelText("Curriculum"), "9")
    await user.click(screen.getByRole("button", { name: "Save curriculum" }))
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/curricula/9"),
      expect.objectContaining({ method: "PATCH" }),
    )
  })

  it("keeps unsaved work until the chair confirms discard", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation((input) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            url(input).endsWith("/programs")
              ? programs
              : url(input).endsWith("/subjects")
                ? subjects
                : curriculum,
          ),
        ),
      ),
    )
    renderWorkspace()
    await screen.findByRole("option", { name: "BSCS 2026" })
    await user.selectOptions(screen.getByLabelText("Curriculum"), "9")
    await user.clear(screen.getByLabelText("Curriculum name"))
    await user.type(screen.getByLabelText("Curriculum name"), "Changed")
    await user.click(screen.getByRole("button", { name: "New curriculum" }))
    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "Discard unsaved curriculum changes",
    )
    await user.click(screen.getByRole("button", { name: "Keep editing" }))
    expect(screen.getByLabelText("Curriculum name")).toHaveValue("Changed")
  })

  it("prevents a duplicate placement when every catalog subject is already placed", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation((input) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            url(input).endsWith("/programs")
              ? programs
              : url(input).endsWith("/subjects")
                ? subjects
                : curriculum,
          ),
        ),
      ),
    )
    renderWorkspace()
    await screen.findByRole("option", { name: "BSCS 2026" })
    await user.selectOptions(screen.getByLabelText("Curriculum"), "9")
    await user.click(
      screen.getByRole("button", { name: "Add subject placement" }),
    )
    expect(
      screen.getAllByText(
        "Each available subject is already placed in this curriculum.",
      ),
    ).not.toHaveLength(0)
  })

  it("places the backend cycle rejection beside the prerequisite graph", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation((input, init) => {
      if (url(input).endsWith("/programs"))
        return Promise.resolve(new Response(JSON.stringify(programs)))
      if (url(input).endsWith("/subjects"))
        return Promise.resolve(new Response(JSON.stringify(subjects)))
      if (url(input).endsWith("/curricula") && init?.method !== "POST")
        return Promise.resolve(new Response(JSON.stringify(curriculum)))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            error: {
              code: "VALIDATION_FAILED",
              message: "Invalid graph",
              errors: {
                subjects: [
                  "The submitted subjects contain a direct or transitive prerequisite cycle.",
                ],
              },
              request_id: "req-6",
            },
          }),
          { status: 422 },
        ),
      )
    })
    renderWorkspace()
    await screen.findByRole("option", { name: "BSCS 2026" })
    await user.selectOptions(screen.getByLabelText("Curriculum"), "9")
    await user.click(screen.getByRole("button", { name: "Save curriculum" }))
    expect(
      await screen.findAllByText(
        "The submitted subjects contain a direct or transitive prerequisite cycle.",
      ),
    ).not.toHaveLength(0)
  })
})
