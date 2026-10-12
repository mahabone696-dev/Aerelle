import { useState, type FormEvent } from 'react'
import { useStore } from '../lib/store'
import { safeNext, type Route } from '../lib/router'
import { LazyScene } from '../three/LazyScene'
import { Logo } from '../ui'

export function Login({ route }: { route: Route }) {
  const { state, login, signup } = useStore()
  const [mode, setMode] = useState<'login' | 'signup'>(route.path === '/signup' ? 'signup' : 'login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const next = safeNext(route.query.get('next'))

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    const err = mode === 'login' ? await login(email, password) : await signup(name, email, password)
    setBusy(false)
    // On success the app shell sees the signed-in user and redirects to ?next=.
    setError(err)
  }

  const fillDemo = (who: 'member' | 'owner') => {
    setMode('login')
    setEmail(`${who}@aerelle.test`)
    setPassword('demo1234')
    setError(null)
  }

  return (
    <div className="auth">
      <LazyScene variant="hero" />
      <div className="auth-copy">
        <div className="brand brand-lg">
          <Logo size={44} /> Aerelle
        </div>
        <h1 className="display">
          Move with <span className="grad">{state.studio.name}</span>
        </h1>
        <p className="auth-tag">Book reformer, mat and private sessions in seconds. Track your packages and tell us how class felt.</p>
        <ul className="auth-points">
          <li>Live spots and waitlists</li>
          <li>Packages and memberships</li>
          <li>{state.studio.cancelHours}h free cancellation</li>
        </ul>
      </div>
      <form className="card glass auth-card" onSubmit={submit}>
        <h2 className="flush">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
        <div className="seg" role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => setMode('login')}>
            Sign in
          </button>
          <button type="button" role="tab" aria-selected={mode === 'signup'} onClick={() => setMode('signup')}>
            Create account
          </button>
        </div>
        {next !== '/schedule' && <p className="muted small">Sign in to continue to {pageName(next)}.</p>}
        {mode === 'signup' && (
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
          </label>
        )}
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
          />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary block" disabled={busy}>
          {mode === 'login' ? 'Sign in' : 'Create account · 1 free class'}
        </button>
        <div className="demo">
          <span className="muted small">Try a demo account:</span>
          <button type="button" className="link" onClick={() => fillDemo('member')}>Member</button>
          <button type="button" className="link" onClick={() => fillDemo('owner')}>Studio owner</button>
        </div>
      </form>
    </div>
  )
}

const PAGE_NAMES: Record<string, string> = {
  overview: 'the overview', schedule: 'the schedule', bookings: 'your bookings', rating: 'ratings', credits: 'packages',
  members: 'members', packages: 'packages', reports: 'reports', settings: 'settings',
}

/** "/members?tab=all" -> "members" */
const pageName = (path: string) => PAGE_NAMES[path.slice(1).split('?')[0]] ?? 'your page'
