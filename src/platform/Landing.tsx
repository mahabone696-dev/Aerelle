import { useEffect, useState, type ComponentType } from 'react'
import {
  Activity, ArrowRight, ArrowRightLeft, BarChart3, Bell, Bike, CalendarDays, Check, ClipboardCheck, Layers, Link2, ListChecks, ShieldCheck, Wallet,
  Star, Ticket, Users, Waves,
} from 'lucide-react'
import { usePlatform } from '../lib/store'
import { homeFor } from '../lib/platform'
import { LazyScene } from '../three/LazyScene'
import { Logo } from '../ui'

type Icon = ComponentType<{ size?: number }>

/** What sets Aerelle apart. Kept to claims the product actually delivers. */
const PILLARS: [Icon, string, string, string[]][] = [
  [ArrowRightLeft, 'Switch without starting over', 'Coming from another booking platform? We bring your members, packages, bookings and sales history across for you, so day one on Aerelle looks like the day before.', ['Members and their packages', 'Booking and sales history', 'Your timetable and class types']],
  [Wallet, 'Low, simple fees', 'One flat price for your studio, with no commission taken from your classes or packages. Free while we\u2019re in early access.', ['No commission on bookings', 'No contract', 'Free during early access']],
  [ShieldCheck, 'Privacy comes first', 'Your studio isn\u2019t listed in any public directory or marketplace. Only people with your booking link can find you, and your members and sales stay yours.', ['No public studio listing', 'Members see only their own bookings', 'Names never shown on the timetable']],
]

const FEATURES: [Icon, string, string][] = [
  [CalendarDays, 'Scheduling that fills itself', 'Weekly timetables in a few clicks, live spots left, and waitlists that book the next person automatically when someone cancels.'],
  [Ticket, 'Packages, memberships & promos', 'Class packs that expire, monthly memberships, trials limited to one per person, and promo codes with usage caps.'],
  [ClipboardCheck, 'Check-in in seconds', "Mark attendance and no-shows from today's roster on any phone or tablet at the front desk."],
  [Users, 'Know every member', 'Purchases, bookings, attendance, birthdays and unpaid packages, all on one profile with instant search.'],
  [BarChart3, 'Reports you can act on', 'Sales, occupancy, cancellations and instructor payroll for any date range, ready to download as CSV.'],
  [Star, 'Ratings after every class', 'Members rate classes they attended. See your score, star breakdown and comments by class and instructor.'],
  [Link2, 'Your own booking link', 'Share one link on Instagram, WhatsApp or your website. New people sign up and book in one go.'],
  [Layers, 'One login, many studios', 'Run several locations or brands from one account, and let members book across studios they love.'],
]

/** Photo tiles for the main kinds of studio (photos: public/photos, see CREDITS.md). */
const PHOTO_VERTICALS: [string, string, string][] = [
  ['yoga', 'Yoga', 'Flow, hatha, hot and aerial'],
  ['pilates', 'Pilates', 'Mat, reformer and barre'],
  ['dance', 'Dance', 'Kids, adults and competition teams'],
  ['martial-arts', 'Martial arts', 'Belts, grades and kids classes'],
  ['strength', 'HIIT & strength', 'Bootcamps and small groups'],
  ['private-training', 'Private gym classes', 'One-to-one and small-group coaching'],
]

const VERTICALS: [Icon, string][] = [
  [Bike, 'Indoor cycling'],
  [Activity, 'Barre'],
  [Waves, 'Swim schools'],
]

const PAINS: [string, string][] = [
  ['Bookings scattered across DMs and spreadsheets', 'One live timetable members book themselves, 24/7.'],
  ['Chasing who paid and who still owes', 'Packages paid upfront, with unpaid ones flagged automatically.'],
  ['Last-minute cancellations leave empty spots', 'Waitlists move the next member in, and late cancels keep the class.'],
]

const FAQ: [string, string][] = [
  ['What kinds of businesses can use Aerelle?', 'Any business that runs scheduled classes or sessions: yoga, Pilates, dance, martial arts, HIIT, cycling, barre, swim schools and personal training. Start from a template and change class types and packages to fit.'],
  ['Do my members need to download an app?', 'No. Aerelle works in any phone or desktop browser. Members open your booking link, sign up once and book.'],
  ['Can I run more than one studio?', 'Yes. Each studio keeps its own timetable, members, packages and reports, and you switch between them from the sidebar.'],
  ['How do members pay?', 'Today you can sell packages and record payments by card, cash or bank transfer, and track anything unpaid. Online card payments are on the roadmap.'],
  ['Can I bring my existing members?', 'Add members from the Members page, or share your booking link and let them sign up. Their history starts from day one on Aerelle.'],
  ['Can you move my data from my current platform?', 'Yes. We bring your members, their packages, past bookings and sales across from your current booking platform, so you don\u2019t start from zero.'],
  ['How do you protect my studio\u2019s privacy?', 'Studios aren\u2019t listed or searchable anywhere on Aerelle. People reach you only through your own booking link. Your member list and sales are visible only to you, members see only their own bookings, and other people\u2019s names never appear on the timetable.'],
  ['What does it cost?', 'Aerelle is free during early access. After that it\u2019s one low, flat price, with no commission on your bookings or packages and no contract.'],
]

