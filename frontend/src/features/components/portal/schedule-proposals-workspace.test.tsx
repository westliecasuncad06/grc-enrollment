import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ScheduleProposalsWorkspace } from "@/features/components/portal/schedule-proposals-workspace"
import { renderWithSession } from "@/tests/render-app"

const terms = {
  data: [
    {
      type: "academic-term",
      id: 2,
      school_year: "2026-2027",
      semester: "1st",
      starts_at: null,
      ends_at: null,
      enrollment_opens_at: null,
      enrollment_closes_at: null,
      status: "active",
      status_label: "Active",
    },
  ],
}
const proposals = { data: [] }
const draft = {
  data: {
    type: "schedule_proposal",
    id: 9,
    academic_term_id: 2,
    submitted_by: 4,
    status: "draft",
    status_label: "Draft",
    decided_by: null,
    decided_at: null,
    decision_reason: null,
  },
}
function url(input: RequestInfo | URL) {
  return typeof input === "string"
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url
}

describe("ScheduleProposalsWorkspace", () => {
  const fetchMock = vi.fn<typeof fetch>()
  beforeEach(() => vi.stubGlobal("fetch", fetchMock))
  afterEach(() => vi.unstubAllGlobals())

  it("creates only a draft proposal and refreshes the proposal list", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation((input, init) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            url(input).endsWith("/academic-terms")
              ? terms
              : init?.method === "POST"
                ? draft
                : proposals,
          ),
          { status: init?.method === "POST" ? 201 : 200 },
        ),
      ),
    )
    renderWithSession(<ScheduleProposalsWorkspace />, {
      session: {
        userId: "4",
        displayName: "Chair",
        role: "program_chair",
        signedInAt: "2026-07-29T12:00:00Z",
      },
    })
    await screen.findByRole("option", { name: /2026-2027/ })
    await user.click(
      screen.getByRole("button", { name: "Create draft proposal" }),
    )
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/schedule-proposals"),
      expect.objectContaining({ method: "POST" }),
    )
    expect(
      screen.queryByRole("button", { name: /approve|publish/i }),
    ).not.toBeInTheDocument()
  })

  it("shows duplicate-term proposal validation returned by the API", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation((input, init) =>
      Promise.resolve(
        init?.method === "POST"
          ? new Response(
              JSON.stringify({
                error: {
                  code: "VALIDATION_FAILED",
                  message: "Duplicate proposal",
                  errors: {
                    academic_term_id: [
                      "This term already has an active proposal.",
                    ],
                  },
                  request_id: "req-8",
                },
              }),
              { status: 422 },
            )
          : new Response(
              JSON.stringify(
                url(input).endsWith("/academic-terms") ? terms : proposals,
              ),
            ),
      ),
    )
    renderWithSession(<ScheduleProposalsWorkspace />, {
      session: {
        userId: "4",
        displayName: "Chair",
        role: "program_chair",
        signedInAt: "2026-07-29T12:00:00Z",
      },
    })
    await screen.findByRole("option", { name: /2026-2027/ })
    await user.click(
      screen.getByRole("button", { name: "Create draft proposal" }),
    )
    expect(
      await screen.findByText("This term already has an active proposal."),
    ).toBeInTheDocument()
  })
})
