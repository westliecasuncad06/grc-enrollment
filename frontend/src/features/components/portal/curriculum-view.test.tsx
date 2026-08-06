import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { CurriculumView } from "@/features/components/portal/curriculum-view"
import { renderWithSession } from "@/tests/render-app"

const programs = [
  {
    type: "program",
    id: 1,
    code: "BSA",
    name: "BS Accountancy",
    status: "active",
    status_label: "Active",
  },
  {
    type: "program",
    id: 2,
    code: "BSIT",
    name: "BS Information Technology",
    status: "active",
    status_label: "Active",
  },
] as const

const curricula = [
  {
    type: "curriculum",
    id: 1,
    program_id: 1,
    name: "BSA 2024-2029",
    effective_school_year: "2024-2029",
    status: "active",
    status_label: "Active",
    subjects: [
      {
        subject_id: 11,
        code: "ACC101",
        title: "Financial Accounting",
        units: 3,
        year_level: 1,
        semester: "1st",
        is_required: true,
        prerequisites: [],
      },
      {
        subject_id: 12,
        code: "NSTP1",
        title: "National Service Training Program 1",
        units: 3,
        year_level: 1,
        semester: "1st|2nd",
        is_required: true,
        prerequisites: [],
      },
      {
        subject_id: 13,
        code: "ACC201",
        title: "Cost Accounting",
        units: 3,
        year_level: 2,
        semester: "2nd",
        is_required: true,
        prerequisites: [],
      },
    ],
  },
  {
    type: "curriculum",
    id: 2,
    program_id: 1,
    name: "BSA 2018-2023",
    effective_school_year: "2018-2023",
    status: "archived",
    status_label: "Archived",
    subjects: [
      {
        subject_id: 14,
        code: "OLD101",
        title: "Old Subject",
        units: 3,
        year_level: 1,
        semester: "1st",
        is_required: true,
        prerequisites: [],
      },
    ],
  },
  {
    type: "curriculum",
    id: 3,
    program_id: 2,
    name: "BSIT 2024-2029",
    effective_school_year: "2024-2029",
    status: "active",
    status_label: "Active",
    subjects: [
      {
        subject_id: 21,
        code: "ITC",
        title: "Introduction to Computing",
        units: 2,
        year_level: 1,
        semester: "1st",
        is_required: true,
        prerequisites: [],
      },
    ],
  },
] as const

function render(overrides: {
  programs?: typeof programs
  curricula?: typeof curricula
} = {}) {
  return renderWithSession(
    <CurriculumView
      programs={overrides.programs ?? programs}
      curricula={overrides.curricula ?? curricula}
    />,
  )
}

/** The `<table>` whose caption matches `captionText`. */
function tableFor(captionText: string): HTMLElement {
  const caption = screen.getByText(captionText)
  const table = caption.closest("table")
  if (!table) throw new Error(`No table found for caption "${captionText}"`)
  return table
}

async function selectOption(
  user: ReturnType<typeof userEvent.setup>,
  labelText: string,
  optionName: string,
) {
  await user.click(screen.getByLabelText(labelText))
  await user.click(await screen.findByRole("option", { name: optionName }))
}

describe("CurriculumView", () => {
  it("defaults to the alphabetically first program's active curriculum, grouped by year and semester, with only Code/Description/Units columns", () => {
    render()

    expect(screen.getByLabelText("Program")).toHaveTextContent(
      "BSA — BS Accountancy",
    )

    const firstYearFirstSem = tableFor("1st Year · 1st Semester")
    expect(within(firstYearFirstSem).getByText("ACC101")).toBeInTheDocument()
    expect(within(firstYearFirstSem).getByText("NSTP1")).toBeInTheDocument()
    const headers = within(firstYearFirstSem)
      .getAllByRole("columnheader")
      .map((cell) => cell.textContent)
    expect(headers).toEqual(["Code", "Description", "Units"])

    const firstYearSecondSem = tableFor("1st Year · 2nd Semester")
    expect(within(firstYearSecondSem).getByText("NSTP1")).toBeInTheDocument()
    expect(
      within(firstYearSecondSem).queryByText("ACC101"),
    ).not.toBeInTheDocument()

    const secondYearSecondSem = tableFor("2nd Year · 2nd Semester")
    expect(within(secondYearSecondSem).getByText("ACC201")).toBeInTheDocument()

    // The archived 2018-2023 curriculum never appears.
    expect(screen.queryByText("OLD101")).not.toBeInTheDocument()
  })

  it("filters to a single year level and semester", async () => {
    const user = userEvent.setup()
    render()

    await selectOption(user, "Year level", "2nd Year")
    await selectOption(user, "Semester", "2nd Semester")

    expect(screen.getByText("2nd Year · 2nd Semester")).toBeInTheDocument()
    expect(screen.queryByText("1st Year · 1st Semester")).not.toBeInTheDocument()
    expect(screen.queryByText("ACC101")).not.toBeInTheDocument()
    expect(screen.getByText("ACC201")).toBeInTheDocument()
  })

  it("switches to another program's active curriculum", async () => {
    const user = userEvent.setup()
    render()

    await selectOption(user, "Program", "BSIT — BS Information Technology")

    expect(screen.getByText("ITC")).toBeInTheDocument()
    expect(screen.queryByText("ACC101")).not.toBeInTheDocument()
  })

  it("shows an empty state when no program has an active curriculum", () => {
    render({ curricula: [curricula[1]] })

    expect(
      screen.getByText("No active curriculum is available to view yet."),
    ).toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
  })

  it("shows an empty state when the filters exclude every subject", async () => {
    const user = userEvent.setup()
    render()

    await selectOption(user, "Year level", "4th Year")

    expect(
      screen.getByText("No subjects match the selected filters."),
    ).toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
  })
})
