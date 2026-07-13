// Pure parser for one official MVP Disc Sports product page.
//
// The fetcher owns network policy and raw-byte checksums. This module only
// turns a bounded HTML page into the payload shape consumed by the existing
// manufacturer adapter. It deliberately extracts facts and does not retain
// manufacturer prose or images.

const OFFICIAL_HOSTS = Object.freeze(['mvpdiscsports.com', 'www.mvpdiscsports.com'])
const PRODUCT_CLASS_PATTERN = /\b\d+(?:\.\d+)?mm\s+(?:Distance Drivers|Fairway Drivers|Midrange Drivers|Putt\s*\/\s*Approach|Hybrid Catch Disc)\b/i
const NUMBER_PATTERN = /[-+]?(?:\d+(?:\.\d*)?|\.\d+)/g

function parserError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function requireText(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw parserError('mvp_page_invalid', `${field} is required`)
  return value.trim()
}

function decodeEntities(value) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)))
}

function fragmentToText(fragment) {
  return decodeEntities(String(fragment)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}

function officialProductUrl(sourceUrl) {
  const normalized = requireText(sourceUrl, 'sourceUrl')
  let url
  try {
    url = new URL(normalized)
  } catch {
    throw parserError('mvp_source_invalid', 'sourceUrl must be a valid URL')
  }
  if (url.protocol !== 'https:' || !OFFICIAL_HOSTS.includes(url.hostname.toLowerCase())) {
    throw parserError('mvp_source_not_official', 'sourceUrl must use the official MVP Disc Sports host')
  }
  if (!url.pathname.toLowerCase().startsWith('/discs/')) {
    throw parserError('mvp_product_url_required', 'sourceUrl must reference an MVP product page')
  }
  url.hash = ''
  return url.toString()
}

function extractTitle(html) {
  const match = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)
  if (!match) throw parserError('mvp_product_name_missing', 'MVP product page h1 is required')
  return fragmentToText(match[1])
}

function numbersFrom(value) {
  return [...String(value).matchAll(NUMBER_PATTERN)].map(([match]) => Number(match))
}

function extractFlightNumbers(html, text, titleStart, classIndex) {
  const explicit = html.match(/data-(?:flight|flight-ratings|flight-numbers)\s*=\s*["']([^"']+)["']/i)
  const explicitNumbers = explicit ? numbersFrom(explicit[1]) : []
  if (explicitNumbers.length >= 4) return explicitNumbers.slice(0, 4)

  const end = classIndex > titleStart ? classIndex : text.length
  const pageHeaderNumbers = numbersFrom(text.slice(titleStart, end))
  if (pageHeaderNumbers.length < 4) {
    throw parserError('mvp_flight_numbers_missing', 'MVP product page flight numbers are required')
  }
  return pageHeaderNumbers.slice(-4)
}

function extractClass(text, startIndex) {
  const expression = new RegExp(PRODUCT_CLASS_PATTERN.source, 'ig')
  let match = expression.exec(text)
  while (match && match.index < startIndex) match = expression.exec(text)
  if (!match) throw parserError('mvp_class_missing', 'MVP product page disc class is required')
  return {
    name: match[0].replace(/\s+/g, ' ').trim(),
    index: match.index,
  }
}

function categoryForClass(className) {
  const normalized = className.toLocaleLowerCase('en-US')
  if (normalized.includes('distance')) return 'distance driver'
  if (normalized.includes('fairway')) return 'fairway driver'
  if (normalized.includes('midrange')) return 'midrange'
  if (normalized.includes('putt')) return 'putt / approach'
  if (normalized.includes('hybrid')) return 'hybrid catch'
  throw parserError('mvp_class_unsupported', `Unsupported MVP product class: ${className}`)
}

function extractMeasurement(text, label, unit) {
  const expression = new RegExp(`\\b${label}\\s+(\\d+(?:\\.\\d+)?)\\s*${unit}\\b`, 'i')
  const match = text.match(expression)
  if (!match) throw parserError('mvp_measurement_missing', `${label} is required on the MVP product page`)
  return Number(match[1])
}

function boundedNumber(value, field, minimum, maximum) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw parserError('mvp_flight_number_invalid', `${field} is outside the allowed MVP flight range`)
  }
  return value
}

export function parseMvpProductPage({ html, sourceUrl } = {}) {
  const sourceReference = officialProductUrl(sourceUrl)
  const markup = requireText(html, 'html')
  const title = extractTitle(markup)
  const text = fragmentToText(markup)
  const titleIndex = text.toLocaleLowerCase('en-US').indexOf(title.toLocaleLowerCase('en-US'))
  const titleEnd = titleIndex >= 0 ? titleIndex + title.length : 0
  const classMatch = extractClass(text, titleEnd)
  const className = classMatch.name
  const [speed, glide, turn, fade] = extractFlightNumbers(markup, text, titleEnd, classMatch.index)
  const diameterCm = extractMeasurement(text, 'Diameter', 'cm')
  const rimWidthMm = extractMeasurement(text, 'Rim Width', 'mm')

  return {
    manufacturer: {
      name: 'MVP',
      officialUrl: 'https://mvpdiscsports.com/',
    },
    molds: [{
      name: title,
      category: categoryForClass(className),
      className,
      speed: boundedNumber(speed, 'speed', 1, 15),
      glide: boundedNumber(glide, 'glide', 0, 7),
      turn: boundedNumber(turn, 'turn', -5, 3),
      fade: boundedNumber(fade, 'fade', 0, 5),
      diameterCm: boundedNumber(diameterCm, 'diameterCm', 15, 30),
      rimWidthMm: boundedNumber(rimWidthMm, 'rimWidthMm', 1, 30),
      sourceUrl: sourceReference,
    }],
  }
}
