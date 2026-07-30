import { screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { StudentGradesComWorkspace } from "@/features/components/portal/student-grades-com-workspace"
import { renderWithSession } from "@/tests/render-app"

const paginationLinks = {
  first: "https://api.test/academic-grades?page=1",
  last: "https://api.test/academic-grades?page=1",
  prev: null,
  next: null,
}
const paginationMeta = {
  current_page: 1,
  last_page: 1,
  per_page: 20,
  total: 1,
}

const grade = {
  type: "academic_grade",
  id: 3,
  student_id: 4,
  student_number: "2026-0001",
  subject_id: 7,
  subject_code: "CS101",
  section_id: 5,
  academic_term_id: 2,
  final_grade: "1.50",
  remarks: null,
  status: "locked",
  status_label: "Locked",
  submitted_at: "2026-07-30T00:00:00Z",
  locked_at: "2026-07-30T00:00:00Z",
} as const

const document = {
  type: "enrollment_document",
  id: 1,
  enrollment_id: 9,
  student_number: "2026-0001",
  document_type: "com",
  document_type_label: "Certificate of Matriculation",
  document_number: "COM000009",
  generated_at: "2026-07-30T00:00:00Z",
} as const

const studentSession = {
  userId: "4",
  displayName: "Student",
  role: "student",
  signedInAt: "2026-07-29T12:00:00Z",
} as const

describe("StudentGradesComWorkspace", () => {
  const fetchMock = vi.fn<typeof fetch>()
  beforeEach(() => vi.stubGlobal("fetch", fetchMock))
  afterEach(() => vi.unstubAllGlobals())

  it("does not render for an unauthorized role", () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: [] })))
    renderWithSession(<StudentGradesComWorkspace />, {
      session: {
        userId: "5",
        displayName: "Registrar Head",
        role: "registrar_head",
        signedInAt: "2026-07-29T12:00:00Z",
      },
    })
    expect(
      screen.getByText("This workspace is not available for your role."),
    ).toBeInTheDocument()
  })

  it("shows the student's grades and generated Digital COM", async () => {
    fetchMock.mockImplementation((input) => {
      const target =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url
      if (target.includes("/academic-grades"))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: [grade],
              links: paginationLinks,
              meta: paginationMeta,
            }),
          ),
        )
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: [document],
            links: paginationLinks,
            meta: paginationMeta,
          }),
        ),
      )
    })
    renderWithSession(<StudentGradesComWorkspace />, {
      session: studentSession,
    })

    const table = await screen.findByRole("table", { name: "Grades" })
    expect(within(table).getByText(/CS101/)).toBeInTheDocument()
    expect(screen.getByText(/COM000009/)).toBeInTheDocument()
  })

  it("has no detectable accessibility violations once loaded", async () => {
    fetchMock.mockImplementation((input) => {
      const target =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url
      if (target.includes("/academic-grades"))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: [grade],
              links: paginationLinks,
              meta: paginationMeta,
            }),
          ),
        )
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: [document],
            links: paginationLinks,
            meta: paginationMeta,
          }),
        ),
      )
    })
    const { container } = renderWithSession(<StudentGradesComWorkspace />, {
      session: studentSession,
    })

    await screen.findByRole("table", { name: "Grades" })
    expect(await axe(container)).toHaveNoViolations()
  })
})