export function Landing() {
  const { platform, account } = usePlatform()
  const dashboard = account ? homeFor(platform, account.id) : null
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

  return (
    <div className="landing">
      <header className={`land-nav ${scrolled ? 'scrolled' : ''}`}>
        <div className="land-wrap land-nav-inner">
          <a className="brand" href="#/">
            <Logo size={32} /> <span className="brand-name">Aerelle</span>
          </a>
          <nav className="land-links" aria-label="Sections">
            <button onClick={() => jump('why')}>Why Aerelle</button>
            <button onClick={() => jump('features')}>Features</button>
            <button onClick={() => jump('who')}>Who it's for</button>
            <button onClick={() => jump('pricing')}>Pricing</button>
            <button onClick={() => jump('faq')}>FAQ</button>
          </nav>
          <div className="actions">
            {dashboard ? (
              <a className="btn primary" href={`#${dashboard}`}>Open dashboard <ArrowRight size={16} /></a>
            ) : (
              <>
                <a className="btn ghost hide-sm" href="#/studio/login">Studio sign in</a>
                <a className="btn primary" href="#/studio/signup">Start free</a>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="land-hero">
        <LazyScene variant="hero" />
        <div className="land-wrap hero-grid">
          <div className="hero-copy">
            <h1 className="display">
              Fill every class. <span className="grad">Keep every member.</span>
            </h1>
            <p className="lead">
              Aerelle runs your timetable, bookings, packages and check-ins, so you spend your time teaching instead of on admin.
            </p>
            <div className="actions">
              <a className="btn primary lg" href="#/new-studio">Create your studio free <ArrowRight size={18} /></a>
              <button className="btn ghost lg" onClick={() => jump('why')}>Why Aerelle</button>
            </div>
            <ul className="hero-ticks">
              <li><Check size={15} /> Free data migration</li>
              <li><Check size={15} /> Low, flat fees</li>
              <li><Check size={15} /> Privacy first</li>
            </ul>
          </div>
          <HeroMock />
        </div>
      </section>

      <section className="land-section why" id="why">
        <div className="land-wrap">
          <p className="kicker">Why Aerelle</p>
          <h2 className="section-title">Easy to switch to. Fair to pay for. Private by design.</h2>
          <div className="pillars">
            {PILLARS.map(([Icon, title, text, points]) => (
              <article key={title} className="card pillar">
                <span className="pillar-icon"><Icon size={22} /></span>
                <h3>{title}</h3>
                <p className="muted">{text}</p>
                <ul>
                  {points.map((x) => <li key={x}><Check size={15} /> {x}</li>)}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="land-section">
        <div className="land-wrap">
          <p className="kicker">Why studios switch</p>
          <h2 className="section-title">You started a studio to teach, not to do paperwork.</h2>
          <div className="pains">
            {PAINS.map(([pain, fix]) => (
              <div key={pain} className="card pain">
                <p className="pain-before">{pain}</p>
                <p className="pain-after"><Check size={16} /> {fix}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="land-section tint">
        <div className="land-wrap split">
          <div className="split-media">
            <img className="photo" src="photos/group-class.webp" alt="A full group fitness class training together in a bright studio" loading="lazy" decoding="async" width="1200" height="900" />
            <div className="card mock-float chip-a"><Users size={16} /> <span><strong>Full class</strong><span className="muted tiny block">3 people on the waitlist</span></span></div>
            <div className="card mock-float chip-b"><Bell size={16} /> <span><strong>Spot opened</strong><span className="muted tiny block">Next on the waitlist is booked in</span></span></div>
          </div>
          <div className="split-copy">
            <p className="kicker left">Fuller classes</p>
            <h2 className="section-title left">Empty spots fill themselves.</h2>
            <p className="lead">When someone cancels, the next person on the waitlist moves in straight away. Late cancels keep the class, so your timetable stays full without you lifting a finger.</p>
            <ul className="split-list">
              <li><Check size={18} /> Live spots left on every class</li>
              <li><Check size={18} /> Automatic waitlists</li>
              <li><Check size={18} /> Cancellation window you control</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="land-section alt" id="features">
        <div className="land-wrap">
          <p className="kicker">Everything in one place</p>
          <h2 className="section-title">The tools a busy studio actually uses</h2>
          <div className="feature-grid">
            {FEATURES.map(([Icon, title, text]) => (
              <article key={title} className="card feature">
                <span className="feature-icon"><Icon size={20} /></span>
                <h3>{title}</h3>
                <p className="muted small">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="land-section" id="who">
        <div className="land-wrap">
          <p className="kicker">Who it's for</p>
          <h2 className="section-title">Built for every kind of class</h2>
          <p className="section-sub muted">Start from a template for your type of studio, then make it yours.</p>
          <div className="photo-tiles">
            {PHOTO_VERTICALS.map(([img, label, sub]) => (
              <a key={label} className="photo-tile" href="#/new-studio">
                <img src={`photos/${img}.webp`} alt="" loading="lazy" decoding="async" width="900" height="640" />
                <span className="photo-tile-text"><strong>{label}</strong><span>{sub}</span></span>
              </a>
            ))}
          </div>
          <div className="vertical-grid">
            {VERTICALS.map(([Icon, label]) => (
              <a key={label} className="card vertical" href="#/new-studio">
                <span className="feature-icon"><Icon size={20} /></span>
                <strong>{label}</strong>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="land-section alt">
        <div className="land-wrap split reverse">
          <div className="split-media">
            <img className="photo" src="photos/calm.webp" alt="A studio owner sitting calmly on a yoga mat" loading="lazy" decoding="async" width="1000" height="1100" />
          </div>
          <div className="split-copy">
          <p className="kicker left">How it works</p>
          <h2 className="section-title left">Live in three steps</h2>
          <ol className="how stacked">
            <li className="card"><span className="step">1</span><h3>Create your studio</h3><p className="muted small">Pick a template. Starter class types and packages are set up for you.</p></li>
            <li className="card"><span className="step">2</span><h3>Add your timetable</h3><p className="muted small">Schedule one-off or weekly classes with capacity, instructor and price in classes.</p></li>
            <li className="card"><span className="step">3</span><h3>Share your link</h3><p className="muted small">Members sign up, buy a package and book. You check them in and watch the reports.</p></li>
          </ol>
          </div>
        </div>
      </section>

      <section className="land-section" id="pricing">
        <div className="land-wrap">
          <p className="kicker">Pricing</p>
          <h2 className="section-title">Simple while we grow</h2>
          <div className="price-card card">
            <div>
              <span className="eyebrow">Early access</span>
              <p className="price-big">Free</p>
              <p className="muted">Every feature, unlimited classes and members. No contract, cancel any time.</p>
              <a className="btn primary lg" href="#/new-studio">Create your studio <ArrowRight size={18} /></a>
            </div>
            <ul className="price-list">
              {['Unlimited classes & members', 'No commission on bookings', 'Free migration from your current platform', 'Private booking link, never listed publicly', 'Packages, memberships & promo codes', 'Reports & CSV export'].map((f) => (
                <li key={f}><Check size={16} /> {f}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="land-section alt" id="faq">
        <div className="land-wrap narrow">
          <p className="kicker">FAQ</p>
          <h2 className="section-title">Questions studio owners ask</h2>
          <div className="faq">
            {FAQ.map(([q, a]) => (
              <details key={q} className="card">
                <summary>{q}</summary>
                <p className="muted">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="land-cta photo-cta" style={{ backgroundImage: 'url(photos/community.webp)' }}>
        <div className="land-wrap cta-inner">
          <h2>Ready to fill your classes?</h2>
          <p>Set up your studio in a few minutes. It's free during early access.</p>
          <div className="actions">
            <a className="btn primary lg" href="#/new-studio">Create your studio <ArrowRight size={18} /></a>
            <a className="btn ghost lg" href="#/studio/login">Studio sign in</a>
          </div>
        </div>
      </section>

      <footer className="land-footer">
        <div className="land-wrap footer-inner">
          <a className="brand" href="#/"><Logo size={24} /> <span className="brand-name">Aerelle</span></a>
          <nav aria-label="Footer">
            <a href="#/new-studio">Create a studio</a>
            <a href="#/studio/login">Studio sign in</a>
            <a href="#/login">Student sign in</a>
          </nav>
          <span className="muted tiny">© {new Date().getFullYear()} Aerelle</span>
        </div>
      </footer>
    </div>
  )
}

/** A small, static picture of the product for the hero. */
function HeroMock() {
  const rows: [string, string, string, number, number][] = [
    ['7:00', 'Vinyasa Flow', 'Yoga', 14, 16],
    ['12:15', 'HIIT Express', 'Conditioning', 18, 18],
    ['18:30', 'Reformer Sculpt', 'Pilates', 5, 8],
    ['19:45', 'Kids Taekwondo', 'Martial arts', 9, 20],
  ]
  return (
    <div className="hero-mock" aria-hidden="true">
      <img className="hero-photo" src="photos/hero.webp" alt="" width="1100" height="1300" fetchPriority="high" />
      <div className="card mock-window">
        <div className="mock-bar"><span /><span /><span /><strong>Today's classes</strong></div>
        <ul>
          {rows.map(([t, name, type, booked, cap]) => (
            <li key={name}>
              <span className="mock-time">{t}</span>
              <span className="mock-name"><strong>{name}</strong><span className="muted tiny">{type}</span></span>
              <span className="mock-fill"><span style={{ width: `${(booked / cap) * 100}%` }} /></span>
              <span className={`badge ${booked >= cap ? 'waitlisted' : ''}`}>{booked >= cap ? 'Full' : `${cap - booked} left`}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="card mock-float one"><ListChecks size={16} /> <span><strong>Waitlist</strong><span className="muted tiny block">Next in line is booked in automatically</span></span></div>
      <div className="card mock-float two"><Star size={16} className="star-icon" /> <span><strong>Class ratings</strong><span className="muted tiny block">Members rate each class they attend</span></span></div>
    </div>
  )
}
