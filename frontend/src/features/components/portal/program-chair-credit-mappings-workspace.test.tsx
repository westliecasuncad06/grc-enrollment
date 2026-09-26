import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { ProgramChairCreditMappingsWorkspace } from "@/features/components/portal/program-chair-credit-mappings-workspace"
import { renderWithSession } from "@/tests/render-app"

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input
  return input instanceof URL ? input.toString() : input.url
}

const chairSession = {
  userId: "12",
  displayName: "Prof. Chair",
  role: "program_chair" as const,
  signedInAt: "2026-09-24T00:00:00Z",
}

function paginated(entries: unknown[]) {
  return {
    data: entries,
    links: { first: "http://x/1", last: "http://x/1", prev: null, next: null },
    meta: {
      current_page: 1,
      last_page: 1,
      per_page: 20,
      total: entries.length,
    },
  }
}

const pendingCredit = {
  type: "transferee_credit",
  id: 7,
  student_id: 30,
  student_number: "2026-0002",
  student_name: "Maria Santos",
  source_institution: "Technological Institute of the Philippines",
  source_subject_code: "CS 101",
  source_subject_title: "Intro to Computing",
  source_grade: "1.50",
  credited_units: 3,
  source_school_year: "2023-2024",
  source_semester: "1st",
  subject_id: null,
  subject_code: null,
  subject_title: null,
  requested_by_student: true,
  status: "pending",
  status_label: "Pending",
  endorsed_at: null,
  processed_at: null,
  created_at: "2026-09-01T00:00:00Z",
}

const endorsedCredit = {
  ...pendingCredit,
  id: 8,
  student_name: "Juan Dela Cruz",
  student_number: "2026-0003",
  source_subject_title: "Statistics",
  subject_id: 11,
  subject_code: "MATH201",
  subject_title: "Statistics and Probability",
  status: "endorsed",
  status_label: "Endorsed",
  endorsed_at: "2026-09-02T00:00:00Z",
}

const suggestions = [
  {
    type: "credit_subject_suggestion",
    subject_id: 10,
    subject_code: "CS101",
    subject_title: "Introduction to Computing",
    units: 3,
    year_level: 1,
    semester: "1st",
    score: 1,
    reasons: ["Same subject code", "Same title", "Same units"],
  },
  {
    type: "credit_subject_suggestion",
    subject_id: 12,
    subject_code: "CS105",
    subject_title: "Introduction to Computing Systems",
    units: 3,
    year_level: 1,
    semester: "2nd",
    score: 0.5,
    reasons: ["Similar title (80% match)", "Same units"],
  },
]

const subjects = [
  { code: "CS101", title: "Introduction to Computing", id: 10 },
  { code: "CS105", title: "Introduction to Computing Systems", id: 12 },
  { code: "MATH101", title: "College Algebra", id: 13 },
].map((subject) => ({
  type: "subject",
  ...subject,
  units: 3,
  status: "active",
  status_label: "Active",
  is_completion_only: false,
}))

interface Recorded {
  patches: unknown[]
  posts: unknown[]
}

function mockRoutes(
  recorded: Recorded,
  overrides: { patchResponse?: () => Response; pending?: unknown[] } = {},
) {
  return (input: RequestInfo | URL, init?: RequestInit) => {
    const url = requestUrl(input)
    const method = init?.method ?? "GET"

    if (url.includes("/suggestions")) {
      return Promise.resolve(
        new Response(JSON.stringify({ data: suggestions })),
      )
    }
    if (url.includes("/transferee-credits") && method === "PATCH") {
      recorded.patches.push(JSON.parse(init?.body as string))
      return Promise.resolve(
        overrides.patchResponse?.() ??
          new Response(
            JSON.stringify({
              data: {
                ...pendingCredit,
                subject_id: 10,
                subject_code: "CS101",
                status: "endorsed",
                status_label: "Endorsed",
              },
            }),
          ),
      )
    }
    if (url.includes("/transferee-credits") && method === "POST") {
      recorded.posts.push(JSON.parse(init?.body as string))
      return Promise.resolve(
        new Response(JSON.stringify({ data: pendingCredit }), { status: 201 }),
      )
    }
    if (
      url.includes("/transferee-credits") &&
      url.includes("status=endorsed")
    ) {
      return Promise.resolve(
        new Response(JSON.stringify(paginated([endorsedCredit]))),
      )
    }
    if (url.includes("/transferee-credits")) {
      return Promise.resolve(
        new Response(
          JSON.stringify(paginated(overrides.pending ?? [pendingCredit])),
        ),
      )
    }
    if (url.includes("/academic-record/students")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: [
              {
                type: "academic_record_student",
                id: 30,
                student_id: 30,
                student_number: "2026-0002",
                name: "Maria Santos",
                first_name: "Maria",
                last_name: "Santos",
                email: "maria.santos@grc.com",
                program_code: "BSIT",
                program_name: "BS Information Technology",
                year_level: 2,
                enrollment_category: "regular",
                enrollment_category_label: "Regular",
                academic_standing: "good",
                academic_standing_label: "Good standing",
              },
            ],
          }),
        ),
      )
    }
    if (url.includes("/subjects")) {
      return Promise.resolve(new Response(JSON.stringify({ data: subjects })))
    }
    return Promise.resolve(new Response(JSON.stringify({ data: [] })))
  }
}

