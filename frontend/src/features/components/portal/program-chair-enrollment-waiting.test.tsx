import { screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ProgramChairEnrollmentWorkspace } from "@/features/components/portal/program-chair-enrollment-workspace"
import { renderWithSession } from "@/tests/render-app"

describe("Program Chair enrollment startup state", () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("waits for Registrar when no actionable academic term exists", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), { status: 200 }),
    )

    renderWithSession(<ProgramChairEnrollmentWorkspace />, {
      session: {
        userId: "4",
        displayName: "CCS Chair",
        role: "program_chair",
        college: "ccs",
        signedInAt: "2026-08-02T00:00:00Z",
      },
    })

    expect(
      await screen.findByText(
        /Waiting for Registrar for the school year and semester\./,
      ),
    ).toBeInTheDocument()
  })
})
