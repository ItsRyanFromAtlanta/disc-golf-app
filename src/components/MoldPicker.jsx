import { useMemo, useState } from 'react'
import { filterCatalogMolds, useCatalog } from '../lib/repository/catalogRepository'

export default function MoldPicker({ selectedMold, onSelect }) {
  const [query, setQuery] = useState('')
  const catalog = useCatalog()
  const results = useMemo(
    () => (catalog.data && query.trim() ? filterCatalogMolds(catalog.data, { query }) : []),
    [catalog.data, query],
  )

  function handleSearch(value) {
    setQuery(value)
  }

  if (selectedMold) {
    return (
      <div className="mold-picker-selected">
        <span>
          <strong>{selectedMold.manufacturer}</strong> {selectedMold.mold_name}
          {selectedMold.speed != null && (
            <span className="log-time">
              {' '}
              ({selectedMold.speed}/{selectedMold.glide}/{selectedMold.turn}/{selectedMold.fade})
            </span>
          )}
        </span>
        <button type="button" className="link-button" onClick={() => onSelect(null)}>
          Change
        </button>
      </div>
    )
  }

  return (
    <div className="mold-picker">
      <label htmlFor="mold-search">Mold</label>
      <input
        id="mold-search"
        type="text"
        placeholder="Search manufacturer or mold name..."
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
      />
      {catalog.isLoading && <p className="loading">Loading catalog...</p>}
      {results.length > 0 && (
        <ul className="mold-picker-results">
          {results.map((mold) => (
            <li key={mold.id}>
              <button type="button" className="mold-picker-result" onClick={() => onSelect(mold)}>
                <strong>{mold.manufacturer}</strong> {mold.mold_name}
                <span className="log-time">
                  {mold.speed}/{mold.glide}/{mold.turn}/{mold.fade}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {catalog.error && <p className="form-error">{catalog.error.message}</p>}
      {query.trim() && !catalog.isLoading && results.length === 0 && <p>No approved molds match.</p>}
    </div>
  )
}
