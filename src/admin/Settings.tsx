import { useEffect, useState, type FormEvent } from 'react'
import { Megaphone } from 'lucide-react'
import { usePlatform, useStore } from '../lib/store'
import { BookingError, credits, groupsOf, newId, setClassTypeCredits, type Staff, type Studio } from '../lib/model'

export function Settings() {
  return (
    <section>
      <header className="page-head">
        <h1>Settings</h1>
      </header>
      <StudioForm />
      <BannerSettings />
      <DuitNowSettings />
      <ClassTypes />
      <StaffList />
    </section>
  )
}

function StudioForm() {
  const { state, apply } = useStore()
  const [form, setForm] = useState<Studio>(state.studio)
  const [saved, setSaved] = useState<string | null>(null)
  const set = <K extends keyof Studio>(k: K, v: Studio[K]) => { setForm((f) => ({ ...f, [k]: v })); setSaved(null) }
  function submit(e: FormEvent) {
    e.preventDefault()
    setSaved(
      apply((s) => {
        if (!form.name.trim()) throw new BookingError('Studio name is required.')
        if (form.cancelHours < 0 || form.cancelHours > 168) throw new BookingError('Cancellation window must be 0–168 hours.')
        // DuitNow settings are saved by their own section, so keep whatever is current for them.
        const { duitnowEnabled: _on, duitnowName: _name, ...details } = form
        return { ...s, studio: { ...s.studio, ...details, name: form.name.trim() } }
      }) ?? 'Saved.',
    )
  }
  const bookingLink = `${location.origin}${location.pathname}#/s/${state.studio.slug}/schedule`
  const [copied, setCopied] = useState(false)
  return (
    <>
      <h2>Booking link</h2>
      <div className="card link-card">
        <p className="muted small">Share this with members. It opens your schedule; new people sign up and join {state.studio.name} in one step.</p>
        <div className="copy-row">
          <input readOnly value={bookingLink} aria-label="Booking link" onFocus={(e) => e.currentTarget.select()} />
          <button
            type="button"
            className="btn"
            onClick={() => {
              navigator.clipboard?.writeText(bookingLink).then(() => setCopied(true), () => setCopied(false))
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <h2>Studio details</h2>
      <form className="card form-grid" onSubmit={submit}>
        <label>Studio name<input value={form.name} onChange={(e) => set('name', e.target.value)} /></label>
        <label>Location<input value={form.location} onChange={(e) => set('location', e.target.value)} /></label>
        <label>Email<input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></label>
        <label>Phone<input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} /></label>
        <label>Currency<input value={form.currency} onChange={(e) => set('currency', e.target.value)} maxLength={4} /></label>
        <label>
          Cancellation window (hours)
          <input type="number" min={0} max={168} value={form.cancelHours} onChange={(e) => set('cancelHours', +e.target.value)} />
        </label>
        <label className="full">
          Description
          <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={2} />
        </label>
        <p className="muted tiny full">Cancelling at least this many hours before class returns the credits to the member's package. Later cancellations keep them.</p>
        <div className="full actions">
          <button className="btn primary">Save</button>
          {saved && <span className={saved === 'Saved.' ? 'muted small' : 'error small'}>{saved}</span>}
        </div>
      </form>
    </>
  )
}

/** Shrinks an uploaded QR picture to at most 800px and returns it as a data URL small enough to store. */
export function compressQr(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, 800 / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Could not read that image.'))
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      // PNG keeps a plain QR crisp; a busy screenshot is smaller as JPEG.
      let out = canvas.toDataURL('image/png')
      for (const q of [0.92, 0.85, 0.75]) if (out.length > 600_000) out = canvas.toDataURL('image/jpeg', q)
      if (out.length > 690_000) return reject(new Error('That image is too large. Crop it to just the QR code and try again.'))
      resolve(out)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('That file is not an image.'))
    }
    img.src = url
  })
}

/**
 * DuitNow QR payments. The studio uploads the QR its bank gave it; members pay to it at checkout and the
 * studio confirms each payment once it shows in its bank account. Aerelle never handles the money.
 */
/** A short notice the studio can show at the top of its public booking page (holiday hours, a promo, etc.). */
function BannerSettings() {
  const { state, apply } = useStore()
  const [text, setText] = useState(state.studio.bannerText ?? '')
  const [active, setActive] = useState(!!state.studio.bannerActive)
  const [saved, setSaved] = useState<string | null>(null)
  function save(e: FormEvent) {
    e.preventDefault()
    const on = active && !!text.trim()
    setSaved(apply((s) => ({ ...s, studio: { ...s.studio, bannerText: text.trim(), bannerActive: on } })) ?? (on ? 'Banner is showing on your booking page.' : 'Saved. Banner is hidden.'))
  }
  return (
    <>
      <h2>Announcement banner</h2>
      <p className="muted small">Show a short notice at the top of your booking page — a holiday closure, a new class, or an offer.</p>
      <form className="card form-grid" onSubmit={save}>
        <label className="full">
          Message
          <input value={text} maxLength={160} onChange={(e) => { setText(e.target.value); setSaved(null) }} placeholder="e.g. Closed 25 Dec. Happy holidays!" />
        </label>
        {text.trim() && (
          <div className="full studio-banner preview"><Megaphone size={16} /> <span>{text}</span></div>
        )}
        <label className="check full">
          <input type="checkbox" checked={active} onChange={(e) => { setActive(e.target.checked); setSaved(null) }} />
          Show it on my booking page
        </label>
        <div className="full actions">
          <button className="btn primary">Save banner</button>
          {saved && <span className="muted small" role="status">{saved}</span>}
        </div>
      </form>
    </>
  )
}

