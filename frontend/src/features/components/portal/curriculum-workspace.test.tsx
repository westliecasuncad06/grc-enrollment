import { screen, waitFor, within } from "@testing-library/react"
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
      is_completion_only: false,
    },
    {
      type: "subject",
      id: 12,
      code: "CS102",
      title: "Programming 2",
      units: 3,
      status: "active",
      status_label: "Active",
      is_completion_only: false,
    },
    {
      type: "subject",
      id: 13,
      code: "CS201",
      title: "Data Structures",
      units: 3,
      status: "active",
      status_label: "Active",
      is_completion_only: false,
    },
    {
      type: "subject",
      id: 14,
      code: "CS301",
      title: "Algorithms",
      units: 3,
      status: "active",
      status_label: "Active",
      is_completion_only: false,
    },
    {
      type: "subject",
      id: 15,
      code: "CS401",
      title: "Capstone",
      units: 3,
      status: "active",
      status_label: "Active",
      is_completion_only: false,
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
    // Every year level 1-4 carries a placement, so the final "Save Curriculum"
    // (mark active) button is enabled for this one and disabled for BSCS 2026.
    {
      type: "curriculum",
      id: 12,
      program_id: 1,
      name: "BSCS 2029",
      effective_school_year: "2029-2030",
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
        {
          subject_id: 13,
          code: "CS201",
          title: "Data Structures",
          year_level: 2,
          semester: "1st",
          is_required: true,
          prerequisites: [],
        },
        {
          subject_id: 14,
          code: "CS301",
          title: "Algorithms",
          year_level: 3,
          semester: "1st",
          is_required: true,
          prerequisites: [],
        },
        {
          subject_id: 15,
          code: "CS401",
          title: "Capstone",
          year_level: 4,
          semester: "2nd",
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

/**
 * The reference-data reads every test needs, with the create/replace response
 * left to the caller — the write path is what the autosave tests assert on.
 */
function mockApi(
  onWrite: (input: RequestInfo | URL, init?: RequestInit) => Response = () =>
    new Response(JSON.stringify({ data: curriculum.data[0] })),
) {
  return (input: RequestInfo | URL, init?: RequestInit) => {
    if (url(input).endsWith("/programs"))
      return Promise.resolve(new Response(JSON.stringify(programs)))
    if (url(input).endsWith("/subjects"))
      return Promise.resolve(new Response(JSON.stringify(subjects)))
    if (url(input).endsWith("/curricula") && init?.method !== "POST")
      return Promise.resolve(new Response(JSON.stringify(curriculum)))
    return Promise.resolve(onWrite(input, init))
  }
}

/** Opens a `Select` trigger (waiting for it to become enabled first) and picks an item. */
async function selectOption(
  user: ReturnType<typeof userEvent.setup>,
  labelText: string,
  optionName: string,
) {
  const trigger = screen.getByLabelText(labelText)
  await waitFor(() => expect(trigger).not.toBeDisabled())
  await user.click(trigger)
  await user.click(await screen.findByRole("option", { name: optionName }))
}

// Autosave debounces at 800ms, so every write assertion needs more headroom
// than Testing Library's 1s default.
const autosaveTimeout = { timeout: 4000 }

describe("CurriculumWorkspace", () => {
  const fetchMock = vi.fn<typeof fetch>()
  beforeEach(() => vi.stubGlobal("fetch", fetchMock))
  afterEach(() => vi.unstubAllGlobals())

  /** Every valid full-replace payload sent to `path`, oldest first. */
  const replacements = (path: string) =>
    fetchMock.mock.calls
      .filter(
        ([request, init]) =>
          url(request).endsWith(path) && init?.method === "PATCH",
      )
      .flatMap(([, init]) => {
        if (typeof init?.body !== "string") return []
        const parsed = curriculumReplacementSchema.safeParse(
          JSON.parse(init.body) as unknown,
        )
        return parsed.success ? [parsed.data] : []
      })

  it("shows a separate tab per year level with only code, description, units, semester, and prerequisites", async () => {
    fetchMock.mockImplementation(mockApi())
    renderWorkspace()

    await screen.findByRole("tab", { name: /1st year/i })
    expect(screen.getByRole("tab", { name: /2nd year/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /3rd year/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /4th year/i })).toBeInTheDocument()

    const table = await screen.findByRole("table")
    const headers = within(table)
      .getAllByRole("columnheader")
      .map((cell) => cell.textContent)
    expect(headers).toEqual([
      "Subject Code",
      "Description",
      "Units",
      "Semester",
      "Prerequisite",
    ])
  })

  it("shows each placement's catalog description and units read-only in its year tab", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation(mockApi())
    renderWorkspace()
    await screen.findByLabelText("Curriculum")
    await selectOption(user, "Curriculum", "BSCS 2029")

    const table = await screen.findByRole("table")
    // The combobox renders a visible input plus a hidden value input, so the
    // code matches more than once — presence is what matters here.
    expect(within(table).getAllByDisplayValue("CS101")).not.toHaveLength(0)
    expect(within(table).getByText("Programming 1")).toBeInTheDocument()
    expect(within(table).getByText("3")).toBeInTheDocument()
    // Year 2's placement belongs to the 2nd Year tab, not this one.
    expect(within(table).queryAllByDisplayValue("CS201")).toHaveLength(0)

    await user.click(screen.getByRole("tab", { name: "2nd Year" }))
    expect(
      within(await screen.findByRole("table")).getAllByDisplayValue("CS201"),
    ).not.toHaveLength(0)
  })

  it("autosaves an edited placement cell without a save button click", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation(mockApi())
    renderWorkspace()
    await screen.findByLabelText("Curriculum")
    await selectOption(user, "Curriculum", "BSCS 2026")
    await selectOption(user, "Semester for CS101", "2nd")

    await waitFor(
      () =>
        expect(
          replacements("/curricula/9").some((body) =>
            body.subjects.some(
              (subject) =>
                subject.subject_id === 11 && subject.semester === "2nd",
            ),
          ),
        ).toBe(true),
      autosaveTimeout,
    )
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Save curriculum" }),
    ).not.toBeInTheDocument()
  })

  it("places a subject into the active year tab and autosaves its metadata", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation(mockApi())
    renderWorkspace()
    await screen.findByLabelText("Curriculum")
    await selectOption(user, "Curriculum", "BSCS 2026")
    await user.click(screen.getByRole("tab", { name: "4th Year" }))
    await selectOption(user, "Subject to place", "CS102 — Programming 2")
    await user.click(
      screen.getByRole("button", { name: "Add subject placement" }),
    )
    await selectOption(user, "Semester for CS102", "2nd")

    await waitFor(
      () =>
        expect(
          replacements("/curricula/9").some((body) =>
            body.subjects.some(
              (subject) =>
                subject.subject_id === 12 &&
                subject.year_level === 4 &&
                subject.semester === "2nd" &&
                subject.is_required &&
                subject.prerequisites.length === 0,
            ),
          ),
        ).toBe(true),
      autosaveTimeout,
    )
  })

  it("adds a prerequisite from the placement row and autosaves the edge", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation(
      mockApi(() => new Response(JSON.stringify({ data: curriculum.data[2] }))),
    )
    renderWorkspace()
    await screen.findByLabelText("Curriculum")
    await selectOption(user, "Curriculum", "BSCS 2029")
    await user.click(screen.getByRole("tab", { name: "2nd Year" }))
    await selectOption(user, "Add prerequisite for CS201", "CS101")

    expect(
      within(await screen.findByRole("table")).getByText("CS101"),
    ).toBeInTheDocument()
    await waitFor(
      () =>
        expect(
          replacements("/curricula/12").some((body) =>
            body.subjects.some(
              (subject) =>
                subject.subject_id === 13 &&
                subject.prerequisites.some(
                  (edge) => edge.prerequisite_subject_id === 11,
                ),
            ),
          ),
        ).toBe(true),
      autosaveTimeout,
    )
  })

  it("shows a final Save Curriculum button once all four years have at least one subject", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation(mockApi())
    renderWorkspace()
    await screen.findByLabelText("Curriculum")
    await selectOption(user, "Curriculum", "BSCS 2029")

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Save Curriculum" }),
      ).toBeEnabled(),
    )
  })

  it("disables the final Save Curriculum button while a year level has no subjects yet", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation(mockApi())
    renderWorkspace()
    await screen.findByLabelText("Curriculum")
    await selectOption(user, "Curriculum", "BSCS 2026")

    await screen.findByRole("tab", { name: /1st year/i })
    expect(screen.getByRole("button", { name: "Save Curriculum" })).toBeDisabled()
  })

  it("marks the curriculum active from the final Save Curriculum button", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation(
      mockApi(() => new Response(JSON.stringify({ data: curriculum.data[2] }))),
    )
    renderWorkspace()
    await screen.findByLabelText("Curriculum")
    await selectOption(user, "Curriculum", "BSCS 2029")
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Save Curriculum" }),
      ).toBeEnabled(),
    )
    await user.click(screen.getByRole("button", { name: "Save Curriculum" }))

    await waitFor(() =>
      expect(
        replacements("/curricula/12").some((body) => body.status === "active"),
      ).toBe(true),
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
    await screen.findByLabelText("Curriculum")
    await selectOption(user, "Curriculum", "BSCS 2026")
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
    await screen.findByLabelText("Curriculum")
    await selectOption(user, "Curriculum", "BSCS 2026")
    await selectOption(user, "Subject to place", "CS102 — Programming 2")
    await user.click(
      screen.getByRole("button", { name: "Add subject placement" }),
    )
    await selectOption(user, "Subject to place", "CS102 — Programming 2")
    await user.click(
      screen.getByRole("button", { name: "Add subject placement" }),
    )
    expect(
      screen.getAllByText("This subject is already placed in this curriculum."),
    ).not.toHaveLength(0)
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
    await screen.findByLabelText("Curriculum")
    await selectOption(user, "Curriculum", "BSCS 2026")
    await user.clear(screen.getByLabelText("Curriculum name"))
    await user.type(screen.getByLabelText("Curriculum name"), "Keep this")
    await selectOption(user, "Curriculum", "BSCS 2027")
    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "Discard unsaved curriculum changes",
    )
    await user.click(screen.getByRole("button", { name: "Keep editing" }))
    expect(screen.getByLabelText("Curriculum")).toHaveTextContent("BSCS 2026")
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
    await screen.findByLabelText("Curriculum")
    await selectOption(user, "Curriculum", "BSCS 2026")
    await user.clear(screen.getByLabelText("Curriculum name"))
    await user.type(screen.getByLabelText("Curriculum name"), "Discard this")
    await selectOption(user, "Curriculum", "New curriculum")
    await user.click(screen.getByRole("button", { name: "Discard changes" }))
    expect(screen.getByLabelText("Curriculum")).toHaveTextContent(
      "New curriculum",
    )
    expect(screen.getByLabelText("Curriculum name")).toHaveValue("")
  })

  it("uses the created curriculum identity on the next autosave", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation((input, init) => {
      if (url(input).endsWith("/programs"))
        return Promise.resolve(new Response(JSON.stringify(programs)))
      if (url(input).endsWith("/subjects"))
        return Promise.resolve(new Response(JSON.stringify(subjects)))
      if (url(input).endsWith("/curricula") && init?.method !== "POST")
        return Promise.resolve(new Response(JSON.stringify({ data: [] })))
      return Promise.resolve(
        new Response(JSON.stringify({ data: curriculum.data[0] }), {
          status: init?.method === "POST" ? 201 : 200,
        }),
      )
    })
    renderWorkspace()
    await screen.findByLabelText("Program")
    await selectOption(user, "Program", "BSCS — Computer Science")
    await user.type(screen.getByLabelText("Curriculum name"), "New BSCS")
    await user.type(screen.getByLabelText("Effective school year"), "2026-2027")
    await selectOption(user, "Subject to place", "CS101 — Programming 1")
    await user.click(
      screen.getByRole("button", { name: "Add subject placement" }),
    )

    await waitFor(
      () =>
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining("/curricula"),
          expect.objectContaining({ method: "POST" }),
        ),
      autosaveTimeout,
    )
    await selectOption(user, "Semester for CS101", "2nd")
    await waitFor(
      () =>
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining("/curricula/9"),
          expect.objectContaining({ method: "PATCH" }),
        ),
      autosaveTimeout,
    )
    // Two sequential debounced writes plus the create/replace round trips run
    // past Vitest's 5s default.
  }, 20000)

  it("places the backend cycle rejection beside the prerequisite graph", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation(
      mockApi(
        () =>
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
      ),
    )
    renderWorkspace()
    await screen.findByLabelText("Curriculum")
    await selectOption(user, "Curriculum", "BSCS 2026")
    await selectOption(user, "Semester for CS101", "2nd")
    expect(
      await screen.findAllByText(
        "The submitted subjects contain a direct or transitive prerequisite cycle.",
        undefined,
        autosaveTimeout,
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
    await screen.findByLabelText("Curriculum")
    expect(await axe(container)).toHaveNoViolations()
  })
})
