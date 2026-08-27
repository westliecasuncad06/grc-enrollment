import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  decideProfileChangeRequest,
  listStudentProfiles,
  provisionStudent,
  setupStudentAccount,
  type ProvisionStudentInput,
} from "@/features/services/admission-service"

const input: ProvisionStudentInput = {
  first_name: "Amina",
  middle_initial: "S",
  last_name: "Santos",
  email: "amina.santos@grc.test",
  address: "123 Mabini Street, Caloocan City",
  student_number: "2027-08-01001",
  program_id: 11,
  entry_year: 2027,
  year_level: 1,
  enrollment_category: "regular",
  requirements_verified: true,
}

const profile = {
  type: "student_profile",
  id: 31,
  user_id: 41,
  student_number: input.student_number,
  name: "Amina S. Santos",
  first_name: input.first_name,
  middle_initial: input.middle_initial ?? null,
  last_name: input.last_name,
  suffix: null,
  email: input.email,
  address: input.address,
  program_id: input.program_id,
  program_code: "BSIT",
  program_name: "Bachelor of Science in Information Technology",
  curriculum_id: 22,
  entry_year: input.entry_year,
  curriculum_name: "BSIT 2027 Curriculum",
  curriculum_effective_school_year: "2027-2028",
  year_level: input.year_level,
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

const page = {
  data: [profile],
  links: {
    first: "http://localhost/api/v1/student-profiles?page=1",
    last: "http://localhost/api/v1/student-profiles?page=1",
    prev: null,
    next: null,
  },
  meta: { current_page: 1, last_page: 1, per_page: 20, total: 1 },
}

describe("admission-service", () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => vi.stubGlobal("fetch", fetchMock))
  afterEach(() => vi.unstubAllGlobals())

  it("provisions with address and requirements verification without a password or curriculum override", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: profile }), { status: 201 }),
    )

    await expect(provisionStudent(input)).resolves.toEqual(profile)
    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body =
      typeof request.body === "string"
        ? (JSON.parse(request.body) as Record<string, unknown>)
        : {}

    expect(url).toBe("http://127.0.0.1:8000/api/v1/student-profiles")
    expect(request.method).toBe("POST")
    expect(body).toEqual(input)
    expect(body).not.toHaveProperty("password")
    expect(body).not.toHaveProperty("curriculum_id")
  })

  it("searches the Admission directory by name, student number, or email", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(page)))

    await expect(
      listStudentProfiles({ search: "Amina", page: 1, per_page: 20 }),
    ).resolves.toEqual(page)

    expect(fetchMock.mock.calls[0]?.[0]).toContain(
      "/api/v1/student-profiles?search=Amina&page=1&per_page=20",
    )
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "GET" })
  })

  it("keeps account setup public and sends Admission decisions to the dedicated endpoint", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: { type: "account-setup", status: "active" } }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              type: "student_profile_change_request",
              id: 7,
              student_id: 31,
              student_number: profile.student_number,
              student_name: profile.name,
              status: "approved",
              status_label: "Approved",
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
                name: profile.name,
                first_name: profile.first_name,
                middle_initial: profile.middle_initial,
                last_name: profile.last_name,
                suffix: profile.suffix,
                email: profile.email,
                address: profile.address,
              },
              reason: "Correction",
              decision_notes: null,
              identity_verified_at: "2026-08-26T08:10:00Z",
              requested_at: "2026-08-26T08:00:00Z",
              decided_at: "2026-08-26T08:10:00Z",
            },
          }),
        ),
      )

    await expect(
      setupStudentAccount({
        email: profile.email,
        code: "one-time-code",
        password: "secure-password",
        password_confirmation: "secure-password",
      }),
    ).resolves.toBe("active")
    await decideProfileChangeRequest(7, {
      action: "approve",
      identity_verified_in_person: true,
    })

    const setupRequest = fetchMock.mock.calls[0]?.[1]
    const setupHeaders = new Headers(setupRequest?.headers)
    expect(setupHeaders.has("Authorization")).toBe(false)
    expect(fetchMock.mock.calls[1]?.[0]).toContain(
      "/api/v1/student-profile-change-requests/7/decision",
    )
  })
})
