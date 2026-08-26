"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import { toast } from "sonner"

import {
  readQueueCallSoundPreference,
  writeQueueCallSoundPreference,
} from "@/features/lib/queue-alert-preference"
import type { StudentQueueView } from "@/features/schemas/student-queue-schema"

type QueueTicket = StudentQueueView["ticket"]

type PreviousTicket = Pick<NonNullable<QueueTicket>, "ticket_number" | "status">

interface TitleClaim {
  title: string
  sequence: number
}

const ALERT_DURATION_MS = 10_000
const VIBRATION_PATTERN = [200, 100, 200, 100, 400]

const titleClaims = new Map<symbol, TitleClaim>()
let titleBaseline: string | null = null
let titleSequence = 0

const audioListeners = new Set<() => void>()
const audioOwners = new Set<symbol>()
const activeOscillators = new Map<symbol, OscillatorNode>()
let sharedAudioContext: AudioContext | null = null
let sharedSoundEnabled = false
let sharedSoundPreferred = false

function getAudioContextConstructor(): typeof AudioContext | null {
  if (typeof window === "undefined") {
    return null
  }

  const audioWindow = window as typeof window & {
    webkitAudioContext?: typeof AudioContext
  }

  return audioWindow.AudioContext ?? audioWindow.webkitAudioContext ?? null
}

function setDocumentTitleFromClaims(): void {
  if (typeof document === "undefined") {
    return
  }

  let currentClaim: TitleClaim | null = null
  for (const claim of titleClaims.values()) {
    if (!currentClaim || claim.sequence > currentClaim.sequence) {
      currentClaim = claim
    }
  }

  if (currentClaim) {
    document.title = currentClaim.title
    return
  }

  if (titleBaseline !== null) {
    document.title = titleBaseline
    titleBaseline = null
  }
}

function claimDocumentTitle(owner: symbol, title: string): void {
  if (typeof document === "undefined") {
    return
  }

  if (titleClaims.size === 0) {
    titleBaseline = document.title
  }

  titleSequence += 1
  titleClaims.set(owner, { title, sequence: titleSequence })
  setDocumentTitleFromClaims()
}

function releaseDocumentTitle(owner: symbol): void {
  if (titleClaims.delete(owner)) {
    setDocumentTitleFromClaims()
  }
}

function notifyAudioListeners(): void {
  for (const listener of audioListeners) {
    listener()
  }
}

function getSharedSoundEnabled(): boolean {
  return sharedSoundEnabled
}

function getSharedSoundPreferred(): boolean {
  return sharedSoundPreferred
}

function subscribeToSharedSound(listener: () => void): () => void {
  audioListeners.add(listener)
  return () => audioListeners.delete(listener)
}

function stopSharedOscillator(owner: symbol): void {
  const oscillator = activeOscillators.get(owner)
  if (!oscillator) {
    return
  }

  activeOscillators.delete(owner)
  oscillator.onended = null
  try {
    oscillator.stop()
  } catch {
    // A natural end or an earlier transition can stop the node first.
  }
  try {
    oscillator.disconnect()
  } catch {
    // Browser implementations differ when disconnecting a detached node.
  }
}

function closeSharedAudioContext(): void {
  for (const owner of [...activeOscillators.keys()]) {
    stopSharedOscillator(owner)
  }

  sharedSoundEnabled = false
  const context = sharedAudioContext
  sharedAudioContext = null
  if (context) {
    try {
      void context.close().catch(() => undefined)
    } catch {
      // Closing an interrupted or already closed context remains best-effort.
    }
  }
  notifyAudioListeners()
}

function registerAudioOwner(owner: symbol): void {
  if (audioOwners.size === 0) {
    sharedSoundPreferred = readQueueCallSoundPreference()
  }
  audioOwners.add(owner)
  notifyAudioListeners()
}

function releaseAudioOwner(owner: symbol): void {
  stopSharedOscillator(owner)
  audioOwners.delete(owner)
  if (audioOwners.size === 0) {
    closeSharedAudioContext()
  }
}

