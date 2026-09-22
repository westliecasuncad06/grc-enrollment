/**
 * Formats a ticket number so SpeechSynthesis pronounces each character individually.
 * Example: "Q003" -> "Q 0 0 3", "Q-001" -> "Q 0 0 1"
 */
export function formatTicketForSpeech(ticketNumber: string): string {
  return ticketNumber
    .replace(/[^a-zA-Z0-9]/g, " ")
    .trim()
    .split("")
    .filter((char) => char.trim().length > 0)
    .join(" ")
}

/**
 * Plays a pleasant two-tone queue alert chime (D5 587.33 Hz -> A5 880 Hz).
 */
export function playAlertChime(): void {
  if (typeof window === "undefined") return

  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return

    const ctx = new AudioContextClass()
    const now = ctx.currentTime

    // First note: D5 (587.33 Hz)
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = "sine"
    osc1.frequency.setValueAtTime(587.33, now)
    gain1.gain.setValueAtTime(0.25, now)
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(now)
    osc1.stop(now + 0.25)

    // Second note: A5 (880 Hz)
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = "sine"
    osc2.frequency.setValueAtTime(880, now + 0.15)
    gain2.gain.setValueAtTime(0.25, now + 0.15)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(now + 0.15)
    osc2.stop(now + 0.55)

    setTimeout(() => {
      void ctx.close().catch(() => {})
    }, 800)
  } catch {
    // Audio contexts may be blocked by browser autoplay policies; fail silently
  }
}

/**
 * Speaks "Now serving ticket <X X X>" using SpeechSynthesis.
 */
export function announceTicketNumber(ticketNumber: string): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return
  }

  try {
    window.speechSynthesis.cancel()

    const formatted = formatTicketForSpeech(ticketNumber)
    const utterance = new SpeechSynthesisUtterance(`Now serving ticket ${formatted}`)
    utterance.rate = 0.9
    utterance.pitch = 1.0
    utterance.volume = 1.0

    const voices = window.speechSynthesis.getVoices?.() ?? []
    const englishVoice = voices.find((v) => v.lang.startsWith("en"))
    if (englishVoice) {
      utterance.voice = englishVoice
    }

    setTimeout(() => {
      try {
        window.speechSynthesis.speak(utterance)
      } catch {
        // Safe fallback
      }
    }, 280)
  } catch {
    // Safe fallback
  }
}

/**
 * Combines alert chime and voice announcement for calling a ticket.
 */
export function playQueueAlert(ticketNumber: string): void {
  playAlertChime()
  announceTicketNumber(ticketNumber)
}
