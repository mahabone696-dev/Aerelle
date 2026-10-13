import { useState, type FormEvent } from 'react'
import { ArrowRight, BarChart3, CalendarDays, CalendarCheck, Search, Ticket, Users } from 'lucide-react'
import { usePlatform } from '../lib/store'
import { studioBySlug } from '../lib/platform'
import { safeNext, type Route } from '../lib/router'
import { LazyScene } from '../three/LazyScene'
import { initials, Logo } from '../ui'

/** Studios (owners and staff) sign in at /studio/login; students who book classes at /login. */
export const isStudioAuth = (path: string) => path.startsWith('/studio/')

const COPY = {
  studio: {
    badge: 'For studios',
    title: <>Run your studio. <span className="grad">Fill every class.</span></>,
    tag: 'Your timetable, bookings, packages, check-ins and reports in one place, for yoga, Pilates, dance, martial arts, gyms and more.',
    points: [[CalendarDays, 'Timetable and waitlists'], [Users, 'Members and check-in'], [BarChart3, 'Sales and payroll reports']] as const,
    login: 'Studio sign in',
    signup: 'Create your studio account',
    signupTab: 'New studio',
    switchText: 'Here to book a class?',
    switchLink: 'Student sign in',
  },
  member: {
    badge: 'For students',
    title: <>Book your next class. <span className="grad">In seconds.</span></>,
    tag: 'See live spots, book or join a waitlist, and keep track of your packages at every studio you love.',
    points: [[Search, 'Browse studios'], [CalendarCheck, 'Book and cancel any time'], [Ticket, 'Packages and classes left']] as const,
    login: 'Welcome back',
    signup: 'Create your account',
    signupTab: 'Create account',
    switchText: 'Run a studio?',
    switchLink: 'Studio sign in',
  },
}

export function Login({ route }: { route: Route }) {
  const { platform, login, signup, resetPassword, mode: storeMode } = usePlatform()
  const audience = isStudioAuth(route.path) ? 'studio' : 'member'
  const copy = COPY[audience]
  const [info, setInfo] = useState<string | null>(null)
  const [mode, setMode] = useState<'login' | 'signup'>(route.path.endsWith('/signup') ? 'signup' : 'login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState('')
  const nextParam = route.query.get('next')
  const next = safeNext(nextParam, '/studios')
  // Arriving from a studio's booking link: show that studio's name.
  const slug = next.match(/^\/s\/([^/?]+)/)?.[1]
  const studio = slug ? studioBySlug(platform, decodeURIComponent(slug))?.studio : undefined

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setStage(mode === 'login' ? 'Signing you in…' : 'Creating your account…')
    const err = mode === 'login' ? await login(email, password) : await signup(name, email, password)
    setError(err)
    // On success the app shell sees the signed-in user and moves on once their studios have loaded,
    // which can take a few seconds; keep the button showing progress until then.
    if (err) setBusy(false)
    else setStage('Signing you in…')
  }

  const fillDemo = (who: 'member' | 'owner') => {
    setMode('login')
    setEmail(`${who}@aerelle.test`)
    setPassword('demo1234')
    setError(null)
  }

  return (
    <div className={`auth auth-${audience}`}>
      <LazyScene variant="hero" />
      <div className="auth-copy">
        <div>
          <a className="brand brand-lg" href="#/"><Logo size={44} /> Aerelle</a>
        </div>
        <h1 className="display">{copy.title}</h1>
        <p className="auth-tag">{copy.tag}</p>
        <ul className="auth-points">
          {copy.points.map(([Icon, text]) => (
            <li key={text}><Icon size={15} /> {text}</li>
          ))}
        </ul>
      </div>
      <form className="card glass auth-card" onSubmit={submit}>
        <span className="audience-badge">{copy.badge}</span>
        <h2 className="flush">{mode === 'login' ? copy.login : copy.signup}</h2>
        <div className="seg" role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => setMode('login')}>
            Sign in
          </button>
          <button type="button" role="tab" aria-selected={mode === 'signup'} onClick={() => setMode('signup')}>
            {copy.signupTab}
          </button>
        </div>
        {studio ? (
          <p className="continue-to">
            <span className="studio-mark">{initials(studio.name)}</span>
            <span>Continue to <strong>{studio.name}</strong><span className="muted tiny block">{studio.location}</span></span>
          </p>
        ) : (
          nextParam && <p className="muted small">Sign in to continue to {pageName(next)}.</p>
        )}
        {mode === 'signup' && (
          <label>
            {audience === 'studio' ? 'Your name' : 'Name'}
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
          {busy ? (
            <>
              <span className="spinner sm" aria-hidden="true" /> {stage}
            </>
          ) : mode === 'login' ? (
            'Sign in'
          ) : (
            'Create account'
          )}
        </button>
        {mode === 'login' && (
          <button
            type="button"
            className="link small forgot"
            onClick={async () => {
              if (!email.trim()) return setError('Enter your email above, then tap “Forgot password?” again.')
              const err = await resetPassword(email)
              setError(err)
              setInfo(err ? null : `If ${email.trim()} has an account, a link to set a new password is on its way.`)
            }}
          >
            {audience === 'studio' ? 'Forgot password?' : 'Forgot password? First time here after your studio added you?'}
          </button>
        )}
        {info && <p className="ok banner" role="status">{info}</p>}
        {storeMode === 'demo' && (
          <div className="demo">
            <span className="muted small">Try the demo:</span>
            <button type="button" className="link" onClick={() => fillDemo(audience === 'studio' ? 'owner' : 'member')}>
              {audience === 'studio' ? 'Studio owner' : 'Member'}
            </button>
          </div>
        )}
        <p className="auth-switch">
          {copy.switchText}{' '}
          <a href={`#${audience === 'studio' ? '/login' : '/studio/login'}`}>{copy.switchLink} <ArrowRight size={14} /></a>
        </p>
      </form>
    </div>
  )
}

const PAGE_NAMES: Record<string, string> = {
  overview: 'the overview', schedule: 'the schedule', bookings: 'your bookings', rating: 'ratings', credits: 'packages',
  members: 'members', packages: 'packages', reports: 'reports', settings: 'settings', 'new-studio': 'create a studio', studios: 'studios',
}

/** "/members?tab=all" -> "members" */
const pageName = (path: string) => {
  const page = path.replace(/^\/s\/[^/]+/, '').slice(1).split('?')[0]
  return PAGE_NAMES[page] ?? 'your page'
}