/** Opens the review of the first request in the table and returns its dialog. */
async function openReview(user: ReturnType<typeof userEvent.setup>) {
  const table = await screen.findByRole("table", {
    name: "Credit requests to review",
  })
  await user.click(within(table).getByRole("button", { name: "Review" }))

  return screen.findByRole("dialog", { name: "Review credit request" })
}

describe("ProgramChairCreditMappingsWorkspace", () => {
  const fetchMock = vi.fn<typeof fetch>()
  let recorded: Recorded

  beforeEach(() => {
    recorded = { patches: [], posts: [] }
    vi.stubGlobal("fetch", fetchMock)
  })
  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllGlobals()
  })

  it("is not available for another role", () => {
    renderWithSession(<ProgramChairCreditMappingsWorkspace />, {
      session: { ...chairSession, role: "registrar_staff" },
    })

    expect(
      screen.getByText("This workspace is not available for your role."),
    ).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("lists the requests to review and the credits waiting for the Registrar", async () => {
    fetchMock.mockImplementation(mockRoutes(recorded))
    renderWithSession(<ProgramChairCreditMappingsWorkspace />, {
      session: chairSession,
    })

    const review = await screen.findByRole("table", {
      name: "Credit requests to review",
    })
    expect(
      within(review).getByText("Maria Santos (2026-0002)"),
    ).toBeInTheDocument()
    expect(
      within(review).getByText("Intro to Computing (CS 101)"),
    ).toBeInTheDocument()
    expect(within(review).getByText("Not mapped")).toBeInTheDocument()

    const waiting = await screen.findByRole("table", {
      name: "Endorsed credits",
    })
    expect(
      within(waiting).getByText("Juan Dela Cruz (2026-0003)"),
    ).toBeInTheDocument()
    expect(
      within(waiting).getByText("MATH201 — Statistics and Probability"),
    ).toBeInTheDocument()
  })

  it("shows the system's suggested subjects, best first, and endorses the chosen one", async () => {
    fetchMock.mockImplementation(mockRoutes(recorded))
    const user = userEvent.setup()
    renderWithSession(<ProgramChairCreditMappingsWorkspace />, {
      session: chairSession,
    })

    const dialog = await openReview(user)
    const list = await within(dialog).findByRole("list", {
      name: "Suggested subjects",
    })
    const items = within(list).getAllByRole("listitem")
    expect(items[0]).toHaveTextContent("CS101 — Introduction to Computing")
    expect(items[0]).toHaveTextContent("100% match")
    expect(items[0]).toHaveTextContent("Same subject code")
    expect(items[1]).toHaveTextContent("CS105")

    // Nothing is chosen for the chair: Endorse stays off until she picks.
    expect(
      within(dialog).getByRole("button", { name: "Endorse to Registrar" }),
    ).toBeDisabled()

    await user.click(within(dialog).getByRole("button", { name: "Use CS101" }))
    expect(
      within(dialog).getByRole("button", { name: "Chosen" }),
    ).toHaveAttribute("aria-pressed", "true")
    await user.click(
      within(dialog).getByRole("button", { name: "Endorse to Registrar" }),
    )

    await waitFor(() =>
      expect(recorded.patches).toEqual([
        { action: "endorse", subject_id: 10, credited_units: 3 },
      ]),
    )
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Review credit request" }),
      ).not.toBeInTheDocument(),
    )
  })

  it("saves a mapping without endorsing it yet", async () => {
    fetchMock.mockImplementation(mockRoutes(recorded))
    const user = userEvent.setup()
    renderWithSession(<ProgramChairCreditMappingsWorkspace />, {
      session: chairSession,
    })

    const dialog = await openReview(user)
    await user.click(
      await within(dialog).findByRole("button", { name: "Use CS105" }),
    )
    await user.click(
      within(dialog).getByRole("button", { name: "Save mapping" }),
    )

    await waitFor(() =>
      expect(recorded.patches).toEqual([{ subject_id: 12, credited_units: 3 }]),
    )
    expect(await within(dialog).findByText(/Mapping saved/)).toBeInTheDocument()
    // The dialog stays open: the chair endorses when she is ready.
    expect(
      screen.getByRole("dialog", { name: "Review credit request" }),
    ).toBeInTheDocument()
  })

  it("lets the chair credit a subject the system did not suggest", async () => {
    fetchMock.mockImplementation(mockRoutes(recorded))
    const user = userEvent.setup()
    renderWithSession(<ProgramChairCreditMappingsWorkspace />, {
      session: chairSession,
    })

    const dialog = await openReview(user)
    await user.click(
      within(dialog).getByRole("combobox", { name: /Credit as/i }),
    )
    await user.click(
      await screen.findByRole("option", { name: /MATH101 — College Algebra/ }),
    )
    await user.click(
      within(dialog).getByRole("button", { name: "Endorse to Registrar" }),
    )

    await waitFor(() =>
      expect(recorded.patches).toEqual([
        { action: "endorse", subject_id: 13, credited_units: 3 },
      ]),
    )
  })

  it("declines a request only with a reason", async () => {
    fetchMock.mockImplementation(mockRoutes(recorded))
    const user = userEvent.setup()
    renderWithSession(<ProgramChairCreditMappingsWorkspace />, {
      session: chairSession,
    })

    const dialog = await openReview(user)
    await user.click(
      within(dialog).getByRole("button", { name: "Decline request" }),
    )

    const confirm = within(dialog).getByRole("button", {
      name: "Confirm decline",
    })
    expect(confirm).toBeDisabled()
    await user.type(
      within(dialog).getByLabelText("Reason for declining"),
      "No transcript attached.",
    )
    expect(confirm).toBeEnabled()
    await user.click(confirm)

    await waitFor(() =>
      expect(recorded.patches).toEqual([
        { action: "decline", reason: "No transcript attached." },
      ]),
    )
  })

  it("keeps the review open and shows the reason when the API refuses a step", async () => {
    fetchMock.mockImplementation(
      mockRoutes(recorded, {
        patchResponse: () =>
          new Response(
            JSON.stringify({
              error: {
                code: "VALIDATION_ERROR",
                message: "The given data was invalid.",
                errors: {
                  action: [
                    "This action requires the transferee credit to currently be 'pending'; it is currently 'endorsed'.",
                  ],
                },
                request_id: "req-1",
              },
            }),
            { status: 422 },
          ),
      }),
    )
    const user = userEvent.setup()
    renderWithSession(<ProgramChairCreditMappingsWorkspace />, {
      session: chairSession,
    })

    const dialog = await openReview(user)
    await user.click(
      await within(dialog).findByRole("button", { name: "Use CS101" }),
    )
    await user.click(
      within(dialog).getByRole("button", { name: "Endorse to Registrar" }),
    )

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      /currently 'endorsed'/,
    )
    expect(
      screen.getByRole("dialog", { name: "Review credit request" }),
    ).toBeInTheDocument()
  })

  it("says so when nothing in the student's curriculum matches", async () => {
    fetchMock.mockImplementation((input, init) => {
      if (requestUrl(input).includes("/suggestions")) {
        return Promise.resolve(new Response(JSON.stringify({ data: [] })))
      }
      return mockRoutes(recorded)(input, init)
    })
    const user = userEvent.setup()
    renderWithSession(<ProgramChairCreditMappingsWorkspace />, {
      session: chairSession,
    })

    const dialog = await openReview(user)

    expect(
      await within(dialog).findByText(/No close match was found/),
    ).toBeInTheDocument()
  })

  it("records a credit for a walk-in student found in the chair's college", async () => {
    fetchMock.mockImplementation(mockRoutes(recorded))
    const user = userEvent.setup()
    renderWithSession(<ProgramChairCreditMappingsWorkspace />, {
      session: chairSession,
    })

    await user.type(await screen.findByLabelText(/Find student/i), "Santos")
    await user.click(
      await screen.findByRole("button", { name: /Maria Santos/ }),
    )
    await user.type(screen.getByLabelText("Previous school"), "FEU Tech")
    await user.type(screen.getByLabelText("Subject title"), "Programming 1")
    await user.type(screen.getByLabelText(/Subject code/), "prog101")
    await user.click(screen.getByRole("button", { name: "Record credit" }))

    await waitFor(() =>
      expect(recorded.posts).toEqual([
        {
          student_id: 30,
          source_institution: "FEU Tech",
          source_subject_code: "PROG101",
          source_subject_title: "Programming 1",
          credited_units: 3,
        },
      ]),
    )
    expect(
      await screen.findByText(/Recorded for Maria Santos/),
    ).toBeInTheDocument()
  })

  it("has no detectable accessibility violations once loaded", async () => {
    fetchMock.mockImplementation(mockRoutes(recorded))
    const { container } = renderWithSession(
      <ProgramChairCreditMappingsWorkspace />,
      {
        session: chairSession,
      },
    )

    await screen.findByRole("table", { name: "Credit requests to review" })
    expect(await axe(container)).toHaveNoViolations()
  })
})
