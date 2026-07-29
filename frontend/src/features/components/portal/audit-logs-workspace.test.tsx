import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AuditLogsWorkspace } from "@/features/components/portal/audit-logs-workspace"
import { renderWithSession } from "@/tests/render-app"

const auditLogs = {
  data: [
    {
      type: "audit_log",
      id: 1,
      actor_user_id: 7,
      actor_role: "dean",
      actor_role_label: "Dean",
      action: "section.updated",
      auditable_type: "section",
      auditable_id: 3,
      before_values: { status: "planned" },
      after_values: { status: "published" },
      reason: null,
      request_id: "req-1",
      ip_address: "127.0.0.1",
      created_at: "2026-07-29T12:00:00Z",
    },
  ],
  links: {
    first: "https://api.test/audit-logs?page=1",
    last: "https://api.test/audit-logs?page=2",
    prev: null,
    next: "https://api.test/audit-logs?page=2",
  },
  meta: { current_page: 1, last_page: 2, per_page: 20, total: 21 },
}
function url(input: RequestInfo | URL) {
  return typeof input === "string"
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url
}

describe("AuditLogsWorkspace", () => {
  const fetchMock = vi.fn<typeof fetch>()
  beforeEach(() => vi.stubGlobal("fetch", fetchMock))
  afterEach(() => vi.unstubAllGlobals())

  it("applies the default paginated audit filters without rendering actor identity", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation((input) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            url(input).includes("schedule-proposals")
              ? { data: [] }
              : auditLogs,
          ),
        ),
      ),
    )
    renderWithSession(<AuditLogsWorkspace />, {
      session: {
        userId: "8",
        displayName: "Registrar",
        role: "registrar_head",
        signedInAt: "2026-07-29T12:00:00Z",
      },
    })
    await screen.findByText(/section.updated/)
    await user.click(
      await screen.findByRole("button", { name: "Apply audit filters" }),
    )
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("per_page=20"),
      expect.anything(),
    )
    expect(screen.queryByText("Dean Example")).not.toBeInTheDocument()
    await user.click(screen.getByText("Expand audit snapshot"))
    expect(screen.getByText(/planned/)).toBeInTheDocument()
  })

  it("does not fetch or render audit records for an unauthorized role", () => {
    renderWithSession(<AuditLogsWorkspace />, {
      session: {
        userId: "6",
        displayName: "Executive",
        role: "executive_director",
        signedInAt: "2026-07-29T12:00:00Z",
      },
    })
    expect(
      screen.getByText("This workspace is not available for your role."),
    ).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
