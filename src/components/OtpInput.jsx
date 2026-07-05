import { useRef } from 'react'

// Zero-typing-adjacent 6-digit entry: giant tap targets instead of a single
// text field, with paste support so a copied email code fills every box at
// once. autoComplete="one-time-code" is a hint for platform code suggestions
// (iOS Mail, etc.) — not the SMS-only WebOTP API, since this is email OTP.
export default function OtpInput({ length = 6, value, onChange }) {
  const inputsRef = useRef([])

  function setDigit(index, digit) {
    const chars = value.padEnd(length, ' ').split('')
    chars[index] = digit
    onChange(chars.join('').replace(/ /g, ''))
  }

  function handleChange(index, rawValue) {
    const digit = rawValue.replace(/\D/g, '').slice(-1)
    if (!digit) return
    setDigit(index, digit)
    if (index < length - 1) inputsRef.current[index + 1]?.focus()
  }

  function handleKeyDown(index, e) {
    if (e.key !== 'Backspace') return
    if (value[index]) {
      setDigit(index, '')
    } else if (index > 0) {
      inputsRef.current[index - 1]?.focus()
      setDigit(index - 1, '')
    }
  }

  function handlePaste(e) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (!pasted) return
    e.preventDefault()
    onChange(pasted)
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
          value={value[i] ?? ''}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className="otp-input-box"
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  )
}
