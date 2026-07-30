import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { CurriculumWorkspace } from "@/features/components/portal/curriculum-workspace"
import { curriculumReplacementSchema } from "@/features/schemas/curriculum-schema"
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
    {
      type: "subject",
      id: 12,
      code: "CS102",
      title: "Programming 2",
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
    {
      type: "curriculum",
      id: 10,
      program_id: 1,
      name: "BSCS 2027",
      effective_school_year: "2027-2028",
      status: "draft",
      status_label: "Draft",
      subjects: [],
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

  it("prevents a duplicate placement", async () => {
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
    await user.selectOptions(screen.getByLabelText("Subject to place"), "12")
    await user.click(
      screen.getByRole("button", { name: "Add subject placement" }),
    )
    await user.selectOptions(screen.getByLabelText("Subject to place"), "12")
    await user.click(
      screen.getByRole("button", { name: "Add subject placement" }),
    )
    expect(
      screen.getAllByText("This subject is already placed in this curriculum."),
    ).not.toHaveLength(0)
  })

  it("requires a chosen catalog subject and sends edited placement metadata", async () => {
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
    await user.selectOptions(screen.getByLabelText("Subject to place"), "12")
    await user.click(
      screen.getByRole("button", { name: "Add subject placement" }),
    )
    await user.selectOptions(
      screen.getByLabelText("Placement 12 year level"),
      "4",
    )
    await user.selectOptions(
      screen.getByLabelText("Placement 12 semester"),
      "3rd",
    )
    await user.click(screen.getByLabelText("Placement 12 is required"))
    await user.click(screen.getByRole("button", { name: "Save curriculum" }))

    const patch = fetchMock.mock.calls.find(
      ([request, init]) =>
        url(request).endsWith("/curricula/9") && init?.method === "PATCH",
    )
    if (!patch || typeof patch[1]?.body !== "string") {
      throw new Error("Expected a curriculum replacement request.")
    }
    const payload = curriculumReplacementSchema.safeParse(
      JSON.parse(patch[1].body),
    )
    if (!payload.success) {
      throw new Error("Expected a valid curriculum replacement request.")
    }
    expect(payload.data.subjects).toContainEqual({
      subject_id: 12,
      year_level: 4,
      semester: "3rd",
      is_required: false,
      prerequisites: [],
    })
  })

  it("keeps the selected curriculum and edits when a switch is cancelled", async () => {
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
    await user.type(screen.getByLabelText("Curriculum name"), "Keep this")
    await user.selectOptions(screen.getByLabelText("Curriculum"), "10")
    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "Discard unsaved curriculum changes",
    )
    await user.click(screen.getByRole("button", { name: "Keep editing" }))
    expect(screen.getByLabelText("Curriculum")).toHaveValue("9")
    expect(screen.getByLabelText("Curriculum name")).toHaveValue("Keep this")
  })

  it("resets the form after confirming a selector switch to new", async () => {
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
    await user.type(screen.getByLabelText("Curriculum name"), "Discard this")
    await user.selectOptions(screen.getByLabelText("Curriculum"), "0")
    await user.click(screen.getByRole("button", { name: "Discard changes" }))
    expect(screen.getByLabelText("Curriculum")).toHaveValue("0")
    expect(screen.getByLabelText("Curriculum name")).toHaveValue("")
  })

  it("uses the created curriculum identity on the next save", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation((input, init) => {
      if (url(input).endsWith("/programs"))
        return Promise.resolve(new Response(JSON.stringify(programs)))
      if (url(input).endsWith("/subjects"))
        return Promise.resolve(new Response(JSON.stringify(subjects)))
      if (url(input).endsWith("/curricula") && init?.method === "GET")
        return Promise.resolve(new Response(JSON.stringify({ data: [] })))
      return Promise.resolve(
        new Response(JSON.stringify({ data: curriculum.data[0] }), {
          status: init?.method === "POST" ? 201 : 200,
        }),
      )
    })
    renderWorkspace()
    await screen.findByRole("option", { name: "BSCS — Computer Science" })
    await user.selectOptions(screen.getByLabelText("Program"), "1")
    await user.type(screen.getByLabelText("Curriculum name"), "New BSCS")
    await user.type(screen.getByLabelText("Effective school year"), "2026-2027")
    await user.click(screen.getByRole("button", { name: "Save curriculum" }))
    await user.click(screen.getByRole("button", { name: "Save curriculum" }))
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/curricula/9"),
      expect.objectContaining({ method: "PATCH" }),
    )
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

  it("has no detectable accessibility violations once loaded", async () => {
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
    const { container } = renderWorkspace()
    await screen.findByRole("option", { name: "BSCS 2026" })
    expect(await axe(container)).toHaveNoViolations()
  })
})