function DuitNowSettings() {
  const { state, apply } = useStore()
  const { loadPaymentQr, savePaymentQr } = usePlatform()
  const sid = state.studio.id
  const [qr, setQr] = useState<string | null | undefined>(undefined)
  const [enabled, setEnabled] = useState(!!state.studio.duitnowEnabled)
  const [name, setName] = useState(state.studio.duitnowName ?? '')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let live = true
    loadPaymentQr(sid).then((q) => live && setQr(q))
    return () => { live = false }
  }, [sid, loadPaymentQr])

  async function upload(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setMsg(null)
    try {
      const data = await compressQr(file)
      const err = await savePaymentQr(sid, data)
      if (err) setMsg({ ok: false, text: err })
      else {
        setQr(data)
        setMsg({ ok: true, text: 'QR code saved.' })
      }
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message })
    }
    setBusy(false)
  }

  async function remove() {
    setBusy(true)
    const err = await savePaymentQr(sid, null)
    setBusy(false)
    if (err) return setMsg({ ok: false, text: err })
    setQr(null)
    if (enabled) save(false)
    setMsg({ ok: true, text: 'QR code removed. DuitNow is off until you upload a new one.' })
  }

  function save(on = enabled, e?: FormEvent) {
    e?.preventDefault()
    if (on && !qr) return setMsg({ ok: false, text: 'Upload your DuitNow QR first.' })
    if (on && !name.trim()) return setMsg({ ok: false, text: 'Enter the account name members will see in their bank app.' })
    setEnabled(on)
    const err = apply((s) => {
      // Written explicitly (not left out) so turning it off is saved too.
      return { ...s, studio: { ...s.studio, duitnowEnabled: on, duitnowName: name.trim() } }
    })
    setMsg(err ? { ok: false, text: err } : { ok: true, text: on ? 'DuitNow is on. Members can pay by QR at checkout.' : 'Saved. DuitNow is off.' })
  }

  return (
    <>
      <h2>DuitNow QR payments</h2>
      <p className="muted small">
        Let members pay for packages with any Malaysian banking or e-wallet app. Money goes straight to your bank account;
        Aerelle never holds it and charges nothing for it. You confirm each payment on the Overview page once it arrives.
      </p>
      <form className="card form-grid duitnow-settings" onSubmit={(e) => save(enabled, e)}>
        <div className="duitnow-qr-box">
          {qr === undefined ? (
            <span className="muted small">Loading…</span>
          ) : qr ? (
            <img src={qr} alt="Your DuitNow QR code" className="duitnow-qr" />
          ) : (
            <span className="muted small">No QR code yet</span>
          )}
        </div>
        <div className="duitnow-fields">
          <p className="muted tiny">
            Use the static DuitNow QR from your bank's business or merchant app (Maybank, CIMB, Public Bank, RHB, etc.).
            A screenshot is fine.
          </p>
          <div className="actions">
            <label className={`btn ${busy ? 'disabled' : ''}`}>
              {qr ? 'Replace QR' : 'Upload QR'}
              <input type="file" accept="image/*" hidden disabled={busy} onChange={(e) => { upload(e.target.files?.[0]); e.target.value = '' }} />
            </label>
            {qr && <button type="button" className="btn ghost" onClick={remove} disabled={busy}>Remove</button>}
          </div>
          <label>
            Account name shown in bank apps
            <input value={name} onChange={(e) => { setName(e.target.value); setMsg(null) }} placeholder={`e.g. ${state.studio.name.toUpperCase()} SDN BHD`} />
          </label>
          <label className="check">
            <input type="checkbox" checked={enabled} onChange={(e) => { setEnabled(e.target.checked); setMsg(null) }} />
            Offer DuitNow at checkout
          </label>
          <div className="actions">
            <button className="btn primary" disabled={busy}>Save DuitNow settings</button>
            {msg && <span className={msg.ok ? 'muted small' : 'error small'} role="status">{msg.text}</span>}
          </div>
        </div>
      </form>
    </>
  )
}

