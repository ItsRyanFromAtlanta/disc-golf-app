// Server-only MVP product-page fetcher.
//
// This module owns network policy, redirect revalidation, timeout/size
// enforcement, exact raw-byte checksums, and parsing. It does not write
// Supabase tables or Storage; the raw bytes are handed to the injected staging
// store for the later transactional persistence binding.

import {
  CATALOG_FETCH_LIMITS,
  assertAllowedRemoteHost,
  validateFetchResponseMetadata,
  validateRemoteUrl,
} from './catalogFetchPolicy.js'
import { rawArtifactPathForChecksum } from './catalogIngestionPersistence.js'
import { parseMvpProductPage } from './mvpProductPageParser.js'

export const MVP_CATALOG_FETCH_USER_AGENT = 'DiscGolfApp-CatalogIngestion/1.0'

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

function fetchError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function requireFunction(value, field) {
  if (typeof value !== 'function') throw new TypeError(`${field} must be a function`)
  return value
}

function header(response, name) {
  return response.headers?.get?.(name) ?? null
}

function parseContentLength(value) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}

async function checksumBytes(bytes) {
  if (!globalThis.crypto?.subtle) throw new Error('A Web Crypto implementation is required to fetch catalog pages')
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function fetchWithTimeout(fetchImpl, url, options, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal })
  } catch (error) {
    if (error?.name === 'AbortError') throw fetchError('fetch_timeout', 'Remote catalog fetch timed out')
    throw error
  } finally {
    clearTimeout(timer)
  }
}

function sourcePolicyLimits(policy) {
  return { ...CATALOG_FETCH_LIMITS, ...(policy?.limits ?? {}) }
}

export function createMvpCatalogFetcher({
  fetchImpl = globalThis.fetch,
  clock = () => Date.now(),
  captureNow = () => new Date().toISOString(),
  sleep = (durationMs) => new Promise((resolve) => setTimeout(resolve, durationMs)),
} = {}) {
  requireFunction(fetchImpl, 'fetchImpl')
  requireFunction(clock, 'clock')
  requireFunction(captureNow, 'captureNow')
  requireFunction(sleep, 'sleep')

  const lastRequestAt = new Map()

  async function requestPage(url, policy) {
    const limits = sourcePolicyLimits(policy)
    const hostname = new URL(url).hostname.toLowerCase()
    const previousRequestAt = lastRequestAt.get(hostname)
    const elapsed = previousRequestAt === undefined ? limits.minimumHostDelayMs : clock() - previousRequestAt
    if (elapsed < limits.minimumHostDelayMs) await sleep(limits.minimumHostDelayMs - elapsed)
    lastRequestAt.set(hostname, clock())

    return fetchWithTimeout(fetchImpl, url, {
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': MVP_CATALOG_FETCH_USER_AGENT,
      },
      redirect: 'manual',
    }, limits.timeoutMs)
  }

  async function fetchCatalogPage({ url, policy } = {}) {
    const requestedUrl = validateRemoteUrl(url)
    const limits = sourcePolicyLimits(policy)
    assertAllowedRemoteHost(new URL(requestedUrl).hostname, policy?.allowedHosts)

    let currentUrl = requestedUrl
    let redirectCount = 0
    let response
    while (true) {
      response = await requestPage(currentUrl, { ...policy, limits })
      if (!REDIRECT_STATUSES.has(response.status)) break

      const location = header(response, 'location')
      if (!location) throw fetchError('redirect_location_missing', 'Remote catalog redirect has no location')
      if (redirectCount >= limits.maxRedirects) {
        throw fetchError('too_many_redirects', 'Remote catalog response exceeded the redirect limit')
      }
      const nextUrl = validateRemoteUrl(new URL(location, currentUrl).toString())
      assertAllowedRemoteHost(new URL(nextUrl).hostname, policy?.allowedHosts)
      currentUrl = nextUrl
      redirectCount += 1
    }

    const contentType = header(response, 'content-type')
    const declaredLength = parseContentLength(header(response, 'content-length'))
    validateFetchResponseMetadata({
      status: response.status,
      responseBytes: declaredLength ?? 0,
      contentLength: declaredLength,
      contentType,
      redirectCount,
    }, limits)

    const capturedAt = captureNow()
    if (response.status === 304) {
      const emptyBody = new Uint8Array(0)
      const rawChecksum = await checksumBytes(emptyBody)
      return {
        envelope: {
          requestedUrl,
          finalUrl: currentUrl,
          status: 304,
          contentType: null,
          responseBytes: 0,
          etag: header(response, 'etag'),
          lastModified: header(response, 'last-modified'),
          redirectCount,
          capturedAt,
          rawChecksum,
          notModified: true,
        },
        rawResponseBody: emptyBody,
      }
    }

    if (typeof response.arrayBuffer !== 'function') {
      throw fetchError('response_body_unavailable', 'Remote catalog response body is unavailable')
    }
    const rawResponseBody = new Uint8Array(await response.arrayBuffer())
    validateFetchResponseMetadata({
      status: response.status,
      responseBytes: rawResponseBody.byteLength,
      contentLength: declaredLength,
      contentType,
      redirectCount,
    }, limits)

    const normalizedContentType = String(contentType ?? '').split(';', 1)[0].trim().toLowerCase()
    if (!['text/html', 'application/xhtml+xml'].includes(normalizedContentType)) {
      throw fetchError('mvp_html_required', 'MVP product ingestion requires an HTML response')
    }
    const rawChecksum = await checksumBytes(rawResponseBody)
    const payload = parseMvpProductPage({
      html: new TextDecoder().decode(rawResponseBody),
      sourceUrl: currentUrl,
    })

    return {
      envelope: {
        requestedUrl,
        finalUrl: currentUrl,
        status: response.status,
        contentType: normalizedContentType,
        responseBytes: rawResponseBody.byteLength,
        etag: header(response, 'etag'),
        lastModified: header(response, 'last-modified'),
        redirectCount,
        capturedAt,
        rawChecksum,
        notModified: false,
      },
      payload,
      rawArtifact: {
        path: rawArtifactPathForChecksum(rawChecksum),
        checksum: rawChecksum,
      },
      rawResponseBody,
    }
  }

  return Object.freeze({ fetch: fetchCatalogPage })
}
