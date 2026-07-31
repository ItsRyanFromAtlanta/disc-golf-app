import { describe, expect, it } from 'vitest'
import {
  clearSlot,
  compactSlots,
  firstDigit,
  sanitizePastedCode,
  setSlotDigit,
  toSlots,
} from './otpEntry'

const LENGTH = 6

// The exact behaviour the old string-padding implementation had, kept here so
// the regression tests below assert against the real defect rather than a
// remembered description of it.
function legacySetDigit(value, index, digit, length = LENGTH) {
  const chars = value.padEnd(length, ' ').split('')
  chars[index] = digit
  return chars.join('').replace(/ /g, '')
}

describe('the defect being fixed', () => {
  it('reproduces the reported relocation in the old implementation', () => {
    // Two digits entered, then a digit typed into the LAST box.
    expect(legacySetDigit('12', 5, '9')).toBe('129')
    // '9' is now at index 2, so it renders in box 3 — three boxes from where
    // the user typed it.
    expect('129'[2]).toBe('9')
  })

  it('reproduces the old backspace shift', () => {
    // Clearing box 3 of a full code drags 4, 5 and 6 one box to the left.
    expect(legacySetDigit('123456', 2, '')).toBe('12456')
  })
})

describe('typing into non-adjacent boxes', () => {
  // The reported case, asserted on the shipped model.
  it('leaves a digit in the box it was typed into', () => {
    const slots = setSlotDigit(toSlots('12', LENGTH), 5, '9')
    expect(slots).toEqual(['1', '2', '', '', '', '9'])
    // Box 6 shows the 9. Boxes 3-5 are still empty. Nothing moved.
    expect(slots[5]).toBe('9')
    expect(slots[2]).toBe('')
  })

  it('does not lose the far digit when the gap is filled in afterwards', () => {
    // This is what the old code destroyed. After the relocation above the
    // compact value is "129", so the 9 sits at index 2 — and filling in "box 3"
    // writes straight over it. The digit is not reordered, it is gone.
    expect(legacySetDigit('129', 2, '3')).toBe('123')

    let slots = setSlotDigit(toSlots('12', LENGTH), 5, '9')
    slots = setSlotDigit(slots, 2, '3')
    slots = setSlotDigit(slots, 3, '4')
    slots = setSlotDigit(slots, 4, '5')
    expect(slots).toEqual(['1', '2', '3', '4', '5', '9'])
    expect(compactSlots(slots)).toBe('123459')
  })

  it('handles several disjoint boxes filled in any order', () => {
    let slots = toSlots('', LENGTH)
    slots = setSlotDigit(slots, 4, '5')
    slots = setSlotDigit(slots, 0, '1')
    slots = setSlotDigit(slots, 2, '3')
    expect(slots).toEqual(['1', '', '3', '', '5', ''])
    expect(compactSlots(slots)).toBe('135')
  })

  it('replaces in place when a filled box is typed over', () => {
    const slots = setSlotDigit(toSlots('123456', LENGTH), 3, '0')
    expect(slots).toEqual(['1', '2', '3', '0', '5', '6'])
    expect(compactSlots(slots)).toBe('123056')
  })
})

describe('backspace into a middle box', () => {
  it('clears only that box and shifts nothing', () => {
    const slots = clearSlot(toSlots('123456', LENGTH), 2)
    expect(slots).toEqual(['1', '2', '', '4', '5', '6'])
    // Boxes 4, 5 and 6 still read 4, 5 and 6 — the old code made them 5, 6, ''.
    expect(slots[3]).toBe('4')
    expect(slots[5]).toBe('6')
  })

  it('lets a cleared middle box be retyped back to the original code', () => {
    let slots = clearSlot(toSlots('123456', LENGTH), 2)
    slots = setSlotDigit(slots, 2, '3')
    expect(compactSlots(slots)).toBe('123456')
  })
})

