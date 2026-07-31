// Positional slot model for the 6-box OTP entry grid.
//
// THE DEFECT THIS REPLACES. `OtpInput.setDigit` kept the code as a single
// compact string and reconstructed position on every keystroke by padding with
// spaces, writing the indexed character, then stripping *all* spaces:
//
//   const chars = value.padEnd(length, ' ').split('')
//   chars[index] = digit
//   onChange(chars.join('').replace(/ /g, ''))
//
// The strip is unconditional, so interior padding collapses along with the
// trailing padding it was meant to remove, and index position is not preserved.
// With `value = "12"`, typing `9` into box 6 produced `"12    "` -> `"12   9"`
// -> `"129"`: the digit rendered in box 3, three boxes from where it was typed.
// Backspacing into a middle box did the mirror image — clearing index 2 of
// "123456" yielded "12456", shifting every later digit one box left, so a user
// correcting one digit silently corrupted the four after it.
//
// Sequential entry with auto-advance never triggers either case, which is why
// it shipped. Tapping back to fix one box does, and so does any
// assistive-technology or keyboard navigation that lands on a box out of order.
//
// THE MODEL. Position is the thing being edited, so position is what gets
// stored: a fixed-length array of slots, each holding one digit or the empty
// string. Nothing collapses because nothing is ever reconstructed.
//
// The compact string remains the value handed to the parent — `AuthPage` gates
// its submit button on `otp.length < 6` and posts the string to `verifyOtp`, so
// it must stay digits-only with no padding. That stays sound here because a
// compact string reaches full length only when every slot is filled, and a grid
// with no gaps has nothing to collapse: display order and compact order agree
// exactly at the moment submission becomes possible. Below that, a gapped grid
// reports fewer characters than boxes and the submit button correctly stays
// disabled.

// A fixed-length slot array from a compact code. Reconstruction can only
// left-align — a compact string carries no gap information — which is correct
// for the cases that produce one (paste, an external reset, first mount).
export function toSlots(value, length) {
  const digits = String(value ?? '').slice(0, length).split('')
  return Array.from({ length }, (_, index) => digits[index] ?? '')
}

// The digits-only string the parent consumes. Empty slots contribute nothing.
export function compactSlots(slots) {
  return slots.join('')
}

// Write one slot, leaving every other slot exactly where it is. Passing '' is
// how a slot is cleared; out-of-range indexes are a no-op rather than growing
// the array past `length`.
export function setSlotDigit(slots, index, digit) {
  if (!Number.isInteger(index) || index < 0 || index >= slots.length) return slots
  const next = [...slots]
  next[index] = digit
  return next
}

export function clearSlot(slots, index) {
  return setSlotDigit(slots, index, '')
}

// A single digit out of whatever an input event produced. `slice(-1)` keeps the
// last one so typing over an already-filled box replaces rather than ignores.
export function firstDigit(rawValue) {
  return String(rawValue ?? '').replace(/\D/g, '').slice(-1)
}

// Digits only, capped at the grid length, for paste.
export function sanitizePastedCode(text, length) {
  return String(text ?? '').replace(/\D/g, '').slice(0, length)
}
