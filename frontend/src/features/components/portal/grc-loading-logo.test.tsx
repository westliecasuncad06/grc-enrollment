import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { GrcLoadingLogo } from "@/features/components/portal/grc-loading-logo"

describe("GrcLoadingLogo", () => {
  it("announces the loading state while keeping the GRC monogram decorative", () => {
    render(<GrcLoadingLogo label="Loading enrollment workspace…" />)

    expect(
      screen.getByRole("status", { name: "Loading enrollment workspace…" }),
    ).toBeInTheDocument()
    expect(screen.getByText("GRC")).toHaveAttribute("aria-hidden", "true")
  })
})
