import { Link, useLocation } from 'react-router-dom'
import { IconBriefcase, IconChartBar, IconTargetArrow, IconUserCircle } from '@tabler/icons-react'
import { resolveActiveTab } from '../lib/navigation'

// App-level bottom tab bar. Adding a feature area (Rounds, Caddie) later is
// a one-line addition here — no other wiring needed. Active state matches by
// path prefix so nested routes (e.g. /practice/history) keep their tab lit —
// STATS lives nested under PLAY's own /practice prefix, so resolveActiveTab
// (longest-prefix match) is what keeps the two from both lighting up together
// on /practice/stats.
const TABS = [
  { to: '/practice', label: 'Play', icon: IconTargetArrow },
  { to: '/bag', label: 'Bags', icon: IconBriefcase },
  { to: '/practice/stats', label: 'Stats', icon: IconChartBar },
  { to: '/profile', label: 'Pro', icon: IconUserCircle },
]

export default function TabBar() {
  const { pathname } = useLocation()
  const activeTab = resolveActiveTab(TABS, pathname)

  return (
    <nav className="tab-bar">
      {TABS.map((tab) => {
        const active = tab === activeTab
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
