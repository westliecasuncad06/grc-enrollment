import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { axe } from "vitest-axe"

import { EnrollmentSubjectFilterBar } from "@/features/components/portal/enrollment-subject-filter-bar"
import type { EligibleSubject } from "@/features/schemas/enrollment-schema"

function section(
  overrides: Partial<EligibleSubject["available_sections"][number]> = {},
): EligibleSubject["available_sections"][number] {
  return {
    type: "section",
    id: 1,
    academic_term_id: 2,
    subject_id: 7,
    section_code: "A",
    professor_id: null,
    schedule_days: "MWF",
    starts_at_time: "08:00:00",
    ends_at_time: "09:00:00",
    room: "R101",
    capacity: 30,
    capacity_source: "plan",
    viability_threshold: null,
    enrolled_count: 0,
    remaining_seats: 30,
    is_block_exclusive: null,
    status: "published",
    status_label: "Published",
    ...overrides,
  }
}

function subject(overrides: Partial<EligibleSubject> = {}): EligibleSubject {
  return {
    type: "eligible_subject",
    subject_id: 1,
    code: "IT305",
    title: "Systems Integration",
    units: 3,
    year_level: 3,
    semester: "1st",
    is_required: true,
    is_eligible: true,
    reasons: [{ code: "eligible", message: "All requirements are met." }],
    preference_score: null,
    preference_reasons: [],
    available_sections: [section()],
    ...overrides,
  }
}

function renderBar(subjects: readonly EligibleSubject[]) {
  return render(
    <EnrollmentSubjectFilterBar subjects={subjects}>
      {(visible) => (
        <ul>
          {visible.map((item) => (
            <li key={item.subject_id}>{item.code}</li>
          ))}
        </ul>
      )}
    </EnrollmentSubjectFilterBar>,
  )
}

describe("EnrollmentSubjectFilterBar", () => {
  it("filters by time block without hiding subjects outside the chosen block", async () => {
    const user = userEvent.setup()
    const morning = subject({
      subject_id: 1,
      code: "IT305",
      available_sections: [section({ starts_at_time: "08:00:00" })],
    })
    const evening = subject({
      subject_id: 2,
      code: "IT402",
      available_sections: [section({ starts_at_time: "18:00:00" })],
    })
    renderBar([morning, evening])

    await user.selectOptions(screen.getByLabelText("Time block"), "evening")

    expect(screen.queryByText("IT305")).not.toBeInTheDocument()
    expect(screen.getByText("IT402")).toBeInTheDocument()
  })

  it("filters by professor", async () => {
    const user = userEvent.setup()
    const withProfessor10 = subject({
      subject_id: 1,
      code: "IT305",
      available_sections: [section({ professor_id: 10 })],
    })
    const withProfessor20 = subject({
      subject_id: 2,
      code: "IT402",
      available_sections: [section({ professor_id: 20 })],
    })
    renderBar([withProfessor10, withProfessor20])

    await user.selectOptions(screen.getByLabelText("Professor"), "20")

    expect(screen.queryByText("IT305")).not.toBeInTheDocument()
    expect(screen.getByText("IT402")).toBeInTheDocument()
  })

  it("filters by subject search text against code and title", async () => {
    const user = userEvent.setup()
    const dataStructures = subject({
      subject_id: 1,
      code: "IT305",
      title: "Systems Integration",
    })
    const ethics = subject({
      subject_id: 2,
      code: "GE201",
      title: "Ethics",
    })
    renderBar([dataStructures, ethics])

    await user.type(screen.getByLabelText("Subject search"), "ethics")

    expect(screen.queryByText("IT305")).not.toBeInTheDocument()
    expect(screen.getByText("GE201")).toBeInTheDocument()
  })

  it("announces the visible count through the status region", async () => {
    const user = userEvent.setup()
    const keep = subject({ subject_id: 1, code: "IT100" })
    const drop = subject({ subject_id: 2, code: "IT200" })
    renderBar([keep, drop])

    expect(screen.getByRole("status")).toHaveTextContent("2 of 2 subjects shown.")

    await user.type(screen.getByLabelText("Subject search"), "IT100")

    expect(screen.getByRole("status")).toHaveTextContent("1 of 2 subjects shown.")
  })

  it("shows an explicit message when filters leave no subject visible", async () => {
    const user = userEvent.setup()
    renderBar([subject({ subject_id: 1, code: "IT305" })])

    await user.type(screen.getByLabelText("Subject search"), "nonexistent")

    expect(
      screen.getByText("No subjects match the current filters."),
    ).toBeInTheDocument()
    expect(screen.queryByText("IT305")).not.toBeInTheDocument()
  })

  it("has no detectable accessibility violations", async () => {
    const subjects = [
      subject({
        subject_id: 1,
        code: "IT305",
        title: "Systems Integration",
        preference_score: 40,
      }),
      subject({
        subject_id: 2,
        code: "IT402",
        title: "Advanced Systems",
        preference_score: null,
      }),
    ]
    const { container } = renderBar(subjects)

    expect(await axe(container)).toHaveNoViolations()
  })
})
