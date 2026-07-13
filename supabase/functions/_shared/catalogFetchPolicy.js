// Server-only fetch policy primitives. Keep this module free of Supabase and
// browser imports so an Edge Function can compose it with a concrete fetcher.

export const CATALOG_FETCH_LIMITS = Object.freeze({
  timeoutMs: 15_000,
  maxResponseBytes: 5 * 1024 * 1024,
  maxRedirects: 3,
  minimumHostDelayMs: 1_000,
  allowedContentTypes: Object.freeze([
    'application/json',
    'application/ld+json',
    'application/xhtml+xml',
    'text/html',
    'text/plain',
  ]),
})

function policyError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function requireUrl(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw policyError('url_required', 'Remote URL is required')
  }
  try {
    return new URL(value.trim())
  } catch {
    throw policyError('url_invalid', 'Remote URL must be valid')
  }
}

function normalizedHostname(value) {
  return value.toLowerCase().replace(/\.$/, '')
}

function isIpLiteral(hostname) {
  const ipv4 = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname)
  return ipv4 || hostname.includes(':')
}

function isReservedHostname(hostname) {
  return (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.lan')
  )
}

function normalizeAllowedHost(value) {
  if (typeof value !== 'string' || !value.trim()) return null
  return normalizedHostname(value.trim())
}

export function validateRemoteUrl(value) {
  const url = requireUrl(value)
  if (url.protocol !== 'https:') {
    throw policyError('https_required', 'Remote URL must use HTTPS')
  }
  if (url.username || url.password) {
    throw policyError('url_credentials_forbidden', 'Remote URL cannot contain credentials')
  }
  if (url.port && url.port !== '443') {
    throw policyError('url_port_forbidden', 'Remote URL must use the default HTTPS port')
  }

  const hostname = normalizedHostname(url.hostname)
  if (!hostname || isIpLiteral(hostname) || isReservedHostname(hostname)) {
    throw policyError('host_forbidden', 'Remote URL host is not fetchable')
  }

  url.hash = ''
  return url.toString()
}

export function assertAllowedRemoteHost(hostname, allowedHosts) {
  const normalized = normalizedHostname(hostname ?? '')
  if (!normalized || !Array.isArray(allowedHosts) || allowedHosts.length === 0) {
    throw policyError('host_allowlist_required', 'A non-empty remote host allowlist is required')
  }

  const allowed = allowedHosts.some((entry) => {
    const pattern = normalizeAllowedHost(entry)
    if (!pattern) return false
    if (pattern.startsWith('*.')) {
      const suffix = pattern.slice(2)
      return normalized.endsWith(`.${suffix}`)
    }
    return normalized === pattern
  })

  if (!allowed) throw policyError('host_not_allowlisted', `Remote host is not allowlisted: ${normalized}`)
  return normalized
}

function nonNegativeInteger(value, field) {
  const number = typeof value === 'string' && value.trim() ? Number(value) : value
  if (!Number.isInteger(number) || number < 0) {
    throw policyError('response_metadata_invalid', `${field} must be a non-negative integer`)
  }
  return number
}

export function validateFetchResponseMetadata(response, limits = CATALOG_FETCH_LIMITS) {
  if (!response || typeof response !== 'object') {
    throw policyError('response_metadata_invalid', 'Fetch response metadata is required')
  }

  const status = nonNegativeInteger(response.status, 'status')
  const responseBytes = nonNegativeInteger(response.responseBytes ?? 0, 'responseBytes')
  const contentLength = response.contentLength == null
    ? null
    : nonNegativeInteger(response.contentLength, 'contentLength')
  const redirectCount = nonNegativeInteger(response.redirectCount ?? 0, 'redirectCount')
  const notModified = status === 304

  if (!notModified && (status < 200 || status >= 300)) {
    throw policyError('http_status_not_allowed', `Remote response status is not ingestible: ${status}`)
  }
  if (contentLength !== null && contentLength > limits.maxResponseBytes) {
    throw policyError('response_too_large', 'Remote response content length exceeds the limit')
  }
  if (responseBytes > limits.maxResponseBytes) {
    throw policyError('response_too_large', 'Remote response exceeds the limit')
  }
  if (redirectCount > limits.maxRedirects) {
    throw policyError('too_many_redirects', 'Remote response exceeded the redirect limit')
  }

  const contentType = String(response.contentType ?? '').split(';', 1)[0].trim().toLowerCase()
  if (!notModified && !limits.allowedContentTypes.includes(contentType)) {
    throw policyError('content_type_not_allowed', `Remote content type is not ingestible: ${contentType || 'missing'}`)
  }

  return Object.freeze({
    status,
    responseBytes,
    contentLength,
    redirectCount,
    contentType: contentType || null,
    notModified,
  })
}
