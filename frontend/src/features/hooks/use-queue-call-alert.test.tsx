import { act, cleanup, renderHook } from "@testing-library/react"
import { toast } from "sonner"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useQueueCallAlert } from "@/features/hooks/use-queue-call-alert"
import type { StudentQueueView } from "@/features/schemas/student-queue-schema"

vi.mock("sonner", () => ({ toast: vi.fn() }))

const originalTitle = "Student portal — GRC"

const waitingTicket: NonNullable<StudentQueueView["ticket"]> = {
  ticket_number: "Q007",
  status: "waiting",
  status_label: "Waiting",
  priority: "regular",
  priority_label: "Regular",
  position: 1,
}

class FakeOscillator {
  frequency = { value: 0 }
  type: OscillatorType = "sine"
  onended: (() => void) | null = null
  connect = vi.fn()
  disconnect = vi.fn()
  start = vi.fn()
  stop = vi.fn(() => this.onended?.())
}

class FakeAudioContext {
  currentTime = 0
  destination = {}
  state: AudioContextState = "running"
  oscillator = new FakeOscillator()
  createOscillator = vi.fn(() => this.oscillator as unknown as OscillatorNode)
  resume = vi.fn(() => Promise.resolve())
  close = vi.fn(() => Promise.resolve())
}

