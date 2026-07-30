import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { AdmissionProvisioningWorkspace } from "@/features/components/portal/admission-provisioning-workspace"
import { renderWithSession } from "@/tests/render-app"

const credential = "Aa1!Aa1!Aa1!Aa1!Aa1!"
const writeTextMock = vi.fn<(value: string) => Promise<void>>()

const profile = {
  type: "student_profile",
  id: 31,
  user_id: 41,
  student_number: "STU-2027-1001",
  program_id: 11,
  curriculum_id: 22,
  year_level: 1,
  admission_status: "admitted",
  admission_status_label: "Admitted",
  academic_standing: "good",
  academic_standing_label: "Good",
} as const

const programs = {
  data: [
    {
      type: "program",
      id: 11,
      code: "BSCS",
      name: "BS Computer Science",
      status: "active",
      status_label: "Active",
    },
    {
      type: "program",
      id: 12,
      code: "BSIT",
      name: "BS Information Technology",
      status: "active",
      status_label: "Active",
    },
  ],
} as const

const curricula = {
  data: [
    {
      type: "curriculum",
      id: 22,
      program_id: 11,
      name: "BSCS 2026 Curriculum",
      effective_school_year: "2026-2027",
      status: "active",
      status_label: "Active",
      subjects: [],
    },
    {
      type: "curriculum",
      id: 23,
      program_id: 12,
      name: "BSIT 2026 Curriculum",
      effective_school_year: "2026-2027",
      status: "active",
      status_label: "Active",
      subjects: [],
    },
  ],
} as const

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input
  }

  return input instanceof URL ? input.toString() : input.url
}

function renderWorkspace(
  initialModuleId = "student-accounts",
  generateCredential = () => credential,
  writeCredential = writeTextMock,
) {
  return renderWithSession(
    <AdmissionProvisioningWorkspace
      initialModuleId={initialModuleId}
      generateCredential={generateCredential}
      writeCredential={writeCredential}
    />,
    {
      session: {
        userId: "5",
        displayName: "Admission Staff",
        role: "admission_staff",
        signedInAt: "2026-07-29T12:00:00Z",
      },
    },
  )
}

async function completeForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Student name"), "Amina Santos")
  await user.type(
    screen.getByLabelText("Email address"),
    "amina.santos@grc.test",
  )
  await user.type(screen.getByLabelText("Student number"), "STU-2027-1001")
  await user.selectOptions(screen.getByLabelText("Program"), "11")
  await user.selectOptions(screen.getByLabelText("Curriculum"), "22")
  await user.selectOptions(screen.getByLabelText("Year level"), "1")
}

