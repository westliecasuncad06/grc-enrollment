import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { FeeSettingsWorkspace } from "@/features/components/portal/fee-settings-workspace"
import { renderWithSession } from "@/tests/render-app"

const mockFeeSchedules = [
  {
    id: 1,
    category: "tuition",
    label: "Tuition Rate Per Unit",
    amount: "200.00",
    program_codes: null,
    is_active: true,
    sort_order: 1,
  },
  {
    id: 2,
    category: "miscellaneous",
    label: "Registration",
    amount: "200.00",
    program_codes: null,
    is_active: true,
    sort_order: 2,
  },
  {
    id: 3,
    category: "miscellaneous",
    label: "Medical and Dental",
    amount: "350.00",
    program_codes: null,
    is_active: true,
    sort_order: 3,
  },
  {
    id: 4,
    category: "miscellaneous",
    label: "Computer Lab Fee 2 (BSIT)",
    amount: "500.00",
    program_codes: ["BSIT"],
    is_active: true,
    sort_order: 4,
  },
]

describe("FeeSettingsWorkspace", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("renders fee schedules and allows Accounting Staff to edit and add fee particulars", async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>((input, init) => {
        const url = String(input)
        if (url.includes("/api/v1/fee-schedules") && (!init || init.method === "GET")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                data: mockFeeSchedules,
              }),
            ),
          )
        }
        if (url.includes("/api/v1/fee-schedules") && init?.method === "PUT") {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                message: "Fee schedules updated successfully.",
                data: mockFeeSchedules,
              }),
            ),
          )
        }
        if (url.includes("/api/v1/programs")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                data: [
                  { id: 1, code: "BSIT", name: "Bachelor of Science in Information Technology" },
                ],
              }),
            ),
          )
        }
        return Promise.resolve(new Response(JSON.stringify({ data: [] })))
      }),
    )

    renderWithSession(<FeeSettingsWorkspace />, {
      session: {
        userId: "1",
        displayName: "Accounting Staff",
        role: "accounting_staff",
        signedInAt: "2026-07-28T00:00:00.000Z",
      },
    })

    expect(
      await screen.findByRole("heading", { name: "Fee Settings" }),
    ).toBeInTheDocument()

    // Fee data initializes the form in the same render it arrives (no
    // default-then-effect flash): tuition and Registration are both 200.00.
    expect(await screen.findByDisplayValue("Registration")).toBeInTheDocument()
    expect(screen.getAllByDisplayValue("200.00")).toHaveLength(2)
    expect(screen.getByDisplayValue("Medical and Dental")).toBeInTheDocument()

    const addBtn = screen.getByRole("button", { name: /Add Fee Particular/i })
    await user.click(addBtn)

    expect(screen.getByDisplayValue("New Fee Particular")).toBeInTheDocument()

    const saveBtn = screen.getByRole("button", { name: /Save Fee Settings/i })
    await user.click(saveBtn)

    await waitFor(() => {
      expect(screen.getByText("Settings Saved Successfully")).toBeInTheDocument()
    })
  })
})
