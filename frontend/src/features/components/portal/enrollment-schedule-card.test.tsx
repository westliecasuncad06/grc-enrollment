import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { toast } from "sonner"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { EnrollmentScheduleCard } from "@/features/components/portal/enrollment-schedule-card"
import { renderWithSession } from "@/tests/render-app"
import type { AcademicTerm } from "@/features/schemas/reference-data-schema"

vi.mock("sonner", () => ({ toast: { success: vi.fn() } }))

function url(input: RequestInfo | URL) {
  if (typeof input === "string") return input
  return input instanceof URL ? input.toString() : input.url
}

function registrarSession() {
  return {
    userId: "9",
    displayName: "Registrar Head",
    role: "registrar_head" as const,
    signedInAt: "2026-07-29T12:00:00Z",
  }
}

const draftTerm: AcademicTerm = {
  type: "academic-term",
  id: 5,
  school_year: "2028-2029",
  semester: "1st",
  starts_at: null,
  ends_at: null,
  enrollment_opens_at: "2028-07-01T00:00:00Z",
  enrollment_closes_at: "2028-07-15T00:00:00Z",
  add_drop_deadline_at: null,
  grading_deadline_at: null,
  status: "draft",
  status_label: "Draft",
}

const ongoingTerm: AcademicTerm = { ...draftTerm, status: "semester_ongoing", status_label: "Semester Ongoing" }

function proposalFixture(college: string, status: string) {
  return {
    type: "schedule_proposal",
    id: college.length,
    academic_term_id: 5,
    college,
    college_label: college.toUpperCase(),
    academic_term_label: "2028-2029 · 1st",
    submitted_by: 1,
    submitted_by_name: "Chair",
    section_plan_id: null,
    is_submitted: true,
    is_returned: false,
    returned_by_role: null,
    status,
    status_label: status,
    decided_by: null,
    decided_by_name: null,
    decided_at: null,
    decision_reason: null,
    decision_history: [],
  }
}

const AUDIENCE_LABELS = [
  ["year_1", "1st Year"],
  ["year_2", "2nd Year"],
  ["year_3", "3rd Year"],
  ["year_4", "4th Year"],
  ["irregular", "Irregular Students"],
] as const

function scheduleFixture(overrides: Partial<{ status: string; audiences: unknown[] }> = {}) {
  return {
    data: {
      type: "enrollment_schedule",
      academic_term_id: 5,
      status: overrides.status ?? "draft",
      enrollment_opens_at: "2028-07-01T00:00:00Z",
      enrollment_closes_at: "2028-07-15T00:00:00Z",
      audiences:
        overrides.audiences ??
        AUDIENCE_LABELS.map(([audience, label]) => ({
          audience,
          label,
          opens_at: "2028-07-01T00:00:00Z",
          closes_at: "2028-07-15T00:00:00Z",
          is_open: true,
          reason: "open",
        })),
      viewer: null,
      add_drop: {
        is_open: false,
        reason: "enrollment_still_open",
        reason_message:
          "The add/drop window opens once enrollment closes for this term.",
        opens_at: "2028-07-15T00:00:00Z",
        closes_at: null,
      },
    },
  }
}

