import { screen, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import {
  AnonymousOnly,
  RequireSession,
} from "@/features/auth/auth-route-guards"
import { routerMock } from "@/tests/navigation-mock"
import { renderWithSession, testSession } from "@/tests/render-app"

/**
 * Replaces the react-router `app-router.test.tsx` suite. Real URL changes are
 * no longer observable in jsdom, so each case asserts the redirect the guard
 * *requested* through the App Router. Genuine end-to-end navigation is
 * Playwright's job in roadmap Phase 8.
 */
describe("RequireSession", () => {
  it("holds the user on a restore state instead of redirecting", () => {
    renderWithSession(<RequireSession>portal content</RequireSession>, {
      route: "/portal",
      session: null,
      status: "restoring",
    })

    expect(screen.getByRole("status")).toHaveTextContent(
      "Restoring your session…",
    )
    expect(screen.queryByText("portal content")).not.toBeInTheDocument()
    expect(routerMock.replace).not.toHaveBeenCalled()
  })

  it("sends an anonymous visitor to sign in with a returnTo of the current path", async () => {
    renderWithSession(<RequireSession>portal content</RequireSession>, {
      route: "/portal",
      session: null,
      status: "anonymous",
    })

    await waitFor(() => {
      expect(routerMock.replace).toHaveBeenCalledWith(
        "/login?returnTo=%2Fportal",
      )
    })
    expect(screen.queryByText("portal content")).not.toBeInTheDocument()
  })

  it("preserves the query string in returnTo", async () => {
    renderWithSession(<RequireSession>portal content</RequireSession>, {
      route: "/portal/enrollment?tab=available",
      session: null,
      status: "anonymous",
    })

    await waitFor(() => {
      expect(routerMock.replace).toHaveBeenCalledWith(
        "/login?returnTo=%2Fportal%2Fenrollment%3Ftab%3Davailable",
      )
    })
  })

  it("renders the protected content for an authenticated session", () => {
    renderWithSession(<RequireSession>portal content</RequireSession>, {
      route: "/portal",
    })

    expect(screen.getByText("portal content")).toBeInTheDocument()
    expect(routerMock.replace).not.toHaveBeenCalled()
  })
})

describe("AnonymousOnly", () => {
  it("renders the sign-in page for an anonymous visitor", () => {
    renderWithSession(<AnonymousOnly>login form</AnonymousOnly>, {
      route: "/login",
      session: null,
      status: "anonymous",
    })

    expect(screen.getByText("login form")).toBeInTheDocument()
    expect(routerMock.replace).not.toHaveBeenCalled()
  })

  it("redirects an already-authenticated user away from sign-in", async () => {
    renderWithSession(<AnonymousOnly>login form</AnonymousOnly>, {
      route: "/login",
      session: testSession,
    })

    await waitFor(() => {
      expect(routerMock.replace).toHaveBeenCalledWith("/portal")
    })
    expect(screen.queryByText("login form")).not.toBeInTheDocument()
  })

  it("honors a safe returnTo when redirecting an authenticated user", async () => {
    renderWithSession(<AnonymousOnly>login form</AnonymousOnly>, {
      route: "/login?returnTo=%2Fportal%2Fenrollment",
      session: testSession,
    })

    await waitFor(() => {
      expect(routerMock.replace).toHaveBeenCalledWith("/portal/enrollment")
    })
  })

  it("refuses a hostile returnTo and falls back to the portal overview", async () => {
    renderWithSession(<AnonymousOnly>login form</AnonymousOnly>, {
      route: "/login?returnTo=https%3A%2F%2Fevil.example%2Fportal",
      session: testSession,
    })

    await waitFor(() => {
      expect(routerMock.replace).toHaveBeenCalledWith("/portal")
    })
    expect(routerMock.replace).not.toHaveBeenCalledWith(
      expect.stringContaining("evil.example"),
    )
  })
})
