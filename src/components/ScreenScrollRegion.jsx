import { forwardRef } from 'react'

const ScreenScrollRegion = forwardRef(function ScreenScrollRegion({ children, onScroll }, ref) {
  return (
    <main ref={ref} className="screen-scroll-region" onScroll={onScroll} tabIndex={-1}>
      {children}
    </main>
  )
})

export default ScreenScrollRegion
