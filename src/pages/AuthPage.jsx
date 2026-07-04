import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function AuthPage() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)

    const { data, error } =
      mode === 'login' ? await signIn(email, password) : await signUp(email, password)

    setSubmitting(false)

    if (error) {
      setError(error.message)
      return
    }

    if (mode === 'signup' && !data.session) {
      setInfo('Check your email to confirm your account, then log in.')
      setMode('login')
      return
    }

    navigate('/practice')
  }

  return (
    <section className="auth-page">
      <h1>{mode === 'login' ? 'Log in' : 'Sign up'}</h1>
      <form onSubmit={handleSubmit}>
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

        <button type="submit" disabled={submitting}>
          {submitting ? 'Please wait...' : mode === 'login' ? 'Log in' : 'Sign up'}
        </button>
      </form>

      <button
        type="button"
        className="link-button"
        onClick={() => {
          setMode(mode === 'login' ? 'signup' : 'login')
          setError(null)
          setInfo(null)
        }}
      >
        {mode === 'login' ? "Need an account? Sign up" : 'Already have an account? Log in'}
      </button>
    </section>
  )
}
