import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AdmissionProvisioningWorkspace } from "@/features/components/portal/admission-provisioning-workspace"
import { renderWithSession } from "@/tests/render-app"

const profile = {
  type: "student_profile",
  id: 31,
  user_id: 41,
  student_number: "2027-08-01001",
  name: "Amina Santos",
  first_name: "Amina",
  middle_initial: null,
  last_name: "Santos",
  suffix: null,
  email: "amina.santos@grc.test",
  address: "123 Mabini Street, Caloocan City",
  program_id: 11,
  program_code: "BSIT",
  program_name: "Bachelor of Science in Information Technology",
  curriculum_id: 22,
  entry_year: 2027,
  curriculum_name: "BSIT 2027 Curriculum",
  curriculum_effective_school_year: "2027-2028",
  year_level: 1,
  enrollment_category: "regular",
  admission_status: "admitted",
  admission_status_label: "Admitted",
  academic_standing: "good",
  academic_standing_label: "Good Standing",
  financial_status: null,
  financial_status_label: null,
  requirements_verified_at: "2026-08-26T08:00:00Z",
  academic_setup_editable: true,
  account_setup_status: "pending",
  invitation_delivery_status: "sent",
} as const

const enrolledProfile = {
  ...profile,
  id: 32,
  student_number: "2026-08-01099",
  name: "Marco Dela Cruz",
  first_name: "Marco",
  last_name: "Dela Cruz",
  email: "marco.delacruz@grc.test",
  academic_setup_editable: false,
  account_setup_status: "active",
} as const

const pagination = {
  links: {
    first: "http://localhost/api?page=1",
    last: "http://localhost/api?page=1",
    prev: null,
    next: null,
  },
  meta: { current_page: 1, last_page: 1, per_page: 50, total: 1 },
}

const programs = {
  data: [
    {
      type: "program",
      id: 11,
      code: "BSIT",
      name: "Bachelor of Science in Information Technology",
      status: "active",
      status_label: "Active",
    },
  ],
}

const changeRequest = {
  type: "student_profile_change_request",
  id: 7,
  student_id: profile.id,
  student_number: profile.student_number,
  student_name: profile.name,
  status: "pending",
  status_label: "Pending",
  official: {
    name: profile.name,
    first_name: profile.first_name,
    middle_initial: profile.middle_initial,
    last_name: profile.last_name,
    suffix: profile.suffix,
    email: profile.email,
    address: profile.address,
  },
  requested: {
    name: "Amina Reyes Santos",
    first_name: profile.first_name,
    middle_initial: "Reyes",
    last_name: profile.last_name,
    suffix: null,
    email: "amina.reyes@grc.test",
    address: "Proposed Address, Caloocan City",
  },
  reason: "Correct my official personal information.",
  decision_notes: null,
  identity_verified_at: null,
  requested_at: "2026-08-26T08:00:00Z",
  decided_at: null,
} as const

function urlOf(input: RequestInfo | URL): string {
  return typeof input === "string"
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url
}

function bodyOf(init: RequestInit | undefined): Record<string, unknown> {
  return typeof init?.body === "string"
    ? (JSON.parse(init.body) as Record<string, unknown>)
    : {}
}

function renderWorkspace() {
  return renderWithSession(<AdmissionProvisioningWorkspace />, {
    session: {
      userId: "5",
      displayName: "Admission Staff",
      role: "admission_staff",
      signedInAt: "2026-08-26T00:00:00Z",
    },
  })
}

