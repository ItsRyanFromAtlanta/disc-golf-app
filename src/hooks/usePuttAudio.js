import { useCallback, useRef } from 'react'

const MAKE_LADDER_HZ = [440, 493, 554]
const MISS_THUD_HZ = 160

// Web Audio pitch-escalating make ladder + miss thud + SpeechSynthesis
// stage-completion announcements. Lazily creates its AudioContext on first
// use (required by browser autoplay policy — must happen inside a user
// gesture handler, which the gesture zone's pointer events satisfy).
export function usePuttAudio() {
  const audioCtxRef = useRef(null)
  const ladderIndexRef = useRef(0)
  const silencedRef = useRef(false)

  const ensureContext = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      audioCtxRef.current = new AudioContextClass()
    }
    return audioCtxRef.current
  }, [])

  const playTone = useCallback(
    (freq, durationMs, type = 'sine') => {
      if (silencedRef.current) return
      const ctx = ensureContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.value = freq
      osc.connect(gain)
      gain.connect(ctx.destination)
      const now = ctx.currentTime
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(0.3, now + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000)
      osc.start(now)
      osc.stop(now + durationMs / 1000 + 0.02)
    },
    [ensureContext],
  )

  // Climbs 440 -> 493 -> 554Hz per consecutive make, holding at the top rung
  // rather than cycling back down (a long streak should keep sounding
  // triumphant, not reset mid-streak).
  const playMake = useCallback(() => {
    const freq = MAKE_LADDER_HZ[Math.min(ladderIndexRef.current, MAKE_LADDER_HZ.length - 1)]
    playTone(freq, 140)
    ladderIndexRef.current += 1
  }, [playTone])

  const playMiss = useCallback(() => {
    ladderIndexRef.current = 0
    playTone(MISS_THUD_HZ, 220, 'triangle')
  }, [playTone])

  const announceStage = useCallback((stageNumber, totalStages, nextDistanceFt) => {
    if (silencedRef.current) return
    if (!window.speechSynthesis) return
    const message =
      nextDistanceFt != null
        ? `Stage cleared: ${stageNumber} of ${totalStages}. Move to ${nextDistanceFt} feet.`
        : `Stage cleared: ${stageNumber} of ${totalStages}.`
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(message))
  }, [])

  // Toggles both the tone ladder and SpeechSynthesis instantly — cancels any
  // in-flight announcement immediately on silencing.
  const setSilenced = useCallback((value) => {
    silencedRef.current = value
    if (value && window.speechSynthesis) window.speechSynthesis.cancel()
  }, [])

  return { playMake, playMiss, announceStage, setSilenced }
}