function ClassTypes() {
  const { state, apply } = useStore()
  const [name, setName] = useState('')
  const [group, setGroup] = useState(groupsOf(state)[0] ?? 'Mat')
  const [newGroup, setNewGroup] = useState('')
  const [creditMsg, setCreditMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const groups = groupsOf(state)
  return (
    <>
      <h2>Class types</h2>
      <p className="muted small">
        Each class type belongs to a group. Packages unlock groups, so a Reformer pack can't be used for a Mat class.
        Set how many credits each type uses: changing it updates that type's upcoming classes, and people already booked keep what they paid.
      </p>
      {creditMsg && <p className={`${creditMsg.ok ? 'ok' : 'error'} banner`} role="status">{creditMsg.text}</p>}
      <form
        className="card form-grid"
        onSubmit={(e) => {
          e.preventDefault()
          const g = (group === '__new' ? newGroup : group).trim()
          setError(
            apply((s) => {
              if (!name.trim() || !g) throw new BookingError('Enter a class name and group.')
              if (s.classTypes.some((c) => c.name.toLowerCase() === name.trim().toLowerCase())) throw new BookingError('That class type exists.')
              return { ...s, classTypes: [...s.classTypes, { id: newId(), name: name.trim(), group: g }] }
            }),
          )
          setName('')
        }}
      >
        <label className="span2">Class name<input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label>
          Group
          <select value={group} onChange={(e) => setGroup(e.target.value)}>
            {groups.map((g) => <option key={g}>{g}</option>)}
            <option value="__new">New group…</option>
          </select>
        </label>
        {group === '__new' && <label>New group<input value={newGroup} onChange={(e) => setNewGroup(e.target.value)} /></label>}
        <div className="actions end"><button className="btn primary">Add class type</button></div>
        {error && <p className="error full">{error}</p>}
      </form>
      {groups.map((g) => (
        <div key={g} className="card type-group">
          <strong>{g}</strong>
          <ul className="chips">
            {state.classTypes.filter((c) => c.group === g).map((c) => {
              const used = state.sessions.some((s) => s.title === c.name && new Date(s.start) > new Date())
              return (
                <li key={c.id} className="chip static type-chip">
                  {c.name}
                  <select
                    className="credit-select"
                    aria-label={`Credits for ${c.name}`}
                    value={c.credits ?? 1}
                    onChange={(e) => {
                      const n = +e.target.value
                      const upcoming = state.sessions.filter((s) => s.title === c.name && new Date(s.start) > new Date() && s.cost !== n).length
                      const err = apply((s) => setClassTypeCredits(s, c.id, n))
                      setCreditMsg(err
                        ? { ok: false, text: err }
                        : { ok: true, text: `${c.name} now uses ${credits(n)}${upcoming ? `; ${upcoming} upcoming ${upcoming === 1 ? 'class' : 'classes'} updated` : ''}.` })
                    }}
                  >
                    {Array.from({ length: 11 }, (_, n) => <option key={n} value={n}>{n === 0 ? 'Free' : credits(n)}</option>)}
                  </select>
                  <button
                    className="link"
                    aria-label={`Remove ${c.name}`}
                    title={used ? 'Has upcoming classes' : 'Remove'}
                    disabled={used}
                    onClick={() => apply((s) => ({ ...s, classTypes: s.classTypes.filter((x) => x.id !== c.id) }))}
                  >
                    ×
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </>
  )
}

function StaffList() {
  const { state, apply } = useStore()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Staff['role']>('Instructor')
  const [error, setError] = useState<string | null>(null)
  const update = (id: string, patch: Partial<Staff>) =>
    apply((s) => ({ ...s, staff: s.staff.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))
  return (
    <>
      <h2>Staff</h2>
      <form
        className="card form-grid"
        onSubmit={(e) => {
          e.preventDefault()
          setError(
            apply((s) => {
              if (!name.trim()) throw new BookingError('Enter a name.')
              return { ...s, staff: [...s.staff, { id: newId(), name: name.trim(), email: email.trim(), role, showOnSite: role === 'Instructor' }] }
            }),
          )
          setName('')
          setEmail('')
        }}
      >
        <label>Name<input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>
          Role
          <select value={role} onChange={(e) => setRole(e.target.value as Staff['role'])}>
            <option>Instructor</option><option>Front desk</option><option>Manager</option>
          </select>
        </label>
        <div className="actions end"><button className="btn primary">Add staff</button></div>
        {error && <p className="error full">{error}</p>}
      </form>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Name</th><th className="hide-sm">Email</th><th>Role</th><th>On booking page</th><th className="num">Upcoming classes</th><th /></tr></thead>
          <tbody>
            {state.staff.map((st) => {
              const upcoming = state.sessions.filter((s) => s.instructor === st.name && new Date(s.start) > new Date()).length
              return (
                <tr key={st.id}>
                  <td><strong>{st.name}</strong></td>
                  <td className="hide-sm">{st.email || '–'}</td>
                  <td>
                    <select value={st.role} onChange={(e) => update(st.id, { role: e.target.value as Staff['role'] })}>
                      <option>Instructor</option><option>Front desk</option><option>Manager</option>
                    </select>
                  </td>
                  <td><input type="checkbox" checked={st.showOnSite} onChange={(e) => update(st.id, { showOnSite: e.target.checked })} aria-label={`Show ${st.name} on booking page`} /></td>
                  <td className="num">{upcoming}</td>
                  <td>
                    <button
                      className="link danger-text"
                      disabled={upcoming > 0}
                      title={upcoming ? 'Reassign their upcoming classes first' : 'Remove'}
                      onClick={() => confirm(`Remove ${st.name}?`) && apply((s) => ({ ...s, staff: s.staff.filter((x) => x.id !== st.id) }))}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
