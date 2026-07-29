import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { AuthSession } from "@/features/auth/auth-types"
import { useAuth } from "@/features/auth/use-auth"
import { PortalNotificationSheet } from "@/features/components/portal/portal-notification-sheet"
import {
  createStubGateway,
  renderWithAuthProvider,
  renderWithSession,
} from "@/tests/render-app"

const notificationEnvelope = {
  data: [
    {
      type: "notification",
      id: 7,
      notification_type: "schedule_published",
      message: "Schedule published for your review.",
      read_at: null,
      created_at: "2026-07-29T10:00:00Z",
    },
  ],
  links: {
    first: "http://127.0.0.1:8000/api/v1/notifications?page=1",
    last: "http://127.0.0.1:8000/api/v1/notifications?page=2",
    prev: null,
    next: "http://127.0.0.1:8000/api/v1/notifications?page=2",
  },
  meta: { current_page: 1, last_page: 2, per_page: 20, total: 21 },
} as const

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input
  }

  return input instanceof URL ? input.toString() : input.url
}

const userASession: AuthSession = {
  userId: "1",
  displayName: "User A",
  role: "faculty",
  signedInAt: "2026-07-29T10:00:00Z",
}

const userBSession: AuthSession = {
  userId: "2",
  displayName: "User B",
  role: "faculty",
  signedInAt: "2026-07-29T10:01:00Z",
}

function AuthSwitchControls() {
  const { signIn, signOut } = useAuth()

  return (
    <>
      <button type="button" onClick={signOut}>
        Sign out
      </button>
      <button
        type="button"
        onClick={() =>
          void signIn({ email: "user-b@grc.test", password: "secret" })
        }
      >
        Sign in as User B
      </button>
    </>
  )
}

describe("PortalNotificationSheet", () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("shows unread count, supports an unread filter, pagination, and marking a notification read", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation((input, init) => {
      const url = requestUrl(input)
      const request = init

      if (request?.method === "PATCH") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: {
                ...notificationEnvelope.data[0],
                read_at: "2026-07-29T10:03:00Z",
              },
            }),
            { status: 200 },
          ),
        )
      }

      expect(url).toContain("/notifications")
      return Promise.resolve(
        new Response(JSON.stringify(notificationEnvelope), { status: 200 }),
      )
    })

    renderWithSession(<PortalNotificationSheet />)
    await user.click(screen.getByRole("button", { name: /notifications/i }))

    expect(
      await screen.findByRole("dialog", { name: "Notifications" }),
    ).toBeInTheDocument()
    expect(screen.getByText("1 unread")).toBeInTheDocument()
    expect(
      screen.getByText("Schedule published for your review."),
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Unread only" }))
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining("unread_only=true"),
      expect.objectContaining({ method: "GET" }),
    )

    await user.click(
      screen.getByRole("button", { name: "Next notifications page" }),
    )
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining("page=2"),
      expect.objectContaining({ method: "GET" }),
    )

    await user.click(
      screen.getByRole("button", { name: "Mark notification as read" }),
    )
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/notifications/7/read"),
      expect.objectContaining({ method: "PATCH" }),
    )
  })

  it("renders a safe error without assuming an unread notification belongs to the user", async () => {
    const user = userEvent.setup()
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "FORBIDDEN",
            message: "You are not authorized to perform this action.",
            errors: {},
            request_id: "request-7",
          },
        }),
        { status: 403 },
      ),
    )

    renderWithSession(<PortalNotificationSheet />)
    await user.click(screen.getByRole("button", { name: /notifications/i }))

    expect(
      await screen.findByText("Notifications are unavailable right now."),
    ).toBeInTheDocument()
    expect(screen.queryByText(/user_id/i)).not.toBeInTheDocument()
  })

  it("does not show User A's cached notifications after User B signs in", async () => {
    const user = userEvent.setup()
    const userANotifications = {
      ...notificationEnvelope,
      data: [
        {
          ...notificationEnvelope.data[0],
          message: "User A private notification",
        },
      ],
    }
    const userBNotifications = {
      ...notificationEnvelope,
      data: [
        {
          ...notificationEnvelope.data[0],
          id: 8,
          message: "User B private notification",
        },
      ],
    }
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify(userANotifications), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(userBNotifications), { status: 200 }),
      )

    renderWithAuthProvider(
      <>
        <AuthSwitchControls />
        <PortalNotificationSheet />
      </>,
      {
        gateway: createStubGateway({
          restore: () => Promise.resolve(userASession),
          signIn: () => Promise.resolve(userBSession),
        }),
      },
    )

    await user.click(screen.getByRole("button", { name: /notifications/i }))
    expect(
      await screen.findByText("User A private notification"),
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Close" }))
    await user.click(screen.getByRole("button", { name: "Sign out" }))
    await user.click(screen.getByRole("button", { name: "Sign in as User B" }))
    await user.click(screen.getByRole("button", { name: /notifications/i }))

    expect(
      await screen.findByText("User B private notification"),
    ).toBeInTheDocument()
    expect(
      screen.queryByText("User A private notification"),
    ).not.toBeInTheDocument()
  })
})