describe("Student Records workspace", () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock)
    fetchMock.mockImplementation((input, init) => {
      const url = urlOf(input)
      if (url.includes("/api/v1/programs")) {
        return Promise.resolve(new Response(JSON.stringify(programs)))
      }
      if (url.includes("/api/v1/student-profiles") && init?.method === "POST") {
        return Promise.resolve(
          new Response(JSON.stringify({ data: profile }), { status: 201 }),
        )
      }
      if (url.includes("/api/v1/student-profiles")) {
        return Promise.resolve(
          new Response(JSON.stringify({ data: [profile], ...pagination })),
        )
      }
      if (url.includes("/api/v1/student-profile-change-requests")) {
        return Promise.resolve(
          new Response(JSON.stringify({ data: [], ...pagination })),
        )
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`))
    })
  })

  afterEach(() => vi.unstubAllGlobals())

  it("uses one three-part workspace and creates an account only after requirements confirmation", async () => {
    const user = userEvent.setup()
    renderWorkspace()

    expect(
      screen.getByRole("heading", { name: "Student Records" }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Create Account",
      "Student Directory",
      "Change Requests",
    ])
    expect(screen.queryByLabelText("Curriculum")).not.toBeInTheDocument()
    expect(screen.queryByText(/temporary credential/i)).not.toBeInTheDocument()

    await user.type(screen.getByLabelText("First name"), profile.first_name)
    await user.type(screen.getByLabelText("Last name"), profile.last_name)
    await user.type(screen.getByLabelText("Email address"), profile.email)
    await user.type(screen.getByLabelText("Complete address"), profile.address)
    await user.clear(screen.getByLabelText("Student number"))
    await user.type(
      screen.getByLabelText("Student number"),
      profile.student_number,
    )
    await user.clear(screen.getByLabelText("Entry year"))
    await user.type(screen.getByLabelText("Entry year"), "2027")
    await user.click(screen.getByLabelText("Program"))
    await user.click(
      await screen.findByRole("option", {
        name: "BSIT — Bachelor of Science in Information Technology",
      }),
    )

    const submit = screen.getByRole("button", {
      name: "Create account and email setup",
    })
    await user.click(submit)
    expect(
      await screen.findByText(
        "Confirm that Admission received the student's requirements.",
      ),
    ).toBeInTheDocument()

    await user.click(
      screen.getByLabelText("Requirements submitted and verified"),
    )
    await user.click(submit)

    expect(await screen.findByText("Awaiting setup")).toBeInTheDocument()
    const provisioningCall = fetchMock.mock.calls.find(
      ([input, init]) =>
        urlOf(input).endsWith("/api/v1/student-profiles") &&
        init?.method === "POST",
    )
    const body = bodyOf(provisioningCall?.[1])
    expect(body).toMatchObject({
      first_name: profile.first_name,
      last_name: profile.last_name,
      address: profile.address,
      requirements_verified: true,
      entry_year: 2027,
    })
    expect(body).not.toHaveProperty("password")
    expect(body).not.toHaveProperty("curriculum_id")
  })

  it("searches by name and opens the full student profile editor", async () => {
    const user = userEvent.setup()
    renderWorkspace()

    await user.click(screen.getByRole("tab", { name: "Student Directory" }))
    await user.type(screen.getByLabelText("Search student records"), "Amina")
    await user.click(screen.getByRole("button", { name: "Search" }))

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: profile.name }),
      ).toBeInTheDocument(),
    )
    await user.click(screen.getByRole("button", { name: profile.name }))

    expect(
      screen.getByRole("dialog", { name: profile.name }),
    ).toBeInTheDocument()
    expect(screen.getByDisplayValue(profile.email)).toBeInTheDocument()
    expect(screen.getByDisplayValue(profile.address)).toBeInTheDocument()
    expect(
      screen.getByLabelText("Identity verified in person at Admission"),
    ).toBeInTheDocument()
  })

  it("locks the academic setup selectors once a student already has an enrollment", async () => {
    fetchMock.mockImplementation((input, init) => {
      const url = urlOf(input)
      if (url.includes("/api/v1/programs")) {
        return Promise.resolve(new Response(JSON.stringify(programs)))
      }
      if (
        url.includes(`/api/v1/student-profiles/${enrolledProfile.id}`) &&
        init?.method === "PATCH"
      ) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: { ...enrolledProfile, address: "Updated Address" },
            }),
          ),
        )
      }
      if (url.includes("/api/v1/student-profiles")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ data: [enrolledProfile], ...pagination }),
          ),
        )
      }
      if (url.includes("/api/v1/student-profile-change-requests")) {
        return Promise.resolve(
          new Response(JSON.stringify({ data: [], ...pagination })),
        )
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`))
    })
    const user = userEvent.setup()
    renderWorkspace()

    await user.click(screen.getByRole("tab", { name: "Student Directory" }))
    await user.type(
      screen.getByLabelText("Search student records"),
      enrolledProfile.name,
    )
    await user.click(screen.getByRole("button", { name: "Search" }))
    await user.click(
      await screen.findByRole("button", { name: enrolledProfile.name }),
    )

    expect(
      screen.getByRole("dialog", { name: enrolledProfile.name }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "Student number, program, entry year, year level, category, financial status, and admission status are locked because this student already has an enrollment.",
      ),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText("Student number")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Program")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Entry year")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Year level")).not.toBeInTheDocument()
    expect(
      screen.queryByLabelText("Enrollment category"),
    ).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Financial status")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Admission status")).not.toBeInTheDocument()

    expect(screen.getByLabelText("First name")).toBeInTheDocument()
    expect(screen.getByLabelText("Last name")).toBeInTheDocument()
    expect(screen.getByLabelText("Middle initial")).toBeInTheDocument()
    expect(screen.getByLabelText("Suffix")).toBeInTheDocument()
    expect(screen.getByLabelText("Email")).toBeInTheDocument()
    const address = screen.getByLabelText("Complete address")
    await user.clear(address)
    await user.type(address, "Updated Address")
    await user.type(
      screen.getByLabelText("Reason for correction"),
      "Student presented an updated barangay certificate.",
    )
    await user.click(
      screen.getByLabelText("Identity verified in person at Admission"),
    )
    await user.click(
      screen.getByRole("button", { name: "Save verified correction" }),
    )

    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(
        ([reqInput, reqInit]) =>
          urlOf(reqInput).endsWith(
            `/api/v1/student-profiles/${enrolledProfile.id}`,
          ) && reqInit?.method === "PATCH",
      )
      expect(patchCall).toBeDefined()
      const body = bodyOf(patchCall?.[1])
      expect(body).toMatchObject({ address: "Updated Address" })
      expect(body).not.toHaveProperty("student_number")
      expect(body).not.toHaveProperty("program_id")
      expect(body).not.toHaveProperty("entry_year")
      expect(body).not.toHaveProperty("year_level")
      expect(body).not.toHaveProperty("enrollment_category")
      expect(body).not.toHaveProperty("financial_status")
      expect(body).not.toHaveProperty("admission_status")
    })
  })

  it("compares requested values and requires in-person verification before approval", async () => {
    fetchMock.mockImplementation((input, init) => {
      const url = urlOf(input)
      if (url.includes("/api/v1/programs")) {
        return Promise.resolve(new Response(JSON.stringify(programs)))
      }
      if (url.endsWith("/decision") && init?.method === "PATCH") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: {
                ...changeRequest,
                status: "approved",
                status_label: "Approved",
                official: changeRequest.requested,
                identity_verified_at: "2026-08-26T09:00:00Z",
                decided_at: "2026-08-26T09:00:00Z",
              },
            }),
          ),
        )
      }
      if (url.includes("student-profile-change-requests")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ data: [changeRequest], ...pagination }),
          ),
        )
      }
      return Promise.resolve(new Response(JSON.stringify({ data: [] })))
    })
    const user = userEvent.setup()
    renderWorkspace()

    await user.click(screen.getByRole("tab", { name: "Change Requests" }))
    await user.click(await screen.findByRole("button", { name: "Review" }))

    expect(screen.getByText(changeRequest.official.email)).toBeInTheDocument()
    expect(screen.getByText(changeRequest.requested.email)).toBeInTheDocument()
    const approve = screen.getByRole("button", { name: "Approve changes" })
    expect(approve).toBeDisabled()
    await user.click(
      screen.getByLabelText("Student identity verified in person at Admission"),
    )
    expect(approve).toBeEnabled()
    await user.click(approve)

    await waitFor(() => {
      const decision = fetchMock.mock.calls.find(
        ([input, init]) =>
          urlOf(input).endsWith("/decision") && init?.method === "PATCH",
      )
      expect(bodyOf(decision?.[1])).toEqual({
        action: "approve",
        identity_verified_in_person: true,
      })
    })
  })
})
