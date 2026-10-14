import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { ChedReportsWorkspace } from "@/features/components/portal/ched-reports-workspace"
import { renderWithSession } from "@/tests/render-app"

const toastError = vi.hoisted(() => vi.fn())
vi.mock("sonner", () => ({
  toast: { error: toastError, success: vi.fn() },
}))

const registrarHead = {
  userId: "head-1",
  displayName: "Registrar Head",
  role: "registrar_head" as const,
  signedInAt: "2026-10-15T00:00:00Z",
}

const terms = {
  data: [
    {
      type: "academic-term",
      id: 6,
      school_year: "2025-2026",
      semester: "2nd",
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

function listPayload(
  key: string,
  overrides: {
    total?: number
    lastPage?: number
    page?: number
    missingGender?: number
    demoPopulated?: number
    rows?: Record<string, string | number>[]
  } = {},
) {
  const rows = overrides.rows ?? [
    {
      no: 1,
      program: "Bachelor of Science in Information Technology",
      major: "",
      student_number: "2025-08-00001",
      first_name: "Ana",
      middle_name: "D.",
      surname: "Santos",
      name_extension: "",
      citizenship: "Filipino",
      gender: "F",
      year_level: 2,
      subjects: "Intro to Computing (3)",
      units: "3",
      remarks: "",
    },
  ]

  return {
    data: rows,
    meta: {
      current_page: overrides.page ?? 1,
      last_page: overrides.lastPage ?? 1,
      per_page: 25,
      total: overrides.total ?? rows.length,
    },
    report: {
      key,
      title:
        key === "enrollment-list"
          ? "CHED Enrollment List"
          : "NSTP Form 2-B — Enrollment",
      term_label: "2nd Term, AY 2025-2026",
      school_year: "2025-2026",
      columns:
        key === "enrollment-list"
          ? [
              { key: "no", label: "No." },
              { key: "program", label: "Programs" },
              { key: "student_number", label: "STUDENT NUMBER" },
              { key: "surname", label: "SURNAME" },
              { key: "gender", label: "GENDER" },
              { key: "subjects", label: "SUBJECTS ENROLLED FOLLOWED BY UNITS" },
            ]
          : [
              { key: "no", label: "No." },
              { key: "surname", label: "Surname" },
              { key: "gender", label: "Gender" },
            ],
      missing_gender: overrides.missingGender ?? 0,
      demo_populated: overrides.demoPopulated ?? 0,
    },
  }
}

const none = { m: 0, f: 0 }
const summaryPayload = {
  data: {
    campus: "Global Reciprocal Colleges",
    classification: "Private",
    academic_year: "2025-2026",
    enrollment: {
      "1st": { rotc: none, cwts: { m: 426, f: 406 }, lts: none },
      "2nd": { rotc: none, cwts: { m: 388, f: 377 }, lts: none },
      summer: { rotc: none, cwts: none, lts: none },
    },
    graduates: { rotc: none, cwts: { m: 489, f: 465 }, lts: none },
    missing_gender: 0,
  },
  report: {
    key: "nstp-summary",
    title: "NSTP Form 2-A — Summary",
    term_label: "2nd Term, AY 2025-2026",
    school_year: "2025-2026",
    columns: [],
    missing_gender: 0,
    demo_populated: 0,
  },
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input
  return input instanceof URL ? input.toString() : input.url
}

describe("ChedReportsWorkspace", () => {
  const fetchMock = vi.fn<typeof fetch>()
  let list = listPayload("enrollment-list")
  const urls = () =>
    fetchMock.mock.calls.map(([input]) => requestUrl(input as RequestInfo))

  beforeEach(() => {
    toastError.mockReset()
    list = listPayload("enrollment-list")
    vi.stubGlobal("fetch", fetchMock)
    fetchMock.mockImplementation((input) => {
      const url = requestUrl(input)
      if (url.includes("/export")) {
        return Promise.resolve(new Response("file", { status: 200 }))
      }
      if (url.includes("/ched-reports/nstp-summary")) {
        return Promise.resolve(new Response(JSON.stringify(summaryPayload)))
      }
      if (url.includes("/ched-reports/nstp-enrollment")) {
        return Promise.resolve(
          new Response(JSON.stringify(listPayload("nstp-enrollment"))),
        )
      }
      if (url.includes("/ched-reports/enrollment-list")) {
        return Promise.resolve(new Response(JSON.stringify(list)))
      }
      if (url.endsWith("/academic-terms")) {
        return Promise.resolve(new Response(JSON.stringify(terms)))
      }
      return Promise.resolve(new Response(JSON.stringify({ data: [] })))
    })
  })
  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllGlobals()
  })

  it("shows the CHED Enrollment List for the current term, with the template's columns", async () => {
    const view = renderWithSession(<ChedReportsWorkspace />, {
      session: registrarHead,
    })

    expect(
      view.getByRole("region", { name: "CHED Reports" }),
    ).toBeInTheDocument()
    expect(await screen.findByText("Santos")).toBeInTheDocument()
    expect(
      screen.getByRole("columnheader", { name: "STUDENT NUMBER" }),
    ).toBeInTheDocument()
    expect(screen.getByText("2025-08-00001")).toBeInTheDocument()
    expect(screen.getByText("Intro to Computing (3)")).toBeInTheDocument()
    expect(screen.getByText(/2nd Term, AY 2025-2026/)).toBeInTheDocument()
    expect(screen.getByText("1 student")).toBeInTheDocument()
    expect(
      urls().some((u) =>
        u.includes("/ched-reports/enrollment-list?academic_term_id=6&page=1"),
      ),
    ).toBe(true)
    expect(await axe(view.container)).toHaveNoViolations()
  })

  it("warns about students without a gender and about generated details", async () => {
    list = listPayload("enrollment-list", {
      total: 40,
      missingGender: 3,
      demoPopulated: 40,
    })
    renderWithSession(<ChedReportsWorkspace />, { session: registrarHead })

    expect(
      await screen.findByText(/3 listed students have no gender on file/),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/40 of the 40 listed students carry generated/),
    ).toBeInTheDocument()
  })

  it("says so when no student is listed for the term", async () => {
    list = listPayload("enrollment-list", { rows: [], total: 0 })
    renderWithSession(<ChedReportsWorkspace />, { session: registrarHead })

    expect(
      await screen.findByText("No students are listed for this term."),
    ).toBeInTheDocument()
  })

  it("pages through a long list", async () => {
    list = listPayload("enrollment-list", { total: 60, lastPage: 3 })
    const user = userEvent.setup()
    renderWithSession(<ChedReportsWorkspace />, { session: registrarHead })

    await screen.findByText("Santos")
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled()
    await user.click(screen.getByRole("button", { name: "Next" }))

    await waitFor(() =>
      expect(urls().some((u) => u.includes("page=2"))).toBe(true),
    )
  })

  it("switches to another report and reads it for the same term", async () => {
    const user = userEvent.setup()
    renderWithSession(<ChedReportsWorkspace />, { session: registrarHead })
    await screen.findByText("Santos")

    await user.click(screen.getByRole("tab", { name: "NSTP 2-B Enrollment" }))

    expect(
      await screen.findByRole("columnheader", { name: "Surname" }),
    ).toBeInTheDocument()
    expect(
      urls().some((u) =>
        u.includes("/ched-reports/nstp-enrollment?academic_term_id=6"),
      ),
    ).toBe(true)
  })

  it("shows Form 2-A as the school's one-row grid", async () => {
    const user = userEvent.setup()
    renderWithSession(<ChedReportsWorkspace />, { session: registrarHead })
    await screen.findByText("Santos")

    await user.click(screen.getByRole("tab", { name: "NSTP 2-A Summary" }))

    const grid = await screen.findByRole("table", {
      name: /NSTP Form 2-A summary/i,
    })
    expect(
      within(grid).getByText("Global Reciprocal Colleges"),
    ).toBeInTheDocument()
    expect(within(grid).getByText("Private")).toBeInTheDocument()
    // Each count shows in the school's row and again in the TOTAL row.
    expect(within(grid).getAllByText("426")).toHaveLength(2)
    expect(within(grid).getAllByText("377")).toHaveLength(2)
    expect(within(grid).getAllByText("489")).toHaveLength(2)
    expect(within(grid).getByText("TOTAL")).toBeInTheDocument()
    expect(screen.getByText(/Academic Year 2025-2026/)).toBeInTheDocument()
  })

  it("downloads the Excel file with the template's name, and CSV too", async () => {
    const names: string[] = []
    vi.stubGlobal(
      "URL",
      Object.assign(URL, {
        createObjectURL: vi.fn(() => "blob:ched"),
        revokeObjectURL: vi.fn(),
      }),
    )
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        names.push(this.download)
      })
    const user = userEvent.setup()
    renderWithSession(<ChedReportsWorkspace />, { session: registrarHead })
    await screen.findByText("Santos")

    await user.click(screen.getByRole("button", { name: "Download Excel" }))
    await waitFor(() => expect(names).toHaveLength(1))
    await user.click(screen.getByRole("button", { name: "Download CSV" }))
    await waitFor(() => expect(names).toHaveLength(2))

    expect(names).toEqual([
      "CHED-Enrollment-List_2025-2026-2nd.xlsx",
      "CHED-Enrollment-List_2025-2026-2nd.csv",
    ])
    expect(
      urls().some((u) =>
        u.includes(
          "/ched-reports/enrollment-list/export?academic_term_id=6&format=xlsx",
        ),
      ),
    ).toBe(true)
    click.mockRestore()
  })

  it("tells the Registrar Head when a download fails", async () => {
    fetchMock.mockImplementation((input) => {
      const url = requestUrl(input)
      if (url.includes("/export")) {
        return Promise.resolve(new Response("{}", { status: 500 }))
      }
      if (url.includes("/ched-reports/enrollment-list")) {
        return Promise.resolve(new Response(JSON.stringify(list)))
      }
      if (url.endsWith("/academic-terms")) {
        return Promise.resolve(new Response(JSON.stringify(terms)))
      }
      return Promise.resolve(new Response(JSON.stringify({ data: [] })))
    })
    const user = userEvent.setup()
    renderWithSession(<ChedReportsWorkspace />, { session: registrarHead })
    await screen.findByText("Santos")

    await user.click(screen.getByRole("button", { name: "Download CSV" }))

    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1))
    expect(toastError.mock.calls[0][0]).toMatch(/could not be downloaded/)
  })

  it("is not available to any other role", () => {
    renderWithSession(<ChedReportsWorkspace />, {
      session: { ...registrarHead, role: "registrar_staff" },
    })

    expect(
      screen.getByText("This workspace is not available for your role."),
    ).toBeInTheDocument()
    expect(urls().some((u) => u.includes("/ched-reports"))).toBe(false)
  })
})
