import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { StudentScheduleWorkspace } from "@/features/components/portal/student-schedule-workspace"
import { renderWithSession } from "@/tests/render-app"

const studentSession = {
  userId: "101",
  displayName: "Juan Dela Cruz",
  role: "student" as const,
  signedInAt: "2026-09-07T12:00:00Z",
}

const termsFixture = {
  data: [
    {
      type: "academic-term",
      id: 1,
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

const enrolledSubjectsFixture = [
  {
    section_id: 11,
    section_code: "IT101",
    subject_code: "CS101",
    subject_title: "Introduction to Computing",
    units: 3,
    schedule_days: "MWF",
    starts_at_time: "08:00:00",
    ends_at_time: "09:00:00",
    room: "LAB-1",
    modality: "f2f" as const,
    professor_name: "Dr. Cruz",
    status: "enrolled" as const,
    status_label: "Enrolled",
  },
  {
    section_id: 12,
    section_code: "IT101",
    subject_code: "GE101",
    subject_title: "Understanding the Self",
    units: 3,
    schedule_days: "TTh",
    starts_at_time: "10:00:00",
    ends_at_time: "11:30:00",
    room: "R201",
    modality: "f2f" as const,
    professor_name: "Prof. Reyes",
    status: "enrolled" as const,
    status_label: "Enrolled",
  },
]

const enrollmentFixture = {
  data: [
    {
      type: "enrollment",
      id: 42,
      student_id: 101,
      student_number: "2026-0001",
      student_name: null,
      student_year_level: null,
      student_financial_status: null,
      student_financial_status_label: null,
      academic_term_id: 1,
      status: "enrolled",
      status_label: "Enrolled",
      total_units: 6,
      requires_overload_approval: false,
      submitted_at: "2026-09-01T08:00:00Z",
      registrar_decided_at: "2026-09-02T09:00:00Z",
      payment_confirmed_at: "2026-09-03T10:00:00Z",
      enrolled_at: "2026-09-03T10:05:00Z",
      subjects: enrolledSubjectsFixture,
      queue_ticket: null,
      assessment: null,
    },
  ],
}

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

function mockFetchRoutes(customEnrollments = enrollmentFixture.data) {
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>((input) => {
      const url = typeof input === "string" ? input : "url" in input ? input.url : String(input)
      if (url.includes("/api/v1/academic-terms")) {
        return Promise.resolve(new Response(JSON.stringify(termsFixture)))
      }
      if (url.includes("/api/v1/enrollments")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: customEnrollments,
              links: paginationLinks,
              meta: { ...paginationMeta, total: customEnrollments.length },
            }),
          ),
        )
      }
      if (url.includes("/api/v1/student-profiles/me/account")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: {
                student_number: "2026-0001",
                year_level: 1,
                assessment_amount: "15000.00",
                remaining_balance: "0.00",
                financial_status: "cleared",
                financial_status_label: "Cleared",
              },
            }),
          ),
        )
      }
      return Promise.resolve(new Response(JSON.stringify({ data: [] })))
    }),
  )
}

describe("StudentScheduleWorkspace", () => {
  beforeEach(() => {
    mockFetchRoutes()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("renders student schedule workspace with title and description", async () => {
    renderWithSession(<StudentScheduleWorkspace />, { session: studentSession })

    expect(
      await screen.findByRole("heading", { name: "Schedule", level: 1 }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "View your weekly class timetable, professor assignments, and room allocations.",
      ),
    ).toBeInTheDocument()
  })

  it("renders empty state with link to enrollment when student has no active enrollment", async () => {
    mockFetchRoutes([])
    renderWithSession(<StudentScheduleWorkspace />, { session: studentSession })

    expect(
      await screen.findByText("No class schedule for this term"),
    ).toBeInTheDocument()
    const enrollmentLink = screen.getByRole("link", { name: /Go to Enrollment/i })
    expect(enrollmentLink).toBeInTheDocument()
    expect(enrollmentLink).toHaveAttribute("href", "/portal/enrollment")
  })

  it("renders enrolled class schedule with professor names and supports dual view toggling", async () => {
    const user = userEvent.setup()
    renderWithSession(<StudentScheduleWorkspace />, { session: studentSession })

    // Overview cards
    expect(await screen.findByText("6 units")).toBeInTheDocument()
    expect(screen.getByText("2 enrolled classes")).toBeInTheDocument()
    expect(screen.getByText("IT101")).toBeInTheDocument()

    // Default is Calendar view (multi-day slots like MWF appear on multiple day columns)
    expect(screen.getByRole("region", { name: "Weekly class schedule" })).toBeInTheDocument()
    expect(screen.getAllByText("CS101").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("Dr. Cruz").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("Prof. Reyes").length).toBeGreaterThanOrEqual(1)

    // Switch to Table view
    const tableViewBtn = screen.getByRole("radio", { name: "Schedule list" })
    await user.click(tableViewBtn)

    // Table headers and data
    const table = await screen.findByRole("table", { name: "Student weekly class schedule" })
    expect(table).toBeInTheDocument()
    expect(within(table).getByText("Introduction to Computing")).toBeInTheDocument()
    expect(within(table).getByText("Understanding the Self")).toBeInTheDocument()
    expect(within(table).getByText("LAB-1")).toBeInTheDocument()
    expect(within(table).getByText("R201")).toBeInTheDocument()
  })
})
