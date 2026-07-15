import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { filterCatalogMolds, useCatalog } from '../../lib/repository/catalogRepository'
import { stabilityGaps } from '../../lib/wishlist'

// 3-tier vertical accordion (Mold -> Plastic) over the shared disc_molds
// catalog. The read-only repository hydrates normalized plastic/run/stamp
// rows and falls back to its IndexedDB snapshot when the network disappears.
export default function UniverseBrowser({ discs }) {
  const [query, setQuery] = useState('')
  const [openManufacturer, setOpenManufacturer] = useState(null)
  const [openMoldId, setOpenMoldId] = useState(null)
  const catalog = useCatalog()
  const results = useMemo(
    () => (catalog.data && query.trim() ? filterCatalogMolds(catalog.data, { query }) : []),
    [catalog.data, query],
  )

  const gaps = useMemo(() => stabilityGaps(discs ?? []), [discs])

  const byManufacturer = useMemo(() => {
    const groups = {}
    for (const mold of results) {
      groups[mold.manufacturer] ??= []
      groups[mold.manufacturer].push(mold)
    }
    return groups
  }, [results])

  function handleSearch(value) {
    setQuery(value)
    setOpenManufacturer(null)
    setOpenMoldId(null)
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
      {catalog.isLoading && <p className="loading">Loading catalog...</p>}
      {catalog.error && <p className="form-error">{catalog.error.message}</p>}
      {query.trim() && !catalog.isLoading && results.length === 0 && <p>No molds match.</p>}

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
                    {(mold.plastics?.length ? mold.plastics.map((plastic) => plastic.name) : ['Standard']).map((plastic) => (
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
