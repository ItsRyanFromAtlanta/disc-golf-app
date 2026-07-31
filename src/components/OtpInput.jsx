import { useRef, useState } from 'react'
import {
  clearSlot,
  compactSlots,
  firstDigit,
  sanitizePastedCode,
  setSlotDigit,
  toSlots,
} from '../lib/otpEntry'

// Zero-typing-adjacent 6-digit entry: giant tap targets instead of a single
// text field, with paste support so a copied email code fills every box at
// once. autoComplete="one-time-code" is a hint for platform code suggestions
// (iOS Mail, etc.) — not the SMS-only WebOTP API, since this is email OTP.
//
// Box contents come from a positional slot array, not from indexing the compact
// `value` string. The two disagree whenever the grid has a gap, and resolving
// that disagreement in favour of the string is what used to relocate digits
// typed into non-adjacent boxes — see src/lib/otpEntry.js for the mechanism.
// The parent still receives the compact digits-only string it has always
// received; only the display model changed.
export default function OtpInput({ length = 6, value, onChange }) {
  const inputsRef = useRef([])
  const [slots, setSlots] = useState(() => toSlots(value, length))
  const [lastValue, setLastValue] = useState(value)

  // Re-derive the grid when the code changes from outside this component — a
  // paste, or the parent resetting the field. Our own edits call `onChange`
  // with exactly `compactSlots(slots)`, so they never trip this and never
  // discard the gaps the user is looking at. (Adjusting state during render,
  // rather than in an effect, so the boxes never paint a stale frame.)
  if (value !== lastValue) {
    setLastValue(value)
    if (value !== compactSlots(slots)) setSlots(toSlots(value, length))
  }

  function commit(next) {
    setSlots(next)
    onChange(compactSlots(next))
  }

  function handleChange(index, rawValue) {
    const digit = firstDigit(rawValue)
    if (!digit) return
    commit(setSlotDigit(slots, index, digit))
    if (index < length - 1) inputsRef.current[index + 1]?.focus()
  }

  function handleKeyDown(index, e) {
    if (e.key !== 'Backspace') return
    if (slots[index]) {
      commit(clearSlot(slots, index))
    } else if (index > 0) {
      inputsRef.current[index - 1]?.focus()
      commit(clearSlot(slots, index - 1))
    }
  }

  function handlePaste(e) {
    const pasted = sanitizePastedCode(e.clipboardData.getData('text'), length)
    if (!pasted) return
    e.preventDefault()
    commit(toSlots(pasted, length))
    inputsRef.current[Math.min(pasted.length, length - 1)]?.focus()
  }

  return (
    <div className="otp-input-grid" onPaste={handlePaste}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => (inputsRef.current[i] = el)}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={slots[i] ?? ''}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className="otp-input-box"
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  )
}
