import { useState, type FormEvent } from 'react'
import { ArrowLeft, Check } from 'lucide-react'
import { usePlatform } from '../lib/store'
import { UserMenu } from '../App'
import { initials, Logo } from '../ui'

/** Edit your own name, phone and birthday. Email is your login, so it isn't editable here. */
export function Profile() {
  const { account, saveProfile } = usePlatform()
  const [name, setName] = useState(account?.name ?? '')
  const [phone, setPhone] = useState(account?.phone ?? '')
  const [birthday, setBirthday] = useState(account?.birthday ?? '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  if (!account) return null
  const changed = name.trim() !== account.name || phone.trim() !== (account.phone ?? '') || birthday !== (account.birthday ?? '')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const err = await saveProfile({ name, phone, birthday })
    setBusy(false)
    setMsg(err ? { kind: 'error', text: err } : { kind: 'ok', text: 'Profile saved. Your studios see the new details too.' })
  }

  return (
    <div className="platform profile-page">
      <header className="member-header">
        <div className="member-header-inner">
          <a className="brand" href="#/">
            <Logo size={32} />
            <span className="brand-text"><span className="brand-name">Aerelle</span></span>
          </a>
          <div className="header-actions"><UserMenu role="member" /></div>
        </div>
      </header>
      <main className="platform-content narrow">
        <button className="link back-link" onClick={() => (history.length > 1 ? history.back() : (location.hash = '#/find'))}>
          <ArrowLeft size={16} /> Back
        </button>
        <form className="card profile-card" onSubmit={submit}>
          <div className="profile-head">
            <span className="avatar xl">{initials(name || account.name)}</span>
            <div>
              <h1 className="flush">Edit profile</h1>
              <p className="muted small">Keep your details up to date for the studios you book with.</p>
            </div>
          </div>
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
          </label>
          <label>
            Email
            <input value={account.email} disabled />
            <span className="muted tiny">This is your login, so it can't be changed here.</span>
          </label>
          <label>
            Phone
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="e.g. +60 12-345 6789" />
          </label>
          <label>
            Birthday
            <input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} autoComplete="bday" />
          </label>
          {msg && <p className={`${msg.kind} banner`} role="status">{msg.kind === 'ok' && <Check size={16} />} {msg.text}</p>}
          <button className="btn primary block" disabled={busy || !changed}>{busy ? 'Saving…' : 'Save changes'}</button>
        </form>
      </main>
    </div>
  )
}
