import { useState, type FormEvent } from 'react'
import { Bike, Dumbbell, Flower2, Layers, Music2, Shield, Sparkles, Waves } from 'lucide-react'
import { usePlatform } from '../lib/store'
import { TEMPLATES, uniqueSlug, type Template } from '../lib/platform'
import { navigate } from '../lib/router'
import { PlatformHeader } from './Directory'

const ICONS: Record<Template, typeof Layers> = { yoga: Flower2, pilates: Layers, fitness: Dumbbell, dance: Music2, martial: Shield, cycling: Bike, swim: Waves, blank: Sparkles }

export function NewStudio() {
  const { platform, createStudio } = usePlatform()
  const [form, setForm] = useState({ name: '', location: '', currency: 'RM', cancelHours: 12, description: '', template: 'yoga' as Template })
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))
  const slug = form.name.trim() ? uniqueSlug(platform, form.name) : 'your-studio'

  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    const { slug: created, error: err } = await createStudio(form)
    setBusy(false)
    if (err) return setError(err)
    navigate(`/s/${created}/overview`)
  }

  return (
    <div className="platform">
      <PlatformHeader />
      <main className="platform-content narrow">
        <header className="page-head">
          <h1>Create your studio</h1>
          <p className="muted">You'll be the owner. You can change everything later in Settings.</p>
        </header>
        <form className="card form-card" onSubmit={submit}>
          <fieldset className="templates">
            <legend>What kind of studio?</legend>
            {(Object.keys(TEMPLATES) as Template[]).map((t) => {
              const Icon = ICONS[t]
              return (
                <label key={t} className={`template ${form.template === t ? 'on' : ''}`}>
                  <input type="radio" name="template" value={t} checked={form.template === t} onChange={() => set('template', t)} />
                  <Icon size={20} />
                  <strong>{TEMPLATES[t].label}</strong>
                  <span className="muted tiny">{TEMPLATES[t].types.map(([n]) => n).join(', ')}</span>
                </label>
              )
            })}
          </fieldset>
          <div className="form-grid">
            <label className="span2">Studio name<input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Harbour Movement Studio" required /></label>
            <label>Location<input value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="e.g. Bangsar, KL" required /></label>
            <label>Currency<input value={form.currency} onChange={(e) => set('currency', e.target.value)} maxLength={4} /></label>
            <label>
              Free cancellation (hours before class)
              <input type="number" min={0} max={168} value={form.cancelHours} onChange={(e) => set('cancelHours', +e.target.value)} />
            </label>
            <label className="full">Short description<textarea rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="What members can expect" /></label>
          </div>
          <p className="muted small">
            Your booking link: <span className="mono">{location.origin}{location.pathname}#/s/{slug}/schedule</span>
          </p>
          <p className="muted tiny">We'll add starter class types and packages for this kind of studio. Edit or remove them any time.</p>
          {error && <p className="error">{error}</p>}
          <div className="actions">
            <button className="btn primary" disabled={busy}>{busy ? 'Creating…' : 'Create studio'}</button>
            <a className="btn ghost" href="#/studios">Cancel</a>
          </div>
        </form>
      </main>
    </div>
  )
}
