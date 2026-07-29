import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ScheduleDecisionWorkspace } from "@/features/components/portal/schedule-decision-workspace"
import { availableScheduleActions } from "@/features/services/scheduling-service"
import { renderWithSession } from "@/tests/render-app"

const draftProposal = {
  type: "schedule_proposal",
  id: 9,
  academic_term_id: 2,
  submitted_by: 4,
  status: "draft",
  status_label: "Draft",
  decided_by: null,
  decided_at: null,
  decision_reason: null,
} as const
const deanApprovedProposal = {
  ...draftProposal,
  status: "dean_approved",
  status_label: "Dean approved",
} as const
const publishedProposal = {
  ...draftProposal,
  status: "published",
  status_label: "Published",
} as const
const proposals = {
  data: [draftProposal, deanApprovedProposal, publishedProposal],
}

describe("ScheduleDecisionWorkspace", () => {
  const fetchMock = vi.fn<typeof fetch>()
  beforeEach(() => vi.stubGlobal("fetch", fetchMock))
  afterEach(() => vi.unstubAllGlobals())

  it("exposes only API-legal actions for each decision role and status", () => {
    expect(availableScheduleActions("dean", draftProposal)).toEqual([
      "dean_approve",
    ])
    expect(
      availableScheduleActions("executive_director", deanApprovedProposal),
    ).toEqual(["executive_approve"])
    expect(
      availableScheduleActions("registrar_head", publishedProposal),
    ).toEqual(["close"])
  })

  it("requires an explicit confirmation before a dean transition", async () => {
    const user = userEvent.setup()
    fetchMock.mockResolvedValue(new Response(JSON.stringify(proposals)))
    renderWithSession(<ScheduleDecisionWorkspace />, {
      session: {
        userId: "5",
        displayName: "Dean",
        role: "dean",
        signedInAt: "2026-07-29T12:00:00Z",
      },
    })
    await user.click(
      await screen.findByRole("button", { name: "Approve as Dean" }),
    )
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("does not render a decision workspace for an unauthorized role", () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(proposals)))
    renderWithSession(<ScheduleDecisionWorkspace />, {
      session: {
        userId: "4",
        displayName: "Chair",
        role: "program_chair",
        signedInAt: "2026-07-29T12:00:00Z",
      },
    })
    expect(
      screen.getByText("This workspace is not available for your role."),
    ).toBeInTheDocument()
  })
})
