import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ScheduleDecisionWorkspace } from "@/features/components/portal/schedule-decision-workspace"
import { sectionsQueryKey } from "@/features/hooks/use-reference-data"
import { scheduleProposalsQueryKey } from "@/features/hooks/use-scheduling"
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
    for (const role of [
      "student",
      "admission_staff",
      "faculty",
      "program_chair",
      "dean",
      "executive_director",
      "registrar_head",
      "registrar_staff",
      "accounting_staff",
    ] as const) {
      for (const proposal of [
        draftProposal,
        deanApprovedProposal,
        { ...draftProposal, status: "executive_approved" as const },
        publishedProposal,
        { ...draftProposal, status: "closed" as const },
      ]) {
        const expected =
          role === "dean" && proposal.status === "draft"
            ? ["dean_approve"]
            : role === "dean" && proposal.status === "dean_approved"
              ? ["dean_return"]
              : role === "executive_director" &&
                  proposal.status === "dean_approved"
                ? ["executive_approve"]
                : role === "executive_director" &&
                    proposal.status === "executive_approved"
                  ? ["executive_return", "publish"]
                  : role === "registrar_head" && proposal.status === "published"
                    ? ["close"]
                    : []
        expect(availableScheduleActions(role, proposal)).toEqual(expected)
      }
    }
  })

  it("requires a return reason and sends one confirmed patch only while pending", async () => {
    const user = userEvent.setup()
    let resolvePatch: ((response: Response) => void) | undefined
    fetchMock.mockImplementation((_input, init) => {
      if (init?.method === "PATCH")
        return new Promise<Response>((resolve) => {
          resolvePatch = resolve
        })
      return Promise.resolve(
        new Response(JSON.stringify({ data: [deanApprovedProposal] })),
      )
    })
    renderWithSession(<ScheduleDecisionWorkspace />, {
      session: {
        userId: "5",
        displayName: "Dean",
        role: "dean",
        signedInAt: "2026-07-29T12:00:00Z",
      },
    })
    await user.click(
      await screen.findByRole("button", { name: "Return to draft" }),
    )
    expect(
      screen.getByRole("button", { name: "Confirm decision" }),
    ).toBeDisabled()
    await user.type(
      screen.getByLabelText("Decision reason"),
      "Capacity conflict",
    )
    await user.click(screen.getByRole("button", { name: "Confirm decision" }))
    expect(
      screen.getByRole("button", { name: "Saving decision" }),
    ).toBeDisabled()
    await user.click(screen.getByRole("button", { name: "Saving decision" }))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining("/schedule-proposals/9"),
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          action: "dean_return",
          decision_reason: "Capacity conflict",
        }),
      }),
    )
    resolvePatch?.(new Response(JSON.stringify({ data: draftProposal })))
  })

  it("invalidates both proposal and section caches after a successful transition", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation((_input, init) => {
      if (init?.method === "PATCH")
        return Promise.resolve(
          new Response(JSON.stringify({ data: deanApprovedProposal })),
        )
      return Promise.resolve(new Response(JSON.stringify(proposals)))
    })
    const { queryClient } = renderWithSession(<ScheduleDecisionWorkspace />, {
      session: {
        userId: "5",
        displayName: "Dean",
        role: "dean",
        signedInAt: "2026-07-29T12:00:00Z",
      },
    })
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")
    await user.click(
      await screen.findByRole("button", { name: "Approve as Dean" }),
    )
    await user.click(screen.getByRole("button", { name: "Confirm decision" }))
    await screen.findByRole("button", { name: "Approve as Dean" })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: scheduleProposalsQueryKey("5"),
      exact: true,
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: sectionsQueryKey("5"),
      exact: true,
    })
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
