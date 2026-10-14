import { useEffect, useState, type FormEvent } from 'react'
import { applyActionCode, checkActionCode, confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth'
import { CheckCircle2, KeyRound, MailCheck, XCircle } from 'lucide-react'
import { auth } from '../lib/firebase'
import type { Route } from '../lib/router'
import { Logo } from '../ui'

type State =
  | { kind: 'working' }
  | { kind: 'reset'; email: string }
  | { kind: 'done'; title: string; text: string }
  | { kind: 'error'; text: string }

/**
 * Where the links in Aerelle's emails land (verify email, reset password, undo an email change),
 * instead of Firebase's default page.
 */
export function AuthAction({ route }: { route: Route }) {
  const mode = route.query.get('mode')
  const code = route.query.get('oobCode') ?? ''
  const [state, setState] = useState<State>({ kind: 'working' })
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!code) return setState({ kind: 'error', text: 'This link is incomplete. Open the latest email from Aerelle and tap the button again.' })
    const expired = 'This link has expired or was already used. Request a new one and use the newest email.'
    if (mode === 'verifyEmail') {
      applyActionCode(auth, code)
        .then(async () => {
          await auth.currentUser?.reload().catch(() => {})
          await auth.currentUser?.getIdToken(true).catch(() => {})
          // The app rechecks verification when the window gains focus; nudge it now so the reminder banner goes.
          window.dispatchEvent(new Event('focus'))
          setState({ kind: 'done', title: 'Email confirmed', text: 'Thanks! Your email is confirmed, and any bookings or packages a studio set up for you are now linked to your account.' })
        })
        .catch(() => setState({ kind: 'error', text: expired }))
    } else if (mode === 'resetPassword') {
      verifyPasswordResetCode(auth, code).then((email) => setState({ kind: 'reset', email })).catch(() => setState({ kind: 'error', text: expired }))
    } else if (mode === 'recoverEmail') {
      checkActionCode(auth, code)
        .then((info) => applyActionCode(auth, code).then(() => info))
        .then((info) => setState({ kind: 'done', title: 'Email restored', text: `Your sign-in email is back to ${info.data.email}. For safety, reset your password too.` }))
        .catch(() => setState({ kind: 'error', text: expired }))
    } else {
      setState({ kind: 'error', text: "We don't recognise this link." })
    }
  }, [mode, code])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 8) return setError('Use at least 8 characters.')
    setBusy(true)
    setError('')
    try {
      await confirmPasswordReset(auth, code, password)
      setState({ kind: 'done', title: 'Password updated', text: 'Your new password is set. Sign in with it to book your classes.' })
    } catch {
      setError('This link has expired or was already used. Request a new one from the sign-in page.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-action">
      <a className="brand brand-lg" href="#/"><Logo size={40} /> Aerelle</a>
      <div className="card auth-action-card">
        {state.kind === 'working' && (
          <>
            <span className="spinner" />
            <p className="muted">One moment…</p>
          </>
        )}
        {state.kind === 'reset' && (
          <form onSubmit={submit} className="auth-action-form">
            <span className="auth-action-icon"><KeyRound size={26} /></span>
            <h1>Choose a new password</h1>
            <p className="muted">For <strong>{state.email}</strong></p>
            <label>
              New password
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} required autoFocus />
            </label>
            {error && <p className="error" role="alert">{error}</p>}
            <button className="btn primary block" disabled={busy}>{busy ? 'Saving…' : 'Save new password'}</button>
          </form>
        )}
        {state.kind === 'done' && (
          <>
            <span className="auth-action-icon ok">{mode === 'verifyEmail' ? <MailCheck size={26} /> : <CheckCircle2 size={26} />}</span>
            <h1>{state.title}</h1>
            <p className="muted">{state.text}</p>
            <a className="btn primary block" href={auth.currentUser ? '#/find' : '#/login'}>{auth.currentUser ? 'Continue' : 'Sign in'}</a>
          </>
        )}
        {state.kind === 'error' && (
          <>
            <span className="auth-action-icon bad"><XCircle size={26} /></span>
            <h1>Link not valid</h1>
            <p className="muted">{state.text}</p>
            <a className="btn primary block" href="#/login">Go to sign in</a>
          </>
        )}
      </div>
    </div>
  )
}