describe("EnrollmentScheduleCard", () => {
  const fetchMock = vi.fn<typeof fetch>()
  beforeEach(() => vi.stubGlobal("fetch", fetchMock))
  afterEach(() => vi.unstubAllGlobals())

  it("shows which colleges have published and explains enrollment will not open yet", async () => {
    fetchMock.mockImplementation((input) => {
      if (url(input).includes("/schedule-proposals"))
        return Promise.resolve(
          new Response(JSON.stringify({ data: [] }), { status: 200 }),
        )
      return Promise.resolve(new Response(JSON.stringify(scheduleFixture())))
    })

    renderWithSession(<EnrollmentScheduleCard currentTerm={draftTerm} />, {
      session: registrarSession(),
    })

    expect(await screen.findByText(/CCS not published/)).toBeInTheDocument()
    expect(
      screen.getByText(/Enrollment will open automatically when you save/),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Open enrollment" }),
    ).not.toBeInTheDocument()
  })

  it("opens enrollment automatically when saving the schedule once a college has published", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation((input, init) => {
      if (init?.method === "PATCH" && url(input).includes("/academic-terms/5") && !url(input).includes("enrollment-schedule"))
        return Promise.resolve(
          new Response(
            JSON.stringify({ data: { ...draftTerm, status: "semester_ongoing" } }),
            { status: 200 },
          ),
        )
      if (url(input).includes("/schedule-proposals"))
        return Promise.resolve(
          new Response(
            JSON.stringify({ data: [proposalFixture("ccs", "published")] }),
            { status: 200 },
          ),
        )
      return Promise.resolve(new Response(JSON.stringify(scheduleFixture())))
    })

    renderWithSession(<EnrollmentScheduleCard currentTerm={draftTerm} />, {
      session: registrarSession(),
    })

    await waitFor(() =>
      expect(screen.getByText(/CCS published/)).toBeInTheDocument(),
    )
    await user.click(await screen.findByRole("button", { name: "Save enrollment schedule" }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/academic-terms/5"),
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ action: "open_enrollment" }),
        }),
      ),
    )
    expect(toast.success).toHaveBeenCalledWith(
      "Enrollment schedule saved. Enrollment is now open.",
    )
  })

  it("shows live per-audience status once the term is ongoing", async () => {
    fetchMock.mockImplementation((input) => {
      if (url(input).includes("/schedule-proposals"))
        return Promise.resolve(new Response(JSON.stringify({ data: [] })))
      return Promise.resolve(
        new Response(
          JSON.stringify(
            scheduleFixture({
              status: "semester_ongoing",
              audiences: [
                { audience: "year_1", label: "1st Year", opens_at: null, closes_at: null, is_open: true, reason: "open" },
                { audience: "year_2", label: "2nd Year", opens_at: "2028-08-01T00:00:00Z", closes_at: null, is_open: false, reason: "before_window" },
                { audience: "year_3", label: "3rd Year", opens_at: null, closes_at: null, is_open: true, reason: "open" },
                { audience: "year_4", label: "4th Year", opens_at: null, closes_at: null, is_open: true, reason: "open" },
                { audience: "irregular", label: "Irregular Students", opens_at: "2028-09-01T00:00:00Z", closes_at: null, is_open: false, reason: "before_window" },
              ],
            }),
          ),
        ),
      )
    })

    renderWithSession(<EnrollmentScheduleCard currentTerm={ongoingTerm} />, {
      session: registrarSession(),
    })

    expect((await screen.findAllByText("Open now")).length).toBe(3)
    expect((await screen.findAllByText("Opens later")).length).toBe(2)
  })

  it("saves the enrollment schedule with the term-wide and per-audience dates", async () => {
    const user = userEvent.setup()
    let savedBody: unknown = null
    fetchMock.mockImplementation((input, init) => {
      if (url(input).includes("/schedule-proposals"))
        return Promise.resolve(new Response(JSON.stringify({ data: [] })))
      if (init?.method === "PATCH" && url(input).includes("enrollment-schedule")) {
        savedBody = typeof init.body === "string" ? JSON.parse(init.body) : null
        return Promise.resolve(new Response(JSON.stringify(scheduleFixture()), { status: 200 }))
      }
      return Promise.resolve(new Response(JSON.stringify(scheduleFixture())))
    })

    renderWithSession(<EnrollmentScheduleCard currentTerm={draftTerm} />, {
      session: registrarSession(),
    })

    await user.click(await screen.findByRole("button", { name: "Save enrollment schedule" }))

    await waitFor(() => expect(savedBody).not.toBeNull())
    const body = savedBody as {
      enrollment_opens_at: string
      windows: { audience: string }[]
    }
    // Five, not four: `UpdateEnrollmentScheduleRequest` validates
    // `size:count(EnrollmentAudience::cases())`, so a four-item array 422s.
    expect(body.windows).toHaveLength(5)
    expect(body.windows.map((window) => window.audience)).toEqual([
      "year_1",
      "year_2",
      "year_3",
      "year_4",
      "irregular",
    ])
    expect(body.enrollment_opens_at).toBe("2028-07-01T00:00:00.000Z")
    expect(await screen.findByText("Enrollment schedule saved.")).toBeInTheDocument()
    expect(toast.success).toHaveBeenCalledWith("Enrollment schedule saved.")
  })

  it("labels rows with ordinals, uses date-only inputs, and states the fixed 8am/11:59pm times", async () => {
    fetchMock.mockImplementation((input) => {
      if (url(input).includes("/schedule-proposals"))
        return Promise.resolve(new Response(JSON.stringify({ data: [] })))
      return Promise.resolve(new Response(JSON.stringify(scheduleFixture())))
    })

    renderWithSession(<EnrollmentScheduleCard currentTerm={draftTerm} />, {
      session: registrarSession(),
    })

    expect(await screen.findByText("1st Year")).toBeInTheDocument()
    expect(screen.getByText("2nd Year")).toBeInTheDocument()
    expect(screen.getByText("3rd Year")).toBeInTheDocument()
    expect(screen.getByText("4th Year")).toBeInTheDocument()
    expect(screen.getByText("Irregular Students")).toBeInTheDocument()
    expect(screen.queryByText("Year 1")).not.toBeInTheDocument()

    expect(
      screen.getByText(/Enrollment always starts at 8:00 AM/i),
    ).toBeInTheDocument()

    expect(screen.getByLabelText("Term-wide enrollment start date")).toHaveAttribute("type", "date")
    expect(screen.getByLabelText("Term-wide enrollment deadline date")).toHaveAttribute("type", "date")
  })
})
