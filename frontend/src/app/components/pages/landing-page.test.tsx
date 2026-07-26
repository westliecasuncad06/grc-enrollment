import { screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { renderAppAtRoute } from "@/tests/render-app"

describe("LandingPage", () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => undefined))
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("presents the institutional identity and primary portal actions", async () => {
    renderAppAtRoute("/")

    expect(
      await screen.findByRole("heading", {
        name: "Enrollment, guided from first step to final record.",
      }),
    ).toBeInTheDocument()
    const banner = screen.getByRole("banner")
    expect(
      within(banner).getByText("Global Reciprocal Colleges"),
    ).toBeInTheDocument()
    expect(
      within(banner).getByText("Automated Enrollment System"),
    ).toBeInTheDocument()

    for (const link of screen.getAllByRole("link", {
      name: "Sign in to portal",
    })) {
      expect(link).toHaveAttribute("href", "/login")
    }

    expect(
      screen.getByRole("link", { name: "View system readiness" }),
    ).toHaveAttribute("href", "#system-readiness")
    expect(screen.getByRole("link", { name: "Portal guide" })).toHaveAttribute(
      "href",
      "#portal-guide",
    )
  })

  it("orients every portal audience without exposing private records", () => {
    renderAppAtRoute("/")

    const guide = screen.getByRole("region", {
      name: "One system, many responsibilities",
    })

    expect(
      within(guide).getByRole("heading", { name: "Students" }),
    ).toBeInTheDocument()
    expect(
      within(guide).getByRole("heading", {
        name: "Faculty & Program Chairs",
      }),
    ).toBeInTheDocument()
    expect(
      within(guide).getByRole("heading", {
        name: "Enrollment offices & leadership",
      }),
    ).toBeInTheDocument()
    expect(guide).toHaveTextContent(
      "Admissions, Registrar, Accounting, Dean, and Executive offices",
    )
  })

  it("shows the four-stage enrollment journey in order", () => {
    renderAppAtRoute("/")

    const journey = screen.getByRole("region", {
      name: "From schedule to final record",
    })
    const steps = within(journey).getAllByRole("listitem")

    expect(steps).toHaveLength(4)
    expect(steps[0]).toHaveTextContent("Schedule preparation")
    expect(steps[1]).toHaveTextContent(
      "Student subject selection and submission",
    )
    expect(steps[2]).toHaveTextContent("Authorized review and approval")
    expect(steps[3]).toHaveTextContent(
      "Payment confirmation and Digital COM finalization",
    )
  })

  it("embeds honest readiness and demo-boundary information", () => {
    renderAppAtRoute("/")

    const readiness = screen.getByRole("region", {
      name: "System readiness",
    })

    expect(readiness).toHaveAttribute("id", "system-readiness")
    expect(
      within(readiness).getByText("Contacting the public gateway…"),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Demo interface—no private student records are loaded."),
    ).toBeInTheDocument()
    expect(screen.queryByText(/100%|production ready/i)).not.toBeInTheDocument()
    expect(document.body).not.toHaveTextContent(/[\w.-]+@[\w.-]+\.[a-z]{2,}/i)
  })
})
