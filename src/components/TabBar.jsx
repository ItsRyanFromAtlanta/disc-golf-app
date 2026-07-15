import { Link, useLocation, useNavigate } from 'react-router-dom'
import { IconBriefcase, IconMap2, IconTargetArrow, IconUserCircle } from '@tabler/icons-react'
import { resolveRouteMetadata, resolveSectionRoot } from '../lib/routeMetadata'
import { resolveTabPressAction, TAB_PRESS_ACTIONS } from '../lib/tabNavigation'

const TABS = [
  { section: 'play', label: 'Play', icon: IconTargetArrow },
  { section: 'discs', label: 'Discs', icon: IconBriefcase },
  { section: 'courses', label: 'Courses', icon: IconMap2 },
  { section: 'me', label: 'Me', icon: IconUserCircle },
]

export default function TabBar({ isAtTop, hasRequestedTop, onScrollToTop }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const route = resolveRouteMetadata(pathname)

  function handleTabClick(event, tab) {
    const active = route?.section === tab.section
    const action = resolveTabPressAction({ isTargetActive: active, isAtTop, hasRequestedTop })

    if (action === TAB_PRESS_ACTIONS.NAVIGATE) return

    event.preventDefault()
    if (action === TAB_PRESS_ACTIONS.SCROLL_TO_TOP) {
      onScrollToTop()
      return
    }

    navigate(resolveSectionRoot(tab.section))
  }

  return (
    <nav className="tab-bar" aria-label="Primary navigation">
      {TABS.map((tab) => {
        const active = route?.section === tab.section
        const Icon = tab.icon
        return (
          <Link
            key={tab.section}
            to={resolveSectionRoot(tab.section)}
            className={`tab-bar-item ${active ? 'tab-bar-item-active' : ''}`}
            aria-current={active ? 'page' : undefined}
            onClick={(event) => handleTabClick(event, tab)}
          >
            <Icon size={24} stroke={active ? 2 : 1.75} />
            <span>{tab.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
