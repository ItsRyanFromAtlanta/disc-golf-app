import { Link } from 'react-router-dom'
import { IconChevronRight } from '@tabler/icons-react'

export default function ModeCard({ to, icon: Icon, title, description }) {
  return (
    <Link to={to} className="mode-card">
      <span className="mode-card-icon">
        <Icon size={24} stroke={1.75} />
      </span>
      <span className="mode-card-body">
        <span className="mode-card-title">{title}</span>
        <span className="mode-card-description">{description}</span>
      </span>
      <IconChevronRight size={20} stroke={1.75} className="mode-card-chevron" />
    </Link>
  )
}
