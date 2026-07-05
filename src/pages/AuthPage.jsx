import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconBrandApple, IconBrandGoogle } from '@tabler/icons-react'
import { useAuth } from '../context/AuthContext'
import ChipGroup from '../components/ChipGroup'
import OtpInput from '../components/OtpInput'

const ENTRY_METHODS = [
  { id: 'otp', label: '⚡ Email code' },
  { id: 'password', label: '🔑 Password' },
]

const AUTH_MODES = [
  { id: 'login', label: 'Sign In' },
  { id: 'signup', label: 'Create Account' },
]

export default function AuthPage() {
  const {
    isGuest,
    signIn,
    signUp,
    signInWithOtp,
    verifyOtp,
    signInWithOAuth,
    signInAnonymously,
    convertGuestWithOtp,
    verifyGuestConversion,
    linkGuestWithOAuth,
  } = useAuth()
  const navigate = useNavigate()

  const [entryMethod, setEntryMethod] = useState('otp')
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function handlePasswordSubmit(e) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)

    const { data, error } = mode === 'login' ? await signIn(email, password) : await signUp(email, password)
    setSubmitting(false)

    if (error) {
      setError(error.message)
      return
    }
    if (mode === 'signup' && !data.session) {
      setInfo('Check your email to confirm your account, then sign in.')
      setMode('login')
      return
    }
    // Onward routing (including a first-time onboarding bounce) is handled
    // by AppShell's useOnboardingGate — this only needs to land inside it.
    navigate('/practice')
  }

  async function handleSendOtp(e) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)
    const { error } = isGuest ? await convertGuestWithOtp(email) : await signInWithOtp(email)
    setSubmitting(false)
    if (error) {
      setError(error.message)
      return
    }
    setOtpSent(true)
    setInfo(`Code sent to ${email}`)
  }

  async function handleVerifyOtp(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error } = isGuest ? await verifyGuestConversion(email, otp) : await verifyOtp(email, otp)
    setSubmitting(false)
    if (error) {
      setError(error.message)
      return
    }
    navigate('/practice')
  }

  async function handleOAuth(provider) {
    setError(null)
    const { error } = isGuest ? await linkGuestWithOAuth(provider) : await signInWithOAuth(provider)
    // On success Supabase redirects the whole page to the provider — there's
    // nothing else to do here except surface a failure to start the flow.
    if (error) setError(error.message)
  }

  async function handleGuest() {
    const { error } = await signInAnonymously()
    navigate(error ? '/login' : '/onboarding')
  }

  return (
    <section className="auth-page">
      <h1>{isGuest ? 'Save Your Progress' : 'Account'}</h1>
      {isGuest && (
        <p className="form-info">
          You're playing as a guest. Add an email or connect Apple/Google to keep your progress across devices.
        </p>
      )}

      {!isGuest && (
        <ChipGroup
          options={AUTH_MODES}
          getKey={(o) => o.id}
          getLabel={(o) => o.label}
          isActive={(o) => o.id === mode}
          onSelect={(o) => {
            setMode(o.id)
            setError(null)
            setInfo(null)
          }}
        />
      )}

      <ChipGroup
        options={ENTRY_METHODS}
        getKey={(o) => o.id}
        getLabel={(o) => o.label}
        isActive={(o) => o.id === entryMethod}
        onSelect={(o) => {
          setEntryMethod(o.id)
          setError(null)
          setInfo(null)
          setOtpSent(false)
        }}
      />

      {entryMethod === 'password' ? (
        <form onSubmit={handlePasswordSubmit}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />

          {error && <p className="form-error">{error}</p>}
          {info && <p className="form-info">{info}</p>}

          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      ) : (
        <form onSubmit={otpSent ? handleVerifyOtp : handleSendOtp} className="otp-form">
          <label htmlFor="otp-email">Email</label>
          <input
            id="otp-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={otpSent}
            autoComplete="email"
          />

          {otpSent && (
            <>
              <span className="editor-label">Enter the 6-digit code</span>
              <OtpInput value={otp} onChange={setOtp} />
            </>
          )}

          {error && <p className="form-error">{error}</p>}
          {info && <p className="form-info">{info}</p>}

          <label className="offline-guarantee-check">
            <input type="checkbox" checked disabled readOnly />
            Keep me signed in offline (365-day guarantee)
          </label>

          <button
            type="submit"
            className="btn-primary"
            disabled={submitting || (otpSent && otp.length < 6)}
          >
            {submitting ? 'Please wait...' : otpSent ? 'Verify & Continue' : 'Send Code'}
          </button>
          {otpSent && (
            <button type="button" className="link-button" onClick={() => setOtpSent(false)}>
              Use a different email
            </button>
          )}
        </form>
      )}

      <div className="sso-row">
        <button type="button" className="sso-button" onClick={() => handleOAuth('apple')}>
          <IconBrandApple size={20} stroke={1.75} />
          Apple
        </button>
        <button type="button" className="sso-button" onClick={() => handleOAuth('google')}>
          <IconBrandGoogle size={20} stroke={1.75} />
          Google
        </button>
      </div>

      {!isGuest && (
        <button type="button" className="link-button" onClick={handleGuest}>
          Play instantly as guest — save progress later
        </button>
      )}
    </section>
  )
}
