import { Link, useLocation } from 'react-router-dom'
import { IconBriefcase, IconTargetArrow, IconUserCircle } from '@tabler/icons-react'

// App-level bottom tab bar. Adding a feature area (Rounds, Caddie) later is
// a one-line addition here — no other wiring needed. Active state matches by
// path prefix so nested routes (e.g. /practice/history) keep their tab lit.
const TABS = [
  { to: '/practice', label: 'Practice', icon: IconTargetArrow },
  { to: '/bag', label: 'Bag', icon: IconBriefcase },
  { to: '/profile', label: 'Profile', icon: IconUserCircle },
]

export default function TabBar() {
  const { pathname } = useLocation()

  return (
    <nav className="tab-bar">
      {TABS.map((tab) => {
        const active = pathname === tab.to || pathname.startsWith(`${tab.to}/`)
        const Icon = tab.icon
        return (
          <Link key={tab.to} to={tab.to} className={`tab-bar-item ${active ? 'tab-bar-item-active' : ''}`}>
            <Icon size={24} stroke={active ? 2 : 1.75} />
            <span>{tab.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
