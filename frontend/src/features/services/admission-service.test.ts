import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  provisionStudent,
  type ProvisionStudentInput,
} from "@/features/services/admission-service"

const input: ProvisionStudentInput = {
  name: "Amina Santos",
  email: "amina.santos@grc.test",
  password: "N4!temporaryCredential",
  student_number: "STU-2027-1001",
  program_id: 11,
  curriculum_id: 22,
  year_level: 1,
}

const profile = {
  type: "student_profile",
  id: 31,
  user_id: 41,
  student_number: input.student_number,
  program_id: input.program_id,
  curriculum_id: input.curriculum_id,
  year_level: input.year_level,
  admission_status: "admitted",
  admission_status_label: "Admitted",
  academic_standing: "good",
  academic_standing_label: "Good",
} as const

describe("provisionStudent", () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("posts only the seven approved provisioning fields and parses the created profile", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: profile }), { status: 201 }),
    )

    await expect(provisionStudent(input)).resolves.toEqual(profile)

    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit]
    if (typeof request.body !== "string") {
      throw new Error(
        "Expected the provisioning request to contain a JSON body.",
      )
    }
    const body = JSON.parse(request.body) as Record<string, unknown>

    expect(url).toBe("http://127.0.0.1:8000/api/v1/student-profiles")
    expect(request.method).toBe("POST")
    expect(body).toEqual(input)
    expect(Object.keys(body).sort()).toEqual([
      "curriculum_id",
      "email",
      "name",
      "password",
      "program_id",
      "student_number",
      "year_level",
    ])
  })
})