describe("AdmissionProvisioningWorkspace", () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock)
    writeTextMock.mockReset()
    writeTextMock.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("provisions a selected program and curriculum, then shows and clears the one-time credential receipt", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation((request) => {
      const url = requestUrl(request)
      if (url.endsWith("/programs")) {
        return Promise.resolve(
          new Response(JSON.stringify(programs), { status: 200 }),
        )
      }
      if (url.endsWith("/curricula")) {
        return Promise.resolve(
          new Response(JSON.stringify(curricula), { status: 200 }),
        )
      }
      return Promise.resolve(
        new Response(JSON.stringify({ data: profile }), { status: 201 }),
      )
    })

    renderWorkspace()
    await screen.findByRole("option", { name: "BSCS — BS Computer Science" })
    await completeForm(user)
    await user.click(
      screen.getByRole("button", { name: "Create student account" }),
    )

    expect(
      await screen.findByText("Student account created"),
    ).toBeInTheDocument()
    expect(screen.getByText(credential)).toBeInTheDocument()
    expect(screen.getByText("Admission status: Admitted")).toBeInTheDocument()
    expect(screen.getByText("Academic standing: Good")).toBeInTheDocument()
    const [url, request] = fetchMock.mock.calls.at(-1) as [string, RequestInit]
    if (typeof request.body !== "string") {
      throw new Error(
        "Expected the provisioning request to contain a JSON body.",
      )
    }

    expect(url).toBe("http://127.0.0.1:8000/api/v1/student-profiles")
    expect(request.method).toBe("POST")
    expect(JSON.parse(request.body) as Record<string, unknown>).toEqual({
      name: "Amina Santos",
      email: "amina.santos@grc.test",
      password: credential,
      student_number: "STU-2027-1001",
      program_id: 11,
      curriculum_id: 22,
      year_level: 1,
    })

    await user.click(
      screen.getByRole("button", { name: "Copy temporary credential" }),
    )
    expect(writeTextMock).toHaveBeenCalledWith(credential)
    expect(screen.getByRole("status")).toHaveTextContent("Credential copied")
    await user.click(
      screen.getByRole("button", { name: "Close credential receipt" }),
    )
    expect(screen.queryByText(credential)).not.toBeInTheDocument()
  })

  it("maps a 422 validation response to the named form field", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation((request) => {
      const url = requestUrl(request)
      if (url.endsWith("/programs")) {
        return Promise.resolve(
          new Response(JSON.stringify(programs), { status: 200 }),
        )
      }
      if (url.endsWith("/curricula")) {
        return Promise.resolve(
          new Response(JSON.stringify(curricula), { status: 200 }),
        )
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            error: {
              code: "VALIDATION_FAILED",
              message: "The submitted data is invalid.",
              errors: { email: ["The email has already been taken."] },
              request_id: "request-4",
            },
          }),
          { status: 422 },
        ),
      )
    })

    renderWorkspace()
    await screen.findByRole("option", { name: "BSCS — BS Computer Science" })
    await completeForm(user)
    await user.click(
      screen.getByRole("button", { name: "Create student account" }),
    )

    expect(
      await screen.findByText("The email has already been taken."),
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Email address")).toHaveAttribute(
      "aria-invalid",
      "true",
    )
  })

  it("clears the selected curriculum from form state when the program changes", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation((request) => {
      const url = requestUrl(request)
      if (url.endsWith("/programs")) {
        return Promise.resolve(
          new Response(JSON.stringify(programs), { status: 200 }),
        )
      }

      return Promise.resolve(
        new Response(JSON.stringify(curricula), { status: 200 }),
      )
    })

    renderWorkspace()
    await screen.findByRole("option", { name: "BSCS — BS Computer Science" })
    await user.selectOptions(screen.getByLabelText("Program"), "11")
    await user.selectOptions(screen.getByLabelText("Curriculum"), "22")
    expect(screen.getByLabelText("Curriculum")).toHaveValue("22")

    await user.selectOptions(screen.getByLabelText("Program"), "12")

    expect(screen.getByLabelText("Curriculum")).toHaveValue("0")
    expect(
      screen.getByRole("option", {
        name: "BSIT 2026 Curriculum (2026-2027)",
      }),
    ).toBeInTheDocument()

    await user.type(screen.getByLabelText("Student name"), "Amina Santos")
    await user.type(
      screen.getByLabelText("Email address"),
      "amina.santos@grc.test",
    )
    await user.type(screen.getByLabelText("Student number"), "STU-2027-1001")
    await user.selectOptions(screen.getByLabelText("Year level"), "1")
    await user.click(
      screen.getByRole("button", { name: "Create student account" }),
    )

    expect(await screen.findByText("Select a curriculum.")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("announces a clipboard denial without persisting the credential", async () => {
    const user = userEvent.setup()
    writeTextMock.mockRejectedValueOnce(
      new DOMException("Denied", "NotAllowedError"),
    )
    fetchMock.mockImplementation((request) => {
      const url = requestUrl(request)
      if (url.endsWith("/programs")) {
        return Promise.resolve(
          new Response(JSON.stringify(programs), { status: 200 }),
        )
      }
      if (url.endsWith("/curricula")) {
        return Promise.resolve(
          new Response(JSON.stringify(curricula), { status: 200 }),
        )
      }
      return Promise.resolve(
        new Response(JSON.stringify({ data: profile }), { status: 201 }),
      )
    })

    renderWorkspace()
    await screen.findByRole("option", { name: "BSCS — BS Computer Science" })
    await completeForm(user)
    await user.click(
      screen.getByRole("button", { name: "Create student account" }),
    )
    await screen.findByText("Student account created")
    await user.click(
      screen.getByRole("button", { name: "Copy temporary credential" }),
    )

    expect(screen.getByRole("status")).toHaveTextContent(
      "Credential copy is unavailable in this browser.",
    )
  })

  it("disables a duplicate submission while provisioning is pending", async () => {
    const user = userEvent.setup()
    let resolveProvision: (response: Response) => void = () => undefined
    fetchMock.mockImplementation((request) => {
      const url = requestUrl(request)
      if (url.endsWith("/programs")) {
        return Promise.resolve(
          new Response(JSON.stringify(programs), { status: 200 }),
        )
      }
      if (url.endsWith("/curricula")) {
        return Promise.resolve(
          new Response(JSON.stringify(curricula), { status: 200 }),
        )
      }
      return new Promise((resolve) => {
        resolveProvision = resolve
      })
    })

    renderWorkspace()
    await screen.findByRole("option", { name: "BSCS — BS Computer Science" })
    await completeForm(user)
    await user.click(
      screen.getByRole("button", { name: "Create student account" }),
    )

    expect(
      screen.getByRole("button", { name: "Creating student account…" }),
    ).toBeDisabled()
    resolveProvision(
      new Response(JSON.stringify({ data: profile }), { status: 201 }),
    )
    await screen.findByText("Student account created")
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it("replaces a failed attempt's temporary credential on retry", async () => {
    const user = userEvent.setup()
    let provisionAttempts = 0
    const attemptedPasswords: string[] = []
    const firstCredential = "Bb2!Bb2!Bb2!Bb2!Bb2!"
    const retryCredential = "Cc3@Cc3@Cc3@Cc3@Cc3@"
    let credentialIndex = 0
    fetchMock.mockImplementation((request, init) => {
      const url = requestUrl(request)
      if (url.endsWith("/programs")) {
        return Promise.resolve(
          new Response(JSON.stringify(programs), { status: 200 }),
        )
      }
      if (url.endsWith("/curricula")) {
        return Promise.resolve(
          new Response(JSON.stringify(curricula), { status: 200 }),
        )
      }
      provisionAttempts += 1
      if (typeof init?.body !== "string") {
        throw new Error("Expected a JSON provisioning request.")
      }
      attemptedPasswords.push(
        (JSON.parse(init.body) as { password: string }).password,
      )
      if (provisionAttempts === 1) {
        return Promise.reject(new TypeError("Network unavailable"))
      }
      return Promise.resolve(
        new Response(JSON.stringify({ data: profile }), { status: 201 }),
      )
    })

    renderWorkspace("credential-issuance", () => {
      const generated = [firstCredential, retryCredential][credentialIndex]
      credentialIndex += 1
      return generated
    })
    expect(
      screen.getByRole("heading", { name: "Credential issuance" }),
    ).toBeInTheDocument()
    await screen.findByRole("option", { name: "BSCS — BS Computer Science" })
    await completeForm(user)
    await user.click(
      screen.getByRole("button", { name: "Create student account" }),
    )

    expect(
      await screen.findByText(
        "The student account could not be created. Check the connection and try again.",
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText(firstCredential)).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Try again" }))

    await waitFor(() => {
      expect(screen.getByText("Student account created")).toBeInTheDocument()
    })
    expect(provisionAttempts).toBe(2)
    expect(attemptedPasswords).toEqual([firstCredential, retryCredential])
    expect(screen.getByText(retryCredential)).toBeInTheDocument()
    expect(screen.queryByText(firstCredential)).not.toBeInTheDocument()
  })

  it("has no detectable accessibility violations once loaded", async () => {
    fetchMock.mockImplementation((request) => {
      const url = requestUrl(request)
      if (url.endsWith("/programs")) {
        return Promise.resolve(
          new Response(JSON.stringify(programs), { status: 200 }),
        )
      }
      return Promise.resolve(
        new Response(JSON.stringify(curricula), { status: 200 }),
      )
    })

    const { container } = renderWorkspace()
    await screen.findByRole("option", { name: "BSCS — BS Computer Science" })
    expect(await axe(container)).toHaveNoViolations()
  })
})
