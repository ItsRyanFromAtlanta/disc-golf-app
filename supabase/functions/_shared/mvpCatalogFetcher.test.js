import { describe, expect, it, vi } from 'vitest'
import { createMvpCatalogFetcher, MVP_CATALOG_FETCH_USER_AGENT } from './mvpCatalogFetcher.js'

const SOURCE_URL = 'https://mvpdiscsports.com/discs/photon/'
const HTML = `
  <html><body>
    <h1>Photon</h1>
    <div data-flight-ratings="11,5,-1,2.5"></div>
    <div>Stable-Overstable</div>
    <div>21mm Distance Drivers</div>
    <div>Diameter 21.1cm</div>
    <div>Rim Width 21mm</div>
  </body></html>
`

const POLICY = {
  allowedHosts: ['mvpdiscsports.com'],
  limits: {
    minimumHostDelayMs: 0,
  },
}

describe('MVP catalog fetcher', () => {
  it('enforces the official host, parses HTML, and returns exact raw-artifact metadata', async () => {
    const response = new Response(HTML, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        etag: 'etag-photon',
      },
    })
    const fetchImpl = vi.fn(async (_url, options) => {
      expect(options.headers['user-agent']).toBe(MVP_CATALOG_FETCH_USER_AGENT)
      expect(options.redirect).toBe('manual')
      return response
    })
    const fetcher = createMvpCatalogFetcher({
      fetchImpl,
      captureNow: () => '2026-07-12T23:30:00.000Z',
      clock: () => 1000,
    })

    const result = await fetcher.fetch({ url: SOURCE_URL, policy: POLICY })

    expect(result).toMatchObject({
      envelope: {
        requestedUrl: SOURCE_URL,
        finalUrl: SOURCE_URL,
        status: 200,
        contentType: 'text/html',
        responseBytes: new TextEncoder().encode(HTML).byteLength,
        etag: 'etag-photon',
        redirectCount: 0,
        capturedAt: '2026-07-12T23:30:00.000Z',
        rawChecksum: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
      payload: {
        manufacturer: { name: 'MVP' },
        molds: [{ name: 'Photon', speed: 11, fade: 2.5 }],
      },
      rawArtifact: {
        path: expect.stringMatching(/^raw\/[a-f0-9]{64}\.raw$/),
      },
    })
    expect(result.rawArtifact.checksum).toBe(result.envelope.rawChecksum)
    expect(result.rawResponseBody).toBeInstanceOf(Uint8Array)
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it('revalidates redirect targets and rejects unallowlisted hosts', async () => {
    const redirect = new Response(null, {
      status: 302,
      headers: { location: 'https://example.com/discs/photon/' },
    })
    const fetchImpl = vi.fn(async () => redirect)
    const fetcher = createMvpCatalogFetcher({ fetchImpl, clock: () => 1000 })

    await expect(fetcher.fetch({ url: SOURCE_URL, policy: POLICY })).rejects.toMatchObject({
      code: 'host_not_allowlisted',
    })
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it('rejects oversized responses before parsing', async () => {
    const fetchImpl = vi.fn(async () => new Response(HTML, {
      status: 200,
      headers: {
        'content-type': 'text/html',
        'content-length': '5242881',
      },
    }))
    const fetcher = createMvpCatalogFetcher({ fetchImpl, clock: () => 1000 })

    await expect(fetcher.fetch({ url: SOURCE_URL, policy: POLICY })).rejects.toMatchObject({
      code: 'response_too_large',
    })
  })
})
