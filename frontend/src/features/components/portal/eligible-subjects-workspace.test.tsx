import { screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { EligibleSubjectsWorkspace } from "@/features/components/portal/eligible-subjects-workspace"
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
      status: "active",
      status_label: "Active",
    },
  ],
}

const eligibleSubject = {
  type: "eligible_subject",
  subject_id: 7,
  code: "CS101",
  title: "Programming 1",
  units: 3,
  year_level: 1,
  semester: "1st",
  is_required: true,
  is_eligible: true,
  reasons: [{ code: "eligible", message: "All requirements are met." }],
  available_sections: [
    {
      type: "section",
      id: 5,
      academic_term_id: 2,
      subject_id: 7,
      section_code: "A",
      professor_id: null,
      schedule_days: "MWF",
      starts_at_time: "08:00:00",
      ends_at_time: "09:00:00",
      room: "R101",
      capacity: 30,
      viability_threshold: null,
      enrolled_count: 5,
      remaining_seats: 25,
      status: "published",
      status_label: "Published",
    },
  ],
}

const excludedSubject = {
  type: "eligible_subject",
  subject_id: 8,
  code: "CS201",
  title: "Data Structures",
  units: 3,
  year_level: 2,
  semester: "1st",
  is_required: true,
  is_eligible: false,
  reasons: [
    {
      code: "prerequisite",
      message: "CS101: The prerequisite subject has not yet been completed.",
    },
  ],
  available_sections: [],
}

function url(input: RequestInfo | URL) {
  return typeof input === "string"
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url
}

describe("EligibleSubjectsWorkspace", () => {
  const fetchMock = vi.fn<typeof fetch>()
  beforeEach(() => vi.stubGlobal("fetch", fetchMock))
  afterEach(() => vi.unstubAllGlobals())

  it("shows each subject's eligibility, reasons, and available sections", async () => {
    fetchMock.mockImplementation((input) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            url(input).includes("/academic-terms")
              ? terms
              : { data: [eligibleSubject, excludedSubject] },
          ),
        ),
      ),
    )
    renderWithSession(<EligibleSubjectsWorkspace />, {
      session: {
        userId: "1",
        displayName: "Student",
        role: "student",
        signedInAt: "2026-07-30T00:00:00Z",
      },
    })

    expect(
      await screen.findByRole("article", { name: /CS101/ }),
    ).toBeInTheDocument()
    expect(screen.getByText("Eligible")).toBeInTheDocument()
    expect(screen.getByText("Not eligible")).toBeInTheDocument()
    expect(screen.getByText(/25 seats open/)).toBeInTheDocument()
    expect(
      screen.getByText(
        "CS101: The prerequisite subject has not yet been completed.",
      ),
    ).toBeInTheDocument()
  })

  it("requests the pool only once a term is selected", async () => {
    fetchMock.mockImplementation((input) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            url(input).includes("/academic-terms")
              ? terms
              : { data: [eligibleSubject] },
          ),
        ),
      ),
    )
    renderWithSession(<EligibleSubjectsWorkspace />, {
      session: {
        userId: "1",
        displayName: "Student",
        role: "student",
        signedInAt: "2026-07-30T00:00:00Z",
      },
    })

    await screen.findByRole("article", { name: /CS101/ })
    expect(
      fetchMock.mock.calls.some(([request]) =>
        url(request).includes("/eligible-subjects?academic_term_id=2"),
      ),
    ).toBe(true)
  })

  it("has no detectable accessibility violations once loaded", async () => {
    fetchMock.mockImplementation((input) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            url(input).includes("/academic-terms")
              ? terms
              : { data: [eligibleSubject, excludedSubject] },
          ),
        ),
      ),
    )
    const { container } = renderWithSession(<EligibleSubjectsWorkspace />, {
      session: {
        userId: "1",
        displayName: "Student",
        role: "student",
        signedInAt: "2026-07-30T00:00:00Z",
      },
    })

    await screen.findByRole("article", { name: /CS101/ })
    expect(await axe(container)).toHaveNoViolations()
  })
})
