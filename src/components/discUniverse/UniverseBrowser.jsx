import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { searchMolds } from '../../lib/discLocker'
import { stabilityGaps } from '../../lib/wishlist'

// 3-tier vertical accordion (Mold -> Plastic) over the shared disc_molds
// catalog, driven by the existing free-text searchMolds -- disc_molds has no
// "browse everything" endpoint, so this stays search-first rather than
// inventing a full-catalog listing. Tapping a plastic hands off to the
// existing DiscFormPage add-disc flow (prefilled via query params) instead of
// a bespoke weight-selection drawer, since disc_molds has no per-run/weight
// rows to back one.
export default function UniverseBrowser({ discs }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState(null)
  const [openManufacturer, setOpenManufacturer] = useState(null)
  const [openMoldId, setOpenMoldId] = useState(null)

  const gaps = useMemo(() => stabilityGaps(discs ?? []), [discs])

  const byManufacturer = useMemo(() => {
    const groups = {}
    for (const mold of results) {
      groups[mold.manufacturer] ??= []
      groups[mold.manufacturer].push(mold)
    }
    return groups
  }, [results])

  async function handleSearch(value) {
    setQuery(value)
    setOpenManufacturer(null)
    setOpenMoldId(null)
    if (!value.trim()) {
      setResults([])
      return
    }
    setSearching(true)
    setError(null)
    try {
      setResults(await searchMolds(value))
    } catch (err) {
      setError(err.message)
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="universe-browser">
      {gaps.map((gap) => (
        <div key={`${gap.speedClass}-${gap.stabilityClass}`} className="ghost-slot-card">
          <span>
            👻 Ghost slot: {gap.stabilityClass} {gap.speedClass}
          </span>
          <span className="log-time">
            Speed {gap.exampleFlightNumbers.speed} / Fade {gap.exampleFlightNumbers.fade}
          </span>
        </div>
      ))}

      <input
        type="text"
        className="locker-search"
        placeholder="Search the disc universe..."
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
      />
      {searching && <p className="loading">Searching...</p>}
      {error && <p className="form-error">{error}</p>}
      {query.trim() && !searching && results.length === 0 && <p>No molds match.</p>}

      {Object.entries(byManufacturer).map(([manufacturer, molds]) => (
        <div key={manufacturer} className="universe-accordion-tier">
          <button
            type="button"
            className="universe-accordion-header"
            onClick={() => setOpenManufacturer(openManufacturer === manufacturer ? null : manufacturer)}
          >
            {manufacturer} <span className="log-time">({molds.length})</span>
          </button>
          {openManufacturer === manufacturer &&
            molds.map((mold) => (
              <div key={mold.id} className="universe-accordion-tier universe-accordion-tier-mold">
                <button
                  type="button"
                  className="universe-accordion-header"
                  onClick={() => setOpenMoldId(openMoldId === mold.id ? null : mold.id)}
                >
                  {mold.mold_name}{' '}
                  <span className="log-time">
                    {mold.speed}/{mold.glide}/{mold.turn}/{mold.fade}
                  </span>
                </button>
                {openMoldId === mold.id && (
                  <ul className="universe-plastic-list">
                    {(mold.plastics?.length ? mold.plastics : ['Standard']).map((plastic) => (
                      <li key={plastic}>
                        <Link
                          to={`/bag/discs/new?mold=${mold.id}&plastic=${encodeURIComponent(plastic)}`}
                          className="universe-plastic-row"
                        >
                          {plastic}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
        </div>
      ))}
    </div>
  )
}
