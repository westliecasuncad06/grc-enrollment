import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { toast } from "sonner"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AdmissionProvisioningWorkspace } from "@/features/components/portal/admission-provisioning-workspace"
import { renderWithSession } from "@/tests/render-app"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

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
  student_type: "freshman",
  student_type_label: "Freshman",
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
    {
      type: "program",
      id: 13,
      code: "BSCRIM",
      name: "BS Criminology",
      status: "inactive",
      status_label: "Inactive",
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

// What the Create Account form lists for a Year 1 (Freshman) student.
const intakeRequirements = {
  data: {
    type: "admission_requirement_selection",
    student_type: "freshman",
    student_type_label: "Freshman",
    categories: [
      {
        category: "freshman",
        label: "Freshman requirements",
        items: [
          { requirement_type_id: 1, name: "Form 137", is_system: true },
          { requirement_type_id: 2, name: "Form 138", is_system: true },
        ],
      },
      {
        category: "additional",
        label: "Additional requirements",
        items: [
          {
            requirement_type_id: 7,
            name: "Original Birth Certificate (PSA)",
            is_system: true,
          },
        ],
      },
    ],
  },
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
      if (url.includes("/api/v1/admission-requirement-types")) {
        return Promise.resolve(new Response(JSON.stringify(intakeRequirements)))
      }
      if (url.includes("/api/v1/student-profiles") && init?.method === "POST") {
        return Promise.resolve(
          new Response(JSON.stringify({ data: profile }), { status: 201 }),
        )
      }
      if (url.includes(`/api/v1/student-profiles/${profile.id}/admission-requirements`)) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: {
                type: "admission_requirements",
                student: {
                  student_profile_id: profile.id,
                  student_number: profile.student_number,
                  name: profile.name,
                  student_type: "freshman",
                  student_type_label: "Freshman",
                  admission_status: "admitted",
                },
                categories: [
                  {
                    category: "freshman",
                    label: "Freshman requirements",
                    items: [
                      {
                        requirement_type_id: 1,
                        name: "Form 137",
                        is_system: true,
                        is_submitted: false,
                        submitted_at: null,
                      },
                    ],
                  },
                ],
                summary: {
                  required_count: 1,
                  submitted_count: 0,
                  missing_count: 1,
                  complete: false,
                },
              },
            }),
          ),
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

  it("uses one three-part workspace and creates an account with the category, type and ticked requirements Admission chose", async () => {
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
    // The server still derives the entry year; the category and the type are Admission's choice.
    expect(screen.queryByLabelText("Entry year")).not.toBeInTheDocument()
    expect(screen.getByLabelText("Enrollment category")).toBeInTheDocument()
    expect(screen.getByLabelText("Student type")).toBeInTheDocument()

    await user.type(screen.getByLabelText("First name"), profile.first_name)
    await user.type(screen.getByLabelText("Last name"), profile.last_name)
    await user.type(screen.getByLabelText("Email address"), profile.email)
    await user.type(screen.getByLabelText("Complete address"), profile.address)
    const studentNumberField = screen.getByLabelText("Student number")
    expect(studentNumberField).toHaveAttribute("readonly")
    await user.type(studentNumberField, "0000-00-00000")
    expect(studentNumberField).not.toHaveValue("0000-00-00000")
    await user.click(screen.getByLabelText("Program"))
    await user.click(
      await screen.findByRole("option", {
        name: "BSIT — Bachelor of Science in Information Technology",
      }),
    )

    const submit = screen.getByRole("button", {
      name: "Create account and email setup",
    })
    // The single "verified" box is gone, and with no student type picked there is nothing to tick yet.
    expect(
      screen.queryByLabelText("Requirements submitted and verified"),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(
        "Choose the student type to see the Admission requirements that apply.",
      ),
    ).toBeInTheDocument()

    // Submitting without the two choices stops at the form and takes Admission to the first one.
    const scrollIntoView = vi
      .spyOn(window.HTMLElement.prototype, "scrollIntoView")
      .mockImplementation(() => undefined)
    await user.click(submit)
    expect(
      await screen.findByText("Select the enrollment category."),
    ).toBeInTheDocument()
    expect(screen.getByText("Select the student type.")).toBeInTheDocument()
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled())
    // The first thing that needs fixing is the first invalid field on the form, not the button.
    expect(scrollIntoView.mock.contexts[0]).toBeInstanceOf(HTMLElement)
    scrollIntoView.mockRestore()
    expect(
      fetchMock.mock.calls.some(
        ([input, init]) =>
          urlOf(input).endsWith("/api/v1/student-profiles") &&
          init?.method === "POST",
      ),
    ).toBe(false)

    await user.click(screen.getByLabelText("Enrollment category"))
    await user.click(await screen.findByRole("option", { name: "Regular" }))
    await user.click(screen.getByLabelText("Student type"))
    await user.click(await screen.findByRole("option", { name: "Transferee" }))

    expect(
      await screen.findByRole("checkbox", { name: "Form 137" }),
    ).not.toBeChecked()
    expect(screen.getByText("0 of 3 checked")).toBeInTheDocument()

    // Two of the three handed in: the account is still created, the third stays missing.
    await user.click(screen.getByRole("checkbox", { name: "Form 137" }))
    await user.click(screen.getByRole("checkbox", { name: "Form 138" }))
    expect(screen.getByText("2 of 3 checked")).toBeInTheDocument()
    await user.click(submit)

    expect(await screen.findByText("Awaiting setup")).toBeInTheDocument()
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        `Account created and setup email sent to ${profile.email}.`,
      ),
    )
    const resendBtn = screen.getByRole("button", {
      name: "Resend setup email",
    })
    expect(resendBtn).toBeInTheDocument()

    // The itemized Admission checklist appears immediately after the account
    // is created, so staff never have to separately search the student back
    // up in the directory to find it (stakeholder Doc 16).
    expect(
      await screen.findByRole("heading", { name: "Admission requirements" }),
    ).toBeInTheDocument()
    expect(
      await screen.findByRole("checkbox", { name: "Form 137" }),
    ).toBeInTheDocument()
    // The form is ready for the next account: nothing carried over.
    expect(
      screen.getByText(
        "Choose the student type to see the Admission requirements that apply.",
      ),
    ).toBeInTheDocument()
    await user.click(resendBtn)
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([input, init]) =>
            urlOf(input).includes(
              `/api/v1/student-profiles/${profile.id}/account-setup-invitations`,
            ) && init?.method === "POST",
        ),
      ).toBe(true)
    })

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
      enrollment_category: "regular",
      student_type: "transferee",
      requirement_type_ids: [1, 2],
    })
    expect(body).not.toHaveProperty("requirements_verified")
    expect(body).not.toHaveProperty("password")
    expect(body).not.toHaveProperty("curriculum_id")
    expect(body).not.toHaveProperty("entry_year")
  })

  it("never offers a program that is switched off, such as BS Criminology", async () => {
    const user = userEvent.setup()
    renderWorkspace()

    await user.click(screen.getByLabelText("Program"))

    expect(
      await screen.findByRole("option", {
        name: "BSIT — Bachelor of Science in Information Technology",
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("option", { name: /BS Criminology/ }),
    ).not.toBeInTheDocument()
  })

  it("offers Freshman as a student type and lists the Freshman requirements for it", async () => {
    const user = userEvent.setup()
    renderWorkspace()

    await user.click(screen.getByLabelText("Student type"))
    await user.click(await screen.findByRole("option", { name: "Freshman" }))

    expect(screen.getByLabelText("Student type")).toHaveTextContent("Freshman")
    // The checklist for that type is requested (not the Transferee one).
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) =>
          urlOf(input).includes("admission-requirement-types?student_type=freshman"),
        ),
      ).toBe(true),
    )
    expect(
      await screen.findByRole("checkbox", { name: "Form 137" }),
    ).toBeInTheDocument()
  })

  it("lets Admission choose the enrollment category and student type from dropdowns, with nothing set automatically", async () => {
    const user = userEvent.setup()
    renderWorkspace()

    // No value is filled in for them, whatever the year level.
    expect(screen.getByLabelText("Enrollment category")).toHaveTextContent(
      "Select a category",
    )
    expect(screen.getByLabelText("Student type")).toHaveTextContent(
      "Select a student type",
    )

    await user.click(screen.getByLabelText("Enrollment category"))
    expect(
      (await screen.findAllByRole("option")).map((option) => option.textContent),
    ).toEqual(["Regular", "Irregular"])
    await user.click(screen.getByRole("option", { name: "Irregular" }))

    await user.click(screen.getByLabelText("Student type"))
    expect(
      (await screen.findAllByRole("option")).map((option) => option.textContent),
    ).toEqual(["Freshman", "Transferee", "Returnee", "Existing Student"])
    await user.click(screen.getByRole("option", { name: "Existing Student" }))

    // Changing the year level no longer rewrites what was chosen.
    await user.click(screen.getByLabelText("Year level"))
    await user.click(await screen.findByRole("option", { name: "2nd Year" }))
    expect(screen.getByLabelText("Enrollment category")).toHaveTextContent(
      "Irregular",
    )
    expect(screen.getByLabelText("Student type")).toHaveTextContent(
      "Existing Student",
    )
  })

  it("searches by name and opens the full student profile editor", async () => {
    const user = userEvent.setup()
    renderWorkspace()

    await user.click(screen.getByRole("tab", { name: "Student Directory" }))
    await user.type(screen.getByLabelText("Search student records"), "Amina")
    await user.click(screen.getByRole("button", { name: "Search" }))

    // The directory now renders through the shared DataTable (Stakeholder
    // Doc 17), which doubles every row into a real table (desktop) and a
    // card list (phone) — queries below are scoped to the table to avoid
    // matching both.
    const table = await screen.findByRole("table", {
      name: "Student directory",
    })
    await waitFor(() =>
      expect(
        within(table).getByRole("button", { name: profile.name }),
      ).toBeInTheDocument(),
    )
    expect(
      within(table).getByRole("button", { name: "Resend email" }),
    ).toBeInTheDocument()
    // The student number/email line must be allowed to wrap on a narrow
    // phone screen instead of forcing horizontal scroll (Stakeholder Doc 17).
    expect(
      within(table).getByText(
        `${profile.student_number} · ${profile.email}`,
      ),
    ).toHaveClass("whitespace-normal")
    // The phone card list must carry the same student-number/email text too
    // — it is its own, separate rendering, not just a CSS-hidden duplicate.
    expect(
      screen.getAllByText(`${profile.student_number} · ${profile.email}`),
    ).toHaveLength(2)
    await user.click(within(table).getByRole("button", { name: profile.name }))

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
      if (url.includes("/api/v1/admission-requirement-types")) {
        return Promise.resolve(new Response(JSON.stringify(intakeRequirements)))
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
    const directoryTable = await screen.findByRole("table", {
      name: "Student directory",
    })
    await user.click(
      await within(directoryTable).findByRole("button", {
        name: enrolledProfile.name,
      }),
    )

    expect(
      screen.getByRole("dialog", { name: enrolledProfile.name }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "Student number, program, year level, and admission status are locked because this student already has an enrollment. Entry year, enrollment category, and student type are always set automatically and are never directly editable.",
      ),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText("Student number")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Program")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Entry year")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Year level")).not.toBeInTheDocument()
    expect(
      screen.queryByLabelText("Enrollment category"),
    ).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Student type")).not.toBeInTheDocument()
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
      expect(body).not.toHaveProperty("student_type")
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
      if (url.includes("/api/v1/admission-requirement-types")) {
        return Promise.resolve(new Response(JSON.stringify(intakeRequirements)))
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
