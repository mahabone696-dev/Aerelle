import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Copy, Download, QrCode, Store } from 'lucide-react'
import { usePlatform, useStore } from '../lib/store'
import { activePackages, credits, hasUsedTrial, paymentReference, purchase, quote, type PackageOption, type PaymentMethod } from '../lib/model'
import { fmtDate, money, plural } from '../lib/format'
import { navigate } from '../lib/router'

export function Packs() {
  const { state, user, apply } = useStore()
  const [promo, setPromo] = useState('')
  const [selected, setSelected] = useState<PackageOption | null>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  // "Buy packages" in the menu jumps past your own packages to the catalogue.
  const jumpToBuy = window.location.hash.includes('view=buy')
  useEffect(() => {
    if (jumpToBuy) document.getElementById('buy')?.scrollIntoView({ block: 'start' })
  }, [jumpToBuy])
  // Visitors who haven't signed in can browse the catalogue; buying asks them to sign in first.
  const cur = state.studio.currency
  const mine = user ? activePackages(state, user.id) : []
  const past = user ? state.memberPackages.filter((p) => p.userId === user.id && !mine.includes(p)) : []
  const usedTrial = user ? hasUsedTrial(state, user.id) : false
  const visible = state.packageOptions.filter((p) => !p.hidden && !(p.trial && usedTrial))
  const groups = [...new Set(visible.map((p) => (p.recurring ? 'Memberships' : p.groups.join(' + '))))]
  const unpaidAll = user ? state.orders.filter((o) => o.userId === user.id && !o.paid) : []
  const awaiting = unpaidAll.filter((o) => o.method === 'DuitNow')
  const unpaid = unpaidAll.filter((o) => o.method !== 'DuitNow')

  let preview: ReturnType<typeof quote> | null = null
  let promoError = ''
  if (selected) {
    try {
      preview = quote(state, selected.id, promo)
    } catch (e) {
      promoError = (e as Error).message
      preview = quote(state, selected.id)
    }
  }

  return (
    <section>
      <header className="page-head">
        <h1>Packages</h1>
        <p className="muted">Packages give you credits for certain class types, valid for a set time after purchase. Each class shows how many credits it uses.</p>
      </header>
      {msg && <p className={`${msg.kind} banner`} role="status">{msg.text}</p>}
      {unpaid.length > 0 && (
        <p className="error banner">
          You have {plural(unpaid.length, 'unpaid package')} ({money(cur, unpaid.reduce((n, o) => n + o.net, 0))}). Please settle
          it at the front desk.
        </p>
      )}
      {awaiting.length > 0 && (
        <p className="info banner">
          {plural(awaiting.length, 'DuitNow payment')} ({money(cur, awaiting.reduce((n, o) => n + o.net, 0))}) waiting for{' '}
          {state.studio.name} to confirm. You can keep booking meanwhile.
        </p>
      )}

      {user && <h2>My packages</h2>}
      {!user ? null : mine.length === 0 ? (
        <p className="empty">No active packages. Pick one below to start booking.</p>
      ) : (
        <ul className="rows">
          {mine.map((p) => (
            <li key={p.id} className="card row">
              <div>
                <strong>{p.name}</strong>
                <p className="muted small">{p.groups.join(', ')} · expires {fmtDate(p.expiresAt)}</p>
              </div>
              <div className="meter" aria-label={`${p.remaining} of ${p.total} credits left`}>
                <span style={{ width: `${(p.remaining / p.total) * 100}%` }} />
              </div>
              <strong>{p.remaining}/{p.total} credits left</strong>
            </li>
          ))}
        </ul>
      )}

      <span id="buy" className="anchor" />
      {groups.map((g) => (
        <div key={g}>
          <h2>{g === 'Memberships' ? 'Monthly memberships' : `${g} packages`}</h2>
          <ul className="packs">
            {visible
              .filter((p) => (p.recurring ? 'Memberships' : p.groups.join(' + ')) === g)
              .map((p) => (
                <li key={p.id} className={`card pack ${selected?.id === p.id ? 'selected' : ''}`}>
                  {p.trial && <span className="badge waitlisted">Trial · one per member</span>}
                  <h3>{p.name}</h3>
                  <p className="price">{money(cur, p.price)}{p.recurring && <span className="small muted"> /month</span>}</p>
                  <p className="muted small">
                    {credits(p.classes)} · valid {validity(p.validDays)}
                    {p.classes > 1 && ` · ${money(cur, Math.round(p.price / p.classes))} per credit`}
                  </p>
                  <button
                    className="btn primary block"
                    onClick={() => {
                      if (!user) return navigate(`/login?next=${encodeURIComponent(`/s/${state.studio.slug}/credits`)}`)
                      setSelected(p)
                      setMsg(null)
                    }}
                  >
                    {p.recurring ? 'Join' : 'Buy'}
                  </button>
                </li>
              ))}
          </ul>
        </div>
      ))}

      {user && selected && preview && createPortal(
        <Checkout
          option={selected}
          preview={preview}
          promo={promo}
          promoError={promoError}
          setPromo={setPromo}
          onClose={() => setSelected(null)}
          onBuy={(method, reference) => {
            const err = apply((s) => purchase(s, user.id, selected.id, { promo: promoError ? '' : promo, paid: false, method, reference }))
            setMsg(
              err
                ? { kind: 'error', text: err }
                : {
                    kind: 'ok',
                    text: method === 'DuitNow'
                      ? `${selected.name} is ready to use. ${state.studio.name} will confirm your DuitNow payment (reference ${reference}) once it reaches their bank.`
                      : `${selected.name} is ready to use. Please pay at the studio on your next visit.`,
                  },
            )
            if (!err) { setSelected(null); setPromo('') }
          }}
        />,
        document.body,
      )}

      {past.length > 0 && (
        <>
          <h2>Used or expired</h2>
          <ul className="rows">
            {past.map((p) => (
              <li key={p.id} className="card row muted">
                <span>{p.name}</span>
                <span className="small">{p.remaining ? `${credits(p.remaining)} unused · expired ${fmtDate(p.expiresAt)}` : 'Fully used'}</span>
                <span />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

type Quote = ReturnType<typeof quote>

function Checkout({ option, preview, promo, promoError, setPromo, onClose, onBuy }: {
  option: PackageOption
  preview: Quote
  promo: string
  promoError: string
  setPromo: (v: string) => void
  onClose: () => void
  onBuy: (method: PaymentMethod, reference?: string) => void
}) {
  const { state } = useStore()
  const { loadPaymentQr } = usePlatform()
  const cur = state.studio.currency
  const offered = !!state.studio.duitnowEnabled && preview.net > 0
  const [qr, setQr] = useState<string | null | undefined>(offered ? undefined : null)
  const [method, setMethod] = useState<'duitnow' | 'studio'>('duitnow')
  const [step, setStep] = useState<'review' | 'pay'>('review')
  const [reference] = useState(() => paymentReference(state.studio.name))
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!offered) return
    let live = true
    loadPaymentQr(state.studio.id).then((q) => live && setQr(q))
    return () => { live = false }
    // Load once per checkout.
  }, [offered, state.studio.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const duitnow = offered && !!qr
  const choice = duitnow ? method : 'studio'
  const amount = money(cur, preview.net)

  if (step === 'pay' && duitnow) {
    return (
      <div className="sheet" role="dialog" aria-label="Pay by DuitNow" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="card checkout duitnow-pay">
          <h3>Pay {amount} by DuitNow</h3>
          <img src={qr!} alt={`DuitNow QR for ${state.studio.duitnowName || state.studio.name}`} className="duitnow-qr" />
          <dl className="totals">
            <dt>Pay to</dt><dd><strong>{state.studio.duitnowName || state.studio.name}</strong></dd>
            <dt>Amount</dt><dd><strong>{amount}</strong></dd>
            <dt>Reference</dt>
            <dd>
              <button
                type="button"
                className="ref-copy"
                onClick={() => navigator.clipboard?.writeText(reference).then(() => setCopied(true), () => {})}
                aria-label={`Copy reference ${reference}`}
              >
                <strong>{reference}</strong> {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </dd>
          </dl>
          <ol className="pay-steps small">
            <li>Open your banking or e-wallet app and scan the QR (or save it and pick it from your photos).</li>
            <li>Check the name shows <strong>{state.studio.duitnowName || state.studio.name}</strong>, enter exactly <strong>{amount}</strong> and put <strong>{reference}</strong> as the reference.</li>
            <li>Once the transfer goes through, tap the button below.</li>
          </ol>
          <div className="actions">
            <button className="btn primary" onClick={() => onBuy('DuitNow', reference)}>I've paid {amount}</button>
            <a className="btn ghost" href={qr!} download={`duitnow-${state.studio.slug}.${qr!.startsWith('data:image/jpeg') ? 'jpg' : 'png'}`}><Download size={16} /> Save QR</a>
          </div>
          <p className="muted tiny">
            You can book with the package straight away. {state.studio.name} confirms the payment when it reaches their bank.
            Aerelle doesn't handle the money.
          </p>
          <button className="link small" onClick={() => setStep('review')}>Back</button>
        </div>
      </div>
    )
  }

  return (
    <div className="sheet" role="dialog" aria-label="Checkout" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card checkout">
        <h3>{option.name}</h3>
        <label>
          Promo code
          <input value={promo} onChange={(e) => setPromo(e.target.value)} placeholder="Optional" />
        </label>
        {promoError && promo && <p className="error small">{promoError}</p>}
        <dl className="totals">
          <dt>Price</dt><dd>{money(cur, preview.price)}</dd>
          {preview.discount > 0 && (<><dt>Discount ({preview.promo})</dt><dd>-{money(cur, preview.discount)}</dd></>)}
          <dt><strong>Total</strong></dt><dd><strong>{amount}</strong></dd>
        </dl>
        {offered && qr === undefined && <p className="muted tiny">Loading payment options…</p>}
        {duitnow && (
          <div className="pay-options" role="radiogroup" aria-label="Payment method">
            <button type="button" role="radio" aria-checked={choice === 'duitnow'} className={`pay-option ${choice === 'duitnow' ? 'on' : ''}`} onClick={() => setMethod('duitnow')}>
              <QrCode size={20} />
              <span><strong>DuitNow QR</strong><span className="muted tiny">Pay now with any Malaysian bank or e-wallet app</span></span>
            </button>
            <button type="button" role="radio" aria-checked={choice === 'studio'} className={`pay-option ${choice === 'studio' ? 'on' : ''}`} onClick={() => setMethod('studio')}>
              <Store size={20} />
              <span><strong>Pay at studio</strong><span className="muted tiny">Settle at the front desk on your next visit</span></span>
            </button>
          </div>
        )}
        {choice === 'studio' && (
          <p className="muted tiny">You can book with this package straight away. Pay at the studio on your next visit; it shows as unpaid until then.</p>
        )}
        <div className="actions">
          {choice === 'duitnow' ? (
            <button className="btn primary" onClick={() => setStep('pay')}><QrCode size={16} /> Pay {amount} by DuitNow</button>
          ) : (
            <button className="btn primary" disabled={offered && qr === undefined} onClick={() => onBuy('Pay at studio')}>
              Get package · pay {amount} at studio
            </button>
          )}
          <button className="btn ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

export function validity(days: number) {
  if (days % 365 === 0) return plural(days / 365, 'year')
  if (days % 30 === 0) return plural(days / 30, 'month')
  if (days % 7 === 0) return plural(days / 7, 'week')
  return plural(days, 'day')
}
