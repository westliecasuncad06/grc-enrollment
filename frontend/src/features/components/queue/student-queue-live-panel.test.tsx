import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "vitest-axe"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { StudentQueueLivePanel } from "@/features/components/queue/student-queue-live-panel"
import type { StudentQueueView } from "@/features/schemas/student-queue-schema"

const callAlert = vi.hoisted(() => ({
  current: {
    isCalled: false,
    callMessage: null as string | null,
    soundEnabled: false,
    enableSound: vi.fn(),
    disableSound: vi.fn(),
  },
}))

vi.mock("@/features/hooks/use-queue-call-alert", () => ({
  useQueueCallAlert: () => callAlert.current,
}))

const queueView = {
  type: "student_queue_view",
  stage: "pending_payment",
  can_claim: false,
  ticket: {
    ticket_number: "Q007",
    status: "waiting",
    status_label: "Waiting",
    priority: "priority",
    priority_label: "Priority",
    position: 2,
  },
  now_serving_ticket_number: "Q005",
  upcoming_ticket_numbers: ["Q006", "Q007", "Q008"],
  cut_off_today: false,
} satisfies StudentQueueView

describe("StudentQueueLivePanel", () => {
  beforeEach(() => {
    callAlert.current = {
      isCalled: false,
      callMessage: null,
      soundEnabled: false,
      enableSound: vi.fn(),
      disableSound: vi.fn(),
    }
  })

  afterEach(() => vi.restoreAllMocks())

  it.each(["default", "kiosk", "compact"] as const)(
    "retains the required queue content and alert controls in %s mode",
    (mode) => {
      render(
        <StudentQueueLivePanel
          queue={{ ...queueView, cut_off_today: true }}
          mode={mode}
        />,
      )

      expect(
        screen.getByRole("region", { name: "Your Cashier queue" }),
      ).toBeInTheDocument()
      expect(screen.getAllByText("Q007").length).toBeGreaterThan(0)
      expect(screen.getByText("Waiting")).toBeInTheDocument()
      expect(screen.getByText("Priority")).toBeInTheDocument()
      expect(screen.getByText("Q005")).toBeInTheDocument()
      expect(
        screen.getByText("2 students are ahead of you."),
      ).toBeInTheDocument()
      expect(
        screen.getByText("Your queue ticket is active."),
      ).toBeInTheDocument()
      expect(
        screen.getByRole("button", { name: "Turn on sound" }),
      ).toBeInTheDocument()
      expect(
        screen.getByText(/iOS Safari does not support web vibration/i),
      ).toBeInTheDocument()
      expect(
        screen.getByText(/Today's queue has reached its cut-off/i),
      ).toBeInTheDocument()
      expect(
        screen.getByText(
          /Keep this page open and visible near the time of service/i,
        ),
      ).toBeInTheDocument()
      if (mode === "compact") {
        expect(
          screen.queryByRole("list", { name: "Upcoming ticket numbers" }),
        ).not.toBeInTheDocument()
      } else {
        expect(
          screen.getByRole("list", { name: "Upcoming ticket numbers" }),
        ).toHaveTextContent("Q006Q007Q008")
      }
    },
  )

  it("states the exact zero, singular, and plural waiting positions", () => {
    const { rerender } = render(
      <StudentQueueLivePanel
        queue={{ ...queueView, ticket: { ...queueView.ticket, position: 0 } }}
      />,
    )
    expect(screen.getByText("You're next in line.")).toBeInTheDocument()

    rerender(
      <StudentQueueLivePanel
        queue={{ ...queueView, ticket: { ...queueView.ticket, position: 1 } }}
      />,
    )
    expect(screen.getByText("1 student is ahead of you.")).toBeInTheDocument()

    rerender(
      <StudentQueueLivePanel
        queue={{ ...queueView, ticket: { ...queueView.ticket, position: 3 } }}
      />,
    )
    expect(screen.getByText("3 students are ahead of you.")).toBeInTheDocument()
  })

  it("marks unavailable ticket and serving values as compact status copy in kiosk mode", () => {
    render(
      <StudentQueueLivePanel
        queue={{
          ...queueView,
          ticket: null,
          now_serving_ticket_number: null,
        }}
        mode="kiosk"
      />,
    )

    expect(screen.getByText("Not issued")).toHaveClass(
      "queue-live-panel__ticket-number--status",
    )
    expect(
      screen.getByText("No number is currently being served."),
    ).toHaveClass("queue-live-panel__serving-number--status")
  })

  it.each(["default", "compact"] as const)(
    "prioritizes registrar approval within the unissued student ticket card in %s mode",
    (mode) => {
      render(
        <StudentQueueLivePanel
          queue={{
            ...queueView,
            stage: "pending_registrar_approval",
            ticket: null,
            now_serving_ticket_number: null,
          }}
          mode={mode}
        />,
      )

      expect(
        screen.getByText("Waiting for Registrar approval"),
      ).toBeInTheDocument()
      expect(screen.getByText("Not issued").parentElement).toHaveClass(
        "queue-live-panel__ticket--awaiting-approval",
      )
      expect(
        screen.getByText("No number is currently being served.").parentElement,
      ).toHaveClass("queue-live-panel__serving--unavailable")
    },
  )

  it("shows only ticket-number queue information and omits the full upcoming list in compact mode", () => {
    const privateBoardData = {
      ...queueView,
      student_name: "Jane Student",
      student_number: "2026-00001",
    } as StudentQueueView
    const { rerender } = render(
      <StudentQueueLivePanel queue={privateBoardData} mode="default" />,
    )

    expect(
      screen.getByRole("list", { name: "Upcoming ticket numbers" }),
    ).toHaveTextContent("Q006Q007Q008")
    expect(screen.queryByText("Jane Student")).not.toBeInTheDocument()
    expect(screen.queryByText("2026-00001")).not.toBeInTheDocument()

    rerender(<StudentQueueLivePanel queue={queueView} mode="compact" />)
    expect(
      screen.queryByRole("list", { name: "Upcoming ticket numbers" }),
    ).not.toBeInTheDocument()
  })

  it("gives each upcoming list its own labelled heading", () => {
    render(
      <>
        <StudentQueueLivePanel queue={queueView} />
        <StudentQueueLivePanel queue={queueView} mode="kiosk" />
      </>,
    )

    const lists = screen.getAllByRole("list")
    const labelledByIds = lists.map((list) =>
      list.getAttribute("aria-labelledby"),
    )

    expect(labelledByIds).toHaveLength(2)
    expect(labelledByIds[0]).toBeTruthy()
    expect(labelledByIds[1]).toBeTruthy()
    expect(labelledByIds[0]).not.toBe(labelledByIds[1])
    for (const labelledById of labelledByIds) {
      expect(document.getElementById(labelledById ?? "")).toHaveTextContent(
        "Upcoming ticket numbers",
      )
    }
  })

  it("communicates the Cashier-kiosk route and every queue stage without a claim action", () => {
    const stageCases: [StudentQueueView["stage"], string][] = [
      [
        "no_active_enrollment",
        "You do not have an active enrollment for the current term.",
      ],
      [
        "pending_registrar_approval",
        "Registrar approval is required before a queue number can be issued.",
      ],
      ["pending_payment", "Claim your number at the Cashier kiosk."],
      [
        "enrolled",
        "Payment has been confirmed and your enrollment is complete.",
      ],
    ]

    for (const [stage, guidance] of stageCases) {
      const { unmount } = render(
        <StudentQueueLivePanel
          queue={{
            ...queueView,
            stage,
            can_claim: stage === "pending_payment",
            ticket: stage === "pending_payment" ? null : queueView.ticket,
          }}
        />,
      )
      expect(screen.getByText(guidance)).toBeInTheDocument()
      expect(
        screen.queryByRole("button", { name: /claim/i }),
      ).not.toBeInTheDocument()
      unmount()
    }
  })

  it("offers sound controls, an iOS vibration limitation, and a cut-off notice", async () => {
    const user = userEvent.setup()
    render(
      <StudentQueueLivePanel queue={{ ...queueView, cut_off_today: true }} />,
    )

    await user.click(screen.getByRole("button", { name: "Turn on sound" }))
    expect(callAlert.current.enableSound).toHaveBeenCalledOnce()
    expect(
      screen.getByText(/iOS Safari does not support web vibration/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Today's queue has reached its cut-off/i),
    ).toBeInTheDocument()
  })

  it("exposes the called ticket as an assertive alert with a static called state", () => {
    callAlert.current = {
      ...callAlert.current,
      isCalled: true,
      callMessage: "Your ticket Q007 is now being served.",
    }
    render(<StudentQueueLivePanel queue={queueView} />)

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Your ticket Q007 is now being served.",
    )
    expect(
      screen.getByRole("region", { name: "Your Cashier queue" }),
    ).toHaveClass("queue-live-panel--called")
  })

  it("has no axe violations in its kiosk called state", async () => {
    callAlert.current = {
      ...callAlert.current,
      isCalled: true,
      callMessage: "Your ticket Q007 is now being served.",
      soundEnabled: true,
    }
    const { container } = render(
      <StudentQueueLivePanel queue={queueView} mode="kiosk" />,
    )

    expect(await axe(container)).toHaveNoViolations()
  })
})