describe('compactSlots', () => {
  it('reaches full length only when every box is filled', () => {
    expect(compactSlots(['1', '2', '', '', '', '9'])).toBe('129')
    expect(compactSlots(['1', '2', '', '4', '5', '6'])).toBe('12456')
    expect(compactSlots(['1', '2', '3', '4', '5', '6'])).toBe('123456')
  })

  // AuthPage enables its submit button at `otp.length === 6`. A gapped grid
  // must never reach that length, or the user would submit a partial code.
  it('never reports a gapped grid as a complete code', () => {
    const gapped = [
      ['1', '2', '', '', '', '9'],
      ['', '2', '3', '4', '5', '6'],
      ['1', '2', '3', '', '5', '6'],
    ]
    for (const slots of gapped) expect(compactSlots(slots).length).toBeLessThan(LENGTH)
  })

  it('emits digits only, never padding', () => {
    expect(compactSlots(toSlots('12', LENGTH))).toBe('12')
    expect(compactSlots(toSlots('', LENGTH))).toBe('')
  })
})

describe('toSlots', () => {
  it('always returns exactly `length` slots', () => {
    expect(toSlots('', LENGTH)).toHaveLength(LENGTH)
    expect(toSlots('123', LENGTH)).toHaveLength(LENGTH)
    expect(toSlots('123456', LENGTH)).toHaveLength(LENGTH)
  })

  it('left-aligns a compact code and pads with empty slots', () => {
    expect(toSlots('12', LENGTH)).toEqual(['1', '2', '', '', '', ''])
  })

  it('truncates anything longer than the grid', () => {
    expect(toSlots('12345678', LENGTH)).toEqual(['1', '2', '3', '4', '5', '6'])
  })

  it('treats null and undefined as an empty grid', () => {
    expect(toSlots(null, LENGTH)).toEqual(['', '', '', '', '', ''])
    expect(toSlots(undefined, LENGTH)).toEqual(['', '', '', '', '', ''])
  })

  it('round-trips through compactSlots for a gapless code', () => {
    expect(compactSlots(toSlots('123456', LENGTH))).toBe('123456')
  })
})

describe('setSlotDigit', () => {
  it('does not mutate the array it is given', () => {
    const slots = toSlots('12', LENGTH)
    const next = setSlotDigit(slots, 5, '9')
    expect(slots).toEqual(['1', '2', '', '', '', ''])
    expect(next).not.toBe(slots)
  })

  it('is a no-op for an out-of-range index rather than growing the grid', () => {
    const slots = toSlots('12', LENGTH)
    expect(setSlotDigit(slots, LENGTH, '9')).toBe(slots)
    expect(setSlotDigit(slots, -1, '9')).toBe(slots)
    expect(setSlotDigit(slots, 1.5, '9')).toBe(slots)
    expect(setSlotDigit(slots, LENGTH, '9')).toHaveLength(LENGTH)
  })
})

describe('firstDigit', () => {
  it('takes the last digit so typing over a filled box replaces it', () => {
    // The box already holds '1'; the browser reports the field as '19'.
    expect(firstDigit('19')).toBe('9')
  })

  it('strips non-digits and reports nothing for input with none', () => {
    expect(firstDigit('a')).toBe('')
    expect(firstDigit('')).toBe('')
    expect(firstDigit(null)).toBe('')
    expect(firstDigit('-')).toBe('')
  })
})

describe('sanitizePastedCode', () => {
  it('keeps digits only and caps at the grid length', () => {
    expect(sanitizePastedCode('123-456', LENGTH)).toBe('123456')
    expect(sanitizePastedCode('Your code is 483920', LENGTH)).toBe('483920')
    expect(sanitizePastedCode('1234567890', LENGTH)).toBe('123456')
  })

  it('reports nothing for a paste with no digits', () => {
    expect(sanitizePastedCode('hello', LENGTH)).toBe('')
    expect(sanitizePastedCode(null, LENGTH)).toBe('')
  })
})
