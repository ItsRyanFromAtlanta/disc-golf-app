// The Suspense fallback for a route whose chunk is still downloading.
//
// Deliberately identical to the loading state the screens themselves already
// render while their queries resolve (`<p className="loading">Loading...</p>`,
// see CoursesPage, RoundsPage, HistoryPage, RegimenRunPage, FreeformLogPage).
// Reusing that exact treatment is the point: a code-split navigation must be
// indistinguishable from a data-fetching one. A spinner, a skeleton, or an
// empty frame would each announce the split to the user, and an empty frame
// would collapse the scroll region and shift layout on arrival.
export default function ScreenFallback() {
  return <p className="loading">Loading...</p>
}
