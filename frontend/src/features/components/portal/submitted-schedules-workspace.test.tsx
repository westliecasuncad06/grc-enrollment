import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { SubmittedSchedulesWorkspace } from "@/features/components/portal/submitted-schedules-workspace"
import { renderWithSession } from "@/tests/render-app"

const terms = {
  data: [
    {
      type: "academic-term",
      id: 2,
      school_year: "2026-2027",
      semester: "1st",
      starts_at: null,
      ends_at: null,
      enrollment_opens_at: null,
      enrollment_closes_at: null,
      add_drop_deadline_at: null,
      grading_deadline_at: null,
      status: "semester_ongoing",
      status_label: "Semester Ongoing",
    },
  ],
}

function proposal(id: number, overrides: Record<string, unknown>) {
  return {
    type: "schedule_proposal",
    id,
    academic_term_id: 2,
    submitted_by: 4,
    submitted_by_name: "COA Program Head",
    college: "coa",
    college_label: "College of Accountancy",
    academic_term_label: "2026-2027 · 1st",
    is_submitted: true,
    status: "published",
    status_label: "Published",
    decided_by: 5,
    decided_at: "2026-07-29T12:00:00Z",
    decision_reason: null,
    decision_history: [],
    ...overrides,
  }
}

const proposals = {
  data: [
    proposal(9, { college_label: "College of Accountancy" }),
    proposal(10, {
      college: "ccs",
      college_label: "College of Computer Studies",
      status: "dean_approved",
      status_label: "Dean approved",
    }),
    proposal(11, {
      college: "cbae",
      college_label: "College of Business",
      is_submitted: false,
      status: "draft",
      status_label: "Draft",
    }),
  ],
}

function url(input: RequestInfo | URL) {
  return typeof input === "string"
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url
}

function routeFixtures(input: RequestInfo | URL) {
  const target = url(input)
  if (target.includes("academic-terms")) return terms
  if (target.includes("schedule-proposals")) return proposals
  return { data: [] }
}

const registrarHead = {
  userId: "7",
  displayName: "Registrar Head",
  role: "registrar_head" as const,
  signedInAt: "2026-07-29T12:00:00Z",
}

describe("SubmittedSchedulesWorkspace", () => {
  const fetchMock = vi.fn<typeof fetch>()
  beforeEach(() => vi.stubGlobal("fetch", fetchMock))
  afterEach(() => vi.unstubAllGlobals())

  it("lists submitted plans read-only, without decision buttons or unsubmitted drafts", async () => {
    fetchMock.mockImplementation((input) =>
      Promise.resolve(new Response(JSON.stringify(routeFixtures(input)))),
    )
    renderWithSession(<SubmittedSchedulesWorkspace />, {
      session: registrarHead,
    })

    expect(
      await screen.findByText("College of Accountancy"),
    ).toBeInTheDocument()
    expect(screen.getByText("College of Computer Studies")).toBeInTheDocument()
    expect(screen.queryByText("College of Business")).not.toBeInTheDocument()
    // A published plan would normally offer the Registrar Head "Close".
    expect(
      screen.queryByRole("button", { name: /close|approve|publish|return/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.getAllByRole("button", { name: "View schedule" }),
    ).toHaveLength(2)
  })

  it("opens a submitted plan without decision actions in the dialog", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation((input) =>
      Promise.resolve(new Response(JSON.stringify(routeFixtures(input)))),
    )
    renderWithSession(<SubmittedSchedulesWorkspace />, {
      session: registrarHead,
    })

    const [first] = await screen.findAllByRole("button", {
      name: "View schedule",
    })
    await user.click(first)
    const dialog = await screen.findByRole("dialog", {
      name: /Review schedule/i,
    })
    expect(
      within(dialog).queryByRole("button", {
        name: /close schedule|publish|approve/i,
      }),
    ).not.toBeInTheDocument()
  })

  it("shows an empty message when nothing was submitted", async () => {
    fetchMock.mockImplementation((input) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            url(input).includes("academic-terms") ? terms : { data: [] },
          ),
        ),
      ),
    )
    renderWithSession(<SubmittedSchedulesWorkspace />, {
      session: registrarHead,
    })
    expect(
      await screen.findByText("No Program Head has submitted a schedule yet."),
    ).toBeInTheDocument()
  })

  it("is unavailable to other roles and makes no schedule requests", () => {
    renderWithSession(<SubmittedSchedulesWorkspace />, {
      session: { ...registrarHead, role: "registrar_staff" },
    })
    expect(
      screen.queryByText("Plans from Program Heads"),
    ).not.toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining("schedule-proposals"),
      expect.anything(),
    )
  })
})
