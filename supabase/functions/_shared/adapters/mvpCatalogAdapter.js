// Server-only, network-free MVP source adapter.
//
// The ingestion fetcher owns network access and supplies a parsed payload. This
// adapter only validates that the payload is attributed to MVP's official host
// and turns a bounded source snapshot into reviewable mold candidates. It does
// not fetch pages, copy images, or write canonical tables.

import {
  catalogIdentityKey,
  normalizeCatalogText,
} from '../../../../src/lib/catalog/catalogContracts.js'
import {
  createManufacturerAdapterRegistry,
  defineManufacturerAdapter,
} from '../../../../src/lib/catalog/manufacturerAdapter.js'

export const MVP_OFFICIAL_ADAPTER_KEY = 'mvp-catalog'
export const MVP_OFFICIAL_ADAPTER_VERSION = '1.0.0'
export const MVP_OFFICIAL_SOURCE_HOSTS = Object.freeze(['mvpdiscsports.com', 'www.mvpdiscsports.com'])

export const MVP_OFFICIAL_SOURCE = Object.freeze({
  type: 'manufacturer',
  name: 'MVP Disc Sports official catalog pages',
  url: 'https://mvpdiscsports.com/mvp-retail-placards/',
})

const officialMolds = [
  {
    name: 'Watt',
    category: 'putt / approach',
    className: '9mm Putt / Approach',
    speed: 2,
    glide: 5,
    turn: -0.5,
    fade: 0.5,
    diameterCm: 21.2,
    rimWidthMm: 9,
    sourceUrl: 'https://mvpdiscsports.com/discs/watt/',
  },
  {
    name: 'Terra',
    category: 'fairway driver',
    className: '18mm Fairway Drivers',
    speed: 8,
    glide: 5,
    turn: 0,
    fade: 3,
    diameterCm: 21.2,
    rimWidthMm: 18,
    sourceUrl: 'https://mvpdiscsports.com/discs/terra/',
  },
  {
    name: 'Volt',
    category: 'fairway driver',
    className: '18mm Fairway Drivers',
    speed: 8,
    glide: 5,
    turn: -0.5,
    fade: 2,
    diameterCm: 21.1,
    rimWidthMm: 18,
    sourceUrl: 'https://mvpdiscsports.com/discs/volt/',
  },
  {
    name: 'Photon',
    category: 'distance driver',
    className: '21mm Distance Drivers',
    speed: 11,
    glide: 5,
    turn: -1,
    fade: 2.5,
    diameterCm: 21.1,
    rimWidthMm: 21,
    sourceUrl: 'https://mvpdiscsports.com/discs/photon/',
  },
].map((mold) => Object.freeze(mold))

export const MVP_OFFICIAL_PAYLOAD = Object.freeze({
  manufacturer: Object.freeze({
    name: 'MVP',
    officialUrl: 'https://mvpdiscsports.com/',
  }),
  molds: Object.freeze(officialMolds),
})

function isRecord(value) {
  if (value === null || typeof value !== 'object') return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function officialUrl(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required`)
  let url
  try {
    url = new URL(value.trim())
  } catch {
    throw new Error(`${field} must be a valid URL`)
  }
  if (url.protocol !== 'https:' || !MVP_OFFICIAL_SOURCE_HOSTS.includes(url.hostname.toLowerCase())) {
    throw new Error(`${field} must reference the official MVP Disc Sports host`)
  }
  url.hash = ''
  return url.toString()
}

function finiteNumber(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${field} must be a finite number`)
  }
  return value
}

function validatePayload(payload) {
  if (!isRecord(payload) || !isRecord(payload.manufacturer)) {
    throw new TypeError('MVP payload manufacturer is required')
  }
  const manufacturerName = normalizeCatalogText(payload.manufacturer.name, 'payload.manufacturer.name')
  if (manufacturerName.toLocaleLowerCase('en-US') !== 'mvp') {
    throw new Error('MVP payload manufacturer must be MVP')
  }
  if (payload.manufacturer.officialUrl !== undefined) {
    officialUrl(payload.manufacturer.officialUrl, 'payload.manufacturer.officialUrl')
  }
  if (!Array.isArray(payload.molds) || payload.molds.length === 0) {
    throw new Error('MVP payload must contain at least one mold')
  }
  return payload.molds
}

function normalizeMoldCandidate(mold) {
  if (!isRecord(mold)) throw new TypeError('MVP mold payload must be an object')
  const name = normalizeCatalogText(mold.name, 'mold.name')
  const sourceReference = officialUrl(mold.sourceUrl, `mold.sourceUrl for ${name}`)
  const identity = { manufacturerKey: 'mvp', moldKey: name }
  const fields = {
    mold_name: name,
    speed: finiteNumber(mold.speed, `${name}.speed`),
    glide: finiteNumber(mold.glide, `${name}.glide`),
    turn: finiteNumber(mold.turn, `${name}.turn`),
    fade: finiteNumber(mold.fade, `${name}.fade`),
    category: normalizeCatalogText(mold.category, `${name}.category`).toLocaleLowerCase('en-US'),
  }

  return {
    entityType: 'mold',
    identity,
    identityKey: catalogIdentityKey('mold', identity),
    fields,
    supportedFields: Object.keys(fields),
    sourceReference,
    evidenceSnapshot: {
      sourcePage: sourceReference,
      officialClass: normalizeCatalogText(mold.className, `${name}.className`),
      diameterCm: finiteNumber(mold.diameterCm, `${name}.diameterCm`),
      rimWidthMm: finiteNumber(mold.rimWidthMm, `${name}.rimWidthMm`),
    },
    confidence: 'manufacturer_verified',
  }
}

async function normalizeMvpPayload(payload, context) {
  if (!context?.source || context.source.type !== 'manufacturer') {
    throw new Error('MVP adapter requires a manufacturer source')
  }
  officialUrl(context.source.url, 'source.url')
  return validatePayload(payload)
    .map(normalizeMoldCandidate)
    .sort((left, right) => left.identityKey.localeCompare(right.identityKey))
}

export const mvpOfficialAdapter = defineManufacturerAdapter({
  adapterKey: MVP_OFFICIAL_ADAPTER_KEY,
  adapterVersion: MVP_OFFICIAL_ADAPTER_VERSION,
  manufacturerName: 'MVP',
  normalize: normalizeMvpPayload,
})

export const mvpOfficialAdapterRegistry = createManufacturerAdapterRegistry([mvpOfficialAdapter])
