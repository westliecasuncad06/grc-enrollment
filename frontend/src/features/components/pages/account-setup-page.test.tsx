import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { AccountSetupPage } from "@/features/components/pages/account-setup-page"
import { routerMock } from "@/tests/navigation-mock"
import { renderWithAuthProvider } from "@/tests/render-app"

function urlOf(input: RequestInfo | URL): string {
  return typeof input === "string"
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url
}

async function completeForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Email address"), "student@grc.test")
  await user.type(screen.getByLabelText("One-time setup code"), "one-time-code")
  await user.type(screen.getByLabelText("New password"), "secure-password")
  await user.type(
    screen.getByLabelText("Confirm new password"),
    "secure-password",
  )
}

describe("AccountSetupPage", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("submits the separate code and redirects to login after successful activation", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ data: { type: "account-setup", status: "active" } }),
        ),
      )
    vi.stubGlobal("fetch", fetchMock)
    const user = userEvent.setup()
    renderWithAuthProvider(<AccountSetupPage />, { route: "/account-setup" })

    await completeForm(user)
    await user.click(
      screen.getByRole("button", { name: "Create password and activate" }),
    )

    expect(
      await screen.findByRole("heading", { name: "Your account is active." }),
    ).toBeInTheDocument()
    const requestBody = fetchMock.mock.calls[0]?.[1]?.body
    const body: Record<string, unknown> =
      typeof requestBody === "string"
        ? (JSON.parse(requestBody) as Record<string, unknown>)
        : {}
    expect(body).toEqual({
      email: "student@grc.test",
      code: "one-time-code",
      password: "secure-password",
      password_confirmation: "secure-password",
    })
    const requestUrl = fetchMock.mock.calls[0]?.[0]
    expect(requestUrl ? urlOf(requestUrl) : "").not.toContain("one-time-code")

    await user.click(
      screen.getByRole("button", { name: "Continue to sign in" }),
    )
    expect(routerMock.replace).toHaveBeenCalledWith(
      "/login?accountSetup=complete",
    )
  })

  it("keeps the form visible for an invalid or expired code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: "VALIDATION_FAILED",
              message: "The given data was invalid.",
              errors: { code: ["The setup code is invalid or expired."] },
              request_id: "setup-test-request",
            },
          }),
          { status: 422 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderWithAuthProvider(<AccountSetupPage />, { route: "/account-setup" })

    await completeForm(user)
    await user.click(
      screen.getByRole("button", { name: "Create password and activate" }),
    )

    expect(
      await screen.findByText("The setup code is invalid or expired."),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Set up your account" }),
    ).toBeInTheDocument()
  })

  it("does not show a Full name field for the default (Student) variant", () => {
    renderWithAuthProvider(<AccountSetupPage />, { route: "/account-setup" })

    expect(screen.queryByLabelText("Full name")).not.toBeInTheDocument()
    expect(screen.getByText("Student account")).toBeInTheDocument()
  })

  it("lets a professor supply their name and posts to the faculty setup endpoint", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            data: { type: "faculty-account-setup", status: "active" },
          }),
        ),
      )
    vi.stubGlobal("fetch", fetchMock)
    const user = userEvent.setup()
    renderWithAuthProvider(<AccountSetupPage variant="faculty" />, {
      route: "/faculty-account-setup",
    })

    expect(screen.getByText("Faculty account")).toBeInTheDocument()

    await user.type(screen.getByLabelText("Email address"), "professor@grc.test")
    await user.type(screen.getByLabelText("One-time setup code"), "one-time-code")
    await user.type(screen.getByLabelText("Full name"), "Prof. Juan Dela Cruz")
    await user.type(screen.getByLabelText("New password"), "secure-password")
    await user.type(
      screen.getByLabelText("Confirm new password"),
      "secure-password",
    )
    await user.click(
      screen.getByRole("button", { name: "Create password and activate" }),
    )

    expect(
      await screen.findByRole("heading", { name: "Your account is active." }),
    ).toBeInTheDocument()
    const requestUrl = fetchMock.mock.calls[0]?.[0]
    expect(requestUrl ? urlOf(requestUrl) : "").toContain(
      "/auth/faculty-account-setup",
    )
    const requestBody = fetchMock.mock.calls[0]?.[1]?.body
    const body: Record<string, unknown> =
      typeof requestBody === "string"
        ? (JSON.parse(requestBody) as Record<string, unknown>)
        : {}
    expect(body).toEqual({
      email: "professor@grc.test",
      code: "one-time-code",
      name: "Prof. Juan Dela Cruz",
      password: "secure-password",
      password_confirmation: "secure-password",
    })
  })

  it("lets an invited staff member supply their name and posts to the staff setup endpoint", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            data: { type: "staff-account-setup", status: "active" },
          }),
        ),
      )
    vi.stubGlobal("fetch", fetchMock)
    const user = userEvent.setup()
    renderWithAuthProvider(<AccountSetupPage variant="staff" />, {
      route: "/staff-account-setup",
    })

    expect(screen.getByText("Staff account")).toBeInTheDocument()

    await user.type(screen.getByLabelText("Email address"), "dean@grc.test")
    await user.type(screen.getByLabelText("One-time setup code"), "one-time-code")
    await user.type(screen.getByLabelText("Full name"), "Aurora Dean Santos")
    await user.type(screen.getByLabelText("New password"), "secure-password")
    await user.type(
      screen.getByLabelText("Confirm new password"),
      "secure-password",
    )
    await user.click(
      screen.getByRole("button", { name: "Create password and activate" }),
    )

    expect(
      await screen.findByRole("heading", { name: "Your account is active." }),
    ).toBeInTheDocument()
    const requestUrl = fetchMock.mock.calls[0]?.[0]
    expect(requestUrl ? urlOf(requestUrl) : "").toContain(
      "/auth/staff-account-setup",
    )
    const requestBody = fetchMock.mock.calls[0]?.[1]?.body
    const body: Record<string, unknown> =
      typeof requestBody === "string"
        ? (JSON.parse(requestBody) as Record<string, unknown>)
        : {}
    expect(body).toEqual({
      email: "dean@grc.test",
      code: "one-time-code",
      name: "Aurora Dean Santos",
      password: "secure-password",
      password_confirmation: "secure-password",
    })
  })
})
