import { Link, useNavigate } from 'react-router-dom'
import { IconBolt, IconFlame } from '@tabler/icons-react'
import { useAuth } from '../context/AuthContext'

// Screen 1 (WelcomeLandingView). The social-proof number is static v1 copy,
// not a live aggregate query — see SCREEN_SPECS.md Screen 1.
const SOCIAL_PROOF_TEXT = '142,000+ putts logged this week'

export default function SplashPage() {
  const { signInAnonymously } = useAuth()
  const navigate = useNavigate()

  async function handleGuest() {
    const { error } = await signInAnonymously()
    // Anonymous sign-in failing (rare — usually a disabled provider) should
    // fall back to the normal auth screen rather than dead-end the tap.
    navigate(error ? '/login' : '/onboarding')
  }

  return (
    <section className="splash-page">
      <div className="splash-badge">
        <IconBolt size={14} stroke={2.5} />
        OFFLINE-FIRST ENABLED
      </div>

      <div className="splash-hero">
        <div className="splash-logo" aria-hidden="true">
          🥏
        </div>
        <h1>Disc Golf App</h1>
        <p className="splash-tagline">Elevate your putting &amp; inventory</p>
      </div>

      <div className="splash-bottom-zone">
        <div className="splash-social-proof">
          <IconFlame size={16} stroke={2} />
          {SOCIAL_PROOF_TEXT}
        </div>

        <button type="button" className="btn-primary" onClick={() => navigate('/login')}>
          Get Started
        </button>

        <Link to="/login" className="link-button splash-signin-link">
          Already have an account? Sign in
        </Link>
        <button type="button" className="link-button" onClick={handleGuest}>
          Play instantly as guest — save progress later
        </button>
      </div>
    </section>
  )
}