describe("useQueueCallAlert", () => {
  const vibrate = vi.fn()
  let audioContext: FakeAudioContext

  beforeEach(() => {
    vi.useFakeTimers()
    document.title = originalTitle
    audioContext = new FakeAudioContext()
    vi.stubGlobal(
      "AudioContext",
      class {
        constructor() {
          return audioContext
        }
      },
    )
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      value: vibrate,
    })
  })

  afterEach(() => {
    cleanup()
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    window.localStorage.clear()
  })

  it("does not manufacture an alert for an initially serving ticket", () => {
    const { result } = renderHook(() =>
      useQueueCallAlert({ ...waitingTicket, status: "serving" }),
    )

    expect(result.current.isCalled).toBe(false)
    expect(result.current.callMessage).toBeNull()
    expect(toast).not.toHaveBeenCalled()
    expect(vibrate).not.toHaveBeenCalled()
  })

  it("announces exactly one same-ticket waiting-to-serving transition", () => {
    const { result, rerender } = renderHook(
      ({ ticket }) => useQueueCallAlert(ticket),
      { initialProps: { ticket: waitingTicket } },
    )

    rerender({ ticket: { ...waitingTicket, status: "serving" } })

    expect(result.current.isCalled).toBe(true)
    expect(result.current.callMessage).toBe(
      "Your ticket Q007 is now being served.",
    )
    expect(toast).toHaveBeenCalledOnce()
    expect(toast).toHaveBeenCalledWith("Now serving Q007 — GRC Queue")
    expect(vibrate).toHaveBeenCalledWith([200, 100, 200, 100, 400])
    expect(document.title).toBe("Now serving Q007 — GRC Queue")

    rerender({ ticket: { ...waitingTicket, status: "serving" } })
    expect(toast).toHaveBeenCalledOnce()
  })

  it("starts sound only after the user explicitly enables it", async () => {
    const { result, rerender } = renderHook(
      ({ ticket }) => useQueueCallAlert(ticket),
      { initialProps: { ticket: waitingTicket } },
    )

    rerender({ ticket: { ...waitingTicket, status: "serving" } })
    expect(audioContext.createOscillator).not.toHaveBeenCalled()

    await act(async () => {
      result.current.enableSound()
      await Promise.resolve()
    })
    expect(audioContext.resume).toHaveBeenCalledOnce()

    rerender({ ticket: { ...waitingTicket, status: "waiting" } })
    rerender({ ticket: { ...waitingTicket, status: "serving" } })
    expect(audioContext.createOscillator).toHaveBeenCalledOnce()
    expect(audioContext.oscillator.start).toHaveBeenCalledOnce()
    expect(audioContext.oscillator.stop).toHaveBeenCalledOnce()
    expect(audioContext.oscillator.disconnect).toHaveBeenCalledOnce()
  })

  it("restores document and alert resources on ticket replacement, timeout, and unmount", async () => {
    const { result, rerender, unmount } = renderHook(
      ({ ticket }) => useQueueCallAlert(ticket),
      { initialProps: { ticket: waitingTicket } },
    )
    await act(async () => {
      result.current.enableSound()
      await Promise.resolve()
    })
    rerender({ ticket: { ...waitingTicket, status: "serving" } })

    rerender({ ticket: { ...waitingTicket, ticket_number: "Q008" } })
    expect(result.current.isCalled).toBe(false)
    expect(document.title).toBe(originalTitle)
    expect(audioContext.oscillator.stop).toHaveBeenCalledOnce()
    expect(audioContext.oscillator.disconnect).toHaveBeenCalledOnce()

    rerender({
      ticket: { ...waitingTicket, ticket_number: "Q008", status: "serving" },
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    expect(document.title).toBe(originalTitle)
    expect(result.current.isCalled).toBe(false)

    unmount()
    expect(audioContext.close).toHaveBeenCalledOnce()
  })

  it("keeps the visible call message when AudioContext and vibration are unavailable", () => {
    vi.stubGlobal("AudioContext", undefined)
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      value: undefined,
    })
    const { result, rerender } = renderHook(
      ({ ticket }) => useQueueCallAlert(ticket),
      { initialProps: { ticket: waitingTicket } },
    )

    rerender({ ticket: { ...waitingTicket, status: "serving" } })

    expect(result.current.callMessage).toBe(
      "Your ticket Q007 is now being served.",
    )
    expect(result.current.isCalled).toBe(true)
  })

  it("keeps the latest called title until its owning panel releases it", async () => {
    const first = renderHook(({ ticket }) => useQueueCallAlert(ticket), {
      initialProps: { ticket: waitingTicket },
    })
    const secondTicket = { ...waitingTicket, ticket_number: "Q008" }
    const second = renderHook(({ ticket }) => useQueueCallAlert(ticket), {
      initialProps: { ticket: secondTicket },
    })

    first.rerender({ ticket: { ...waitingTicket, status: "serving" } })
    expect(document.title).toBe("Now serving Q007 — GRC Queue")

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000)
    })
    second.rerender({ ticket: { ...secondTicket, status: "serving" } })
    expect(document.title).toBe("Now serving Q008 — GRC Queue")

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000)
    })
    expect(document.title).toBe("Now serving Q008 — GRC Queue")

    first.unmount()
    expect(document.title).toBe("Now serving Q008 — GRC Queue")

    second.unmount()
    expect(document.title).toBe(originalTitle)
  })

  it("consumes a persisted preference without treating it as gesture-enabled sound", async () => {
    window.localStorage.setItem("grc.queue-call-sound.v1", "true")

    const { result } = renderHook(() => useQueueCallAlert(waitingTicket))

    expect(result.current.soundPreferred).toBe(true)
    expect(result.current.soundEnabled).toBe(false)
    expect(audioContext.resume).not.toHaveBeenCalled()

    await act(async () => {
      result.current.enableSound()
      await Promise.resolve()
    })
    expect(result.current.soundEnabled).toBe(true)
    expect(audioContext.resume).toHaveBeenCalledOnce()
  })

  it("remounts with saved intent but requires a fresh gesture-created AudioContext", async () => {
    const first = renderHook(() => useQueueCallAlert(waitingTicket))
    await act(async () => {
      first.result.current.enableSound()
      await Promise.resolve()
    })
    expect(first.result.current.soundPreferred).toBe(true)
    expect(first.result.current.soundEnabled).toBe(true)
    first.unmount()

    audioContext = new FakeAudioContext()
    const second = renderHook(() => useQueueCallAlert(waitingTicket))
    expect(second.result.current.soundPreferred).toBe(true)
    expect(second.result.current.soundEnabled).toBe(false)
    expect(audioContext.resume).not.toHaveBeenCalled()

    await act(async () => {
      second.result.current.enableSound()
      await Promise.resolve()
    })
    expect(second.result.current.soundEnabled).toBe(true)
    expect(audioContext.resume).toHaveBeenCalledOnce()
  })

  it("synchronizes shared sound enablement and release across mounted panels", async () => {
    const first = renderHook(() => useQueueCallAlert(waitingTicket))
    const second = renderHook(() => useQueueCallAlert(waitingTicket))

    await act(async () => {
      first.result.current.enableSound()
      await Promise.resolve()
    })
    expect(first.result.current.soundEnabled).toBe(true)
    expect(second.result.current.soundEnabled).toBe(true)
    expect(audioContext.resume).toHaveBeenCalledOnce()

    act(() => second.result.current.disableSound())
    expect(first.result.current.soundEnabled).toBe(false)
    expect(second.result.current.soundEnabled).toBe(false)
    expect(audioContext.close).toHaveBeenCalledOnce()

    await act(async () => {
      first.result.current.enableSound()
      await Promise.resolve()
    })
    expect(first.result.current.soundEnabled).toBe(true)
    expect(second.result.current.soundEnabled).toBe(true)

    first.unmount()
    expect(second.result.current.soundEnabled).toBe(true)
    second.unmount()
    expect(audioContext.close).toHaveBeenCalledTimes(2)
  })

  it("keeps sound disabled when context resume rejects and safely releases it", async () => {
    audioContext.resume.mockRejectedValueOnce(
      new DOMException("Blocked", "NotAllowedError"),
    )
    const { result, unmount } = renderHook(() =>
      useQueueCallAlert(waitingTicket),
    )

    await act(async () => {
      result.current.enableSound()
      await Promise.resolve()
    })

    expect(result.current.soundEnabled).toBe(false)
    expect(audioContext.close).toHaveBeenCalledOnce()

    unmount()
    expect(audioContext.close).toHaveBeenCalledOnce()
  })
})
