import { describe, expect, it } from 'vitest'
import { parseMvpProductPage } from './mvpProductPageParser.js'

const PHOTON_PAGE = `
  <html>
    <body>
      <nav>Discs 21mm Distance Drivers</nav>
      <h1>Photon</h1>
      <div class="flight-numbers"><span>11</span><span>5</span><span>-1</span><span>2.5</span></div>
      <div>Stable-Overstable</div>
      <div>21mm Distance Drivers</div>
      <h2>Specifications</h2>
      <table>
        <tr><th>Class</th><td>21mm Distance Drivers</td></tr>
        <tr><th>Weights</th><td>145g - 175g</td></tr>
        <tr><th>Diameter</th><td>21.1cm</td></tr>
        <tr><th>Rim Width</th><td>21mm</td></tr>
      </table>
      <script>11 5 -1 2.5 99cm</script>
    </body>
  </html>
`

describe('MVP product page parser', () => {
  it('extracts reviewable flight and dimension facts without page prose', () => {
    const result = parseMvpProductPage({
      html: PHOTON_PAGE,
      sourceUrl: 'https://mvpdiscsports.com/discs/photon/',
    })

    expect(result).toEqual({
      manufacturer: {
        name: 'MVP',
        officialUrl: 'https://mvpdiscsports.com/',
      },
      molds: [{
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
      }],
    })
  })

  it('supports a data-flight attribute and rejects non-product or incomplete pages', () => {
    const page = PHOTON_PAGE
      .replace('<div class="flight-numbers"><span>11</span><span>5</span><span>-1</span><span>2.5</span></div>', '')
      .replace('<h1>Photon</h1>', '<h1>Photon</h1><div data-flight-ratings="11,5,-1,2.5"></div>')
    expect(parseMvpProductPage({ html: page, sourceUrl: 'https://www.mvpdiscsports.com/discs/photon/' }).molds[0].fade).toBe(2.5)

    expect(() => parseMvpProductPage({ html: PHOTON_PAGE, sourceUrl: 'https://example.com/discs/photon/' })).toThrow(
      'official MVP Disc Sports host',
    )
    expect(() => parseMvpProductPage({
      html: PHOTON_PAGE.replace('Rim Width</th><td>21mm', 'Rim</th><td>21mm'),
      sourceUrl: 'https://mvpdiscsports.com/discs/photon/',
    })).toThrow('Rim Width is required')
  })
})
