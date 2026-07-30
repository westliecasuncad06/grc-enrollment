import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import { ApiClientError } from "@/features/services/api-client"

describe("AsyncBoundary", () => {
  it("announces a single loading status while pending", () => {
    render(
      <AsyncBoundary
        query={{
          isPending: true,
          isError: false,
          error: null,
          data: undefined,
          refetch: () => undefined,
        }}
      >
        {() => <p>data</p>}
      </AsyncBoundary>,
    )

    expect(screen.getByRole("status")).toBeInTheDocument()
    expect(screen.queryByText("data")).not.toBeInTheDocument()
  })

  it("renders a status-aware error, omitting retry for a non-retryable status", () => {
    const refetch = vi.fn()
    render(
      <AsyncBoundary
        query={{
          isPending: false,
          isError: true,
          error: new ApiClientError({
            kind: "http",
            message: "You are not authorized to view this.",
            status: 403,
          }),
          data: undefined,
          refetch,
        }}
      >
        {() => <p>data</p>}
      </AsyncBoundary>,
    )

    expect(screen.getByText("You don't have access")).toBeInTheDocument()
    // 403 is not retryable — no action button.
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument()
    expect(refetch).not.toHaveBeenCalled()
  })

  it("shows a retry action for a retryable error and calls refetch on click", async () => {
    const refetch = vi.fn()
    const user = userEvent.setup()
    render(
      <AsyncBoundary
        query={{
          isPending: false,
          isError: true,
          error: new ApiClientError({ kind: "connection", message: "offline" }),
          data: undefined,
          refetch,
        }}
      >
        {() => <p>data</p>}
      </AsyncBoundary>,
    )

    await user.click(screen.getByRole("button", { name: "Try again" }))
    expect(refetch).toHaveBeenCalledOnce()
  })

  it("renders the empty message when isEmpty matches the data", () => {
    render(
      <AsyncBoundary
        query={{
          isPending: false,
          isError: false,
          error: null,
          data: [],
          refetch: () => undefined,
        }}
        isEmpty={(data: unknown[]) => data.length === 0}
        emptyMessage="No students are enrolled in this section yet."
      >
        {() => <p>data</p>}
      </AsyncBoundary>,
    )

    expect(
      screen.getByText("No students are enrolled in this section yet."),
    ).toBeInTheDocument()
    expect(screen.queryByText("data")).not.toBeInTheDocument()
  })

  it("renders children with the resolved data on success", () => {
    render(
      <AsyncBoundary
        query={{
          isPending: false,
          isError: false,
          error: null,
          data: { name: "Section 1A" },
          refetch: () => undefined,
        }}
      >
        {(data) => <p>{data.name}</p>}
      </AsyncBoundary>,
    )

    expect(screen.getByText("Section 1A")).toBeInTheDocument()
  })
})
