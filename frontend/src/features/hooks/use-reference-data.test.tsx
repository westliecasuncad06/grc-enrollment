import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  AuthContext,
  type AuthContextValue,
} from "@/features/auth/auth-context-value"
import {
  sectionsQueryKey,
  useSectionsQuery,
} from "@/features/hooks/use-reference-data"
import { createAppQueryClient } from "@/features/lib/query-client"
import { getSections } from "@/features/services/reference-data-service"
import { testSession } from "@/tests/render-app"

function sectionFor(termId: number) {
  return {
    type: "section",
    id: termId,
    academic_term_id: termId,
    subject_id: 7,
    section_code: `TERM-${termId}`,
    professor_id: null,
    schedule_days: null,
    starts_at_time: null,
    ends_at_time: null,
    room: null,
    capacity: 40,
    capacity_source: "plan",
    viability_threshold: null,
    enrolled_count: 0,
    remaining_seats: 40,
    is_block_exclusive: null,
    status: "planned",
    status_label: "Planned",
  }
}

function renderSections(academicTermId?: number) {
  let session: AuthContextValue["session"] = testSession
  const queryClient = createAppQueryClient()
  const result = renderHook(
    ({ termId }: { termId: number | undefined }) =>
      useSectionsQuery({ academicTermId: termId }),
    {
      initialProps: { termId: academicTermId },
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          <AuthContext.Provider
            value={{
              session,
              status: session ? "authenticated" : "anonymous",
              storageAvailable: true,
              signIn: vi.fn(),
              verifyLoginOtp: vi.fn(),
              resendLoginOtp: vi.fn(),
              signInWithGoogle: vi.fn(),
              signOut: vi.fn(),
              replaceSession: vi.fn(),
            }}
          >
            {children}
          </AuthContext.Provider>
        </QueryClientProvider>
      ),
    },
  )
  return {
    ...result,
    queryClient,
    setSession: (next: AuthContextValue["session"]) => {
      session = next
    },
  }
}

describe("section reference queries", () => {
  const fetchMock = vi.fn<typeof fetch>()
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock)
    fetchMock.mockImplementation((input) => {
      const target = new URL(
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
      )
      const termId = Number(target.searchParams.get("academic_term_id") ?? 99)
      return Promise.resolve(
        new Response(JSON.stringify({ data: [sectionFor(termId)] })),
      )
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it("waits for a selected term before making a request", async () => {
    const { result, rerender } = renderSections(0)
    expect(fetchMock).not.toHaveBeenCalled()
    rerender({ termId: 2 })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0]?.academic_term_id).toBe(2)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/sections?academic_term_id=2"),
      expect.any(Object),
    )
  })

  it("keeps term caches separate and reuses the original term when revisited", async () => {
    const { result, rerender } = renderSections(2)
    await waitFor(() =>
      expect(result.current.data?.[0]?.academic_term_id).toBe(2),
    )
    rerender({ termId: 3 })
    expect(result.current.data).toBeUndefined()
    await waitFor(() =>
      expect(result.current.data?.[0]?.academic_term_id).toBe(3),
    )
    rerender({ termId: 2 })
    expect(result.current.data?.[0]?.academic_term_id).toBe(2)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("invalidates filtered and unfiltered lists after an existing section mutation", async () => {
    const { result, queryClient } = renderSections(2)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    queryClient.setQueryData(sectionsQueryKey("1"), [sectionFor(99)])
    queryClient.setQueryData(sectionsQueryKey("1", 3), [sectionFor(3)])
    await act(() =>
      queryClient.invalidateQueries({ queryKey: sectionsQueryKey("1") }),
    )
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(
      queryClient.getQueryState(sectionsQueryKey("1"))?.isInvalidated,
    ).toBe(true)
    expect(
      queryClient.getQueryState(sectionsQueryKey("1", 3))?.isInvalidated,
    ).toBe(true)
  })

  it("does not show another user's cached sections or request while signed out", async () => {
    const { result, rerender, setSession } = renderSections(2)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    setSession(null)
    rerender({ termId: 2 })
    expect(result.current.data).toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    setSession({ ...testSession, userId: "2" })
    rerender({ termId: 2 })
    expect(result.current.data).toBeUndefined()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("preserves the all-term service contract and abort signal for existing callers", async () => {
    const controller = new AbortController()
    const all = await getSections(controller.signal)
    expect(all[0]?.academic_term_id).toBe(99)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/sections$/u),
      expect.any(Object),
    )
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBe(controller.signal)
  })
})