function enableSharedSound(): void {
  writeQueueCallSoundPreference(true)
  sharedSoundPreferred = true
  notifyAudioListeners()

  const AudioContextConstructor = getAudioContextConstructor()
  if (!AudioContextConstructor) {
    return
  }

  try {
    const context = sharedAudioContext ?? new AudioContextConstructor()
    sharedAudioContext = context
    void context
      .resume()
      .then(() => {
        if (sharedAudioContext === context && audioOwners.size > 0) {
          sharedSoundEnabled = true
          notifyAudioListeners()
        }
      })
      .catch(() => {
        if (sharedAudioContext === context) {
          closeSharedAudioContext()
        }
      })
  } catch {
    closeSharedAudioContext()
  }
}

function disableSharedSound(): void {
  writeQueueCallSoundPreference(false)
  sharedSoundPreferred = false
  closeSharedAudioContext()
}

function playSharedTone(owner: symbol): void {
  const context = sharedAudioContext
  if (!sharedSoundEnabled || !context) {
    return
  }

  stopSharedOscillator(owner)

  try {
    const oscillator = context.createOscillator()
    oscillator.type = "sine"
    oscillator.frequency.value = 880
    oscillator.connect(context.destination)
    oscillator.onended = () => {
      if (activeOscillators.get(owner) === oscillator) {
        activeOscillators.delete(owner)
      }
      try {
        oscillator.disconnect()
      } catch {
        // A replacement or disable action may already have disconnected it.
      }
    }
    activeOscillators.set(owner, oscillator)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.75)
  } catch {
    stopSharedOscillator(owner)
  }
}

export function useQueueCallAlert(ticket: QueueTicket) {
  const [owner] = useState(() => Symbol("queue-call-alert"))
  const [isCalled, setIsCalled] = useState(false)
  const [callMessage, setCallMessage] = useState<string | null>(null)
  const soundEnabled = useSyncExternalStore(
    subscribeToSharedSound,
    getSharedSoundEnabled,
    () => false,
  )
  const soundPreferred = useSyncExternalStore(
    subscribeToSharedSound,
    getSharedSoundPreferred,
    () => false,
  )
  const previousTicketRef = useRef<PreviousTicket | null>(null)
  const alertTimerRef = useRef<number | null>(null)

  const clearCalledState = useCallback(() => {
    if (alertTimerRef.current !== null) {
      window.clearTimeout(alertTimerRef.current)
      alertTimerRef.current = null
    }

    stopSharedOscillator(owner)
    releaseDocumentTitle(owner)
    setIsCalled(false)
    setCallMessage(null)
  }, [owner])

  const enableSound = useCallback(() => {
    enableSharedSound()
  }, [])

  const disableSound = useCallback(() => {
    disableSharedSound()
  }, [])

  const ticketNumber = ticket?.ticket_number
  const ticketStatus = ticket?.status

  useEffect(() => {
    registerAudioOwner(owner)
    return () => {
      clearCalledState()
      releaseAudioOwner(owner)
    }
  }, [clearCalledState, owner])

  useEffect(() => {
    const currentTicket =
      ticketNumber && ticketStatus
        ? { ticket_number: ticketNumber, status: ticketStatus }
        : null
    const previousTicket = previousTicketRef.current

    if (
      currentTicket &&
      previousTicket?.ticket_number === currentTicket.ticket_number &&
      previousTicket.status === "waiting" &&
      currentTicket.status === "serving"
    ) {
      const title = `Now serving ${currentTicket.ticket_number} — GRC Queue`
      claimDocumentTitle(owner, title)
      setIsCalled(true)
      setCallMessage(
        `Your ticket ${currentTicket.ticket_number} is now being served.`,
      )
      toast(title)

      try {
        navigator.vibrate?.(VIBRATION_PATTERN)
      } catch {
        // Vibration is a best-effort enhancement and must not suppress the
        // visible or assistive-technology announcement.
      }

      if (getSharedSoundEnabled()) {
        playSharedTone(owner)
      }

      alertTimerRef.current = window.setTimeout(
        clearCalledState,
        ALERT_DURATION_MS,
      )
    }

    previousTicketRef.current = currentTicket

    return clearCalledState
  }, [clearCalledState, owner, ticketNumber, ticketStatus])

  return {
    isCalled,
    callMessage,
    soundEnabled,
    soundPreferred,
    enableSound,
    disableSound,
  }
}
