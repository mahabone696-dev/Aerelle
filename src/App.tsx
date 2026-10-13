import { useEffect, useState, type ComponentType, type ReactNode } from 'react'
import {
  BarChart3, Bell, CalendarDays, CalendarCheck, Check, ChevronDown, ChevronsUpDown, Compass, LayoutDashboard, LogOut, Menu,
  Package, Plus, RotateCcw, Search, Settings as SettingsIcon, Star, Ticket, Users, X,
} from 'lucide-react'
import { StudioScope, usePlatform, useStore } from './lib/store'
import { averageRating, canRate, classesLeft, type Role } from './lib/model'
import { homeFor, roleIn, studioBySlug, studiosFor } from './lib/platform'
import { link, navigate, safeNext, setStudioBase, useRoute, type Route } from './lib/router'
import { money, plural } from './lib/format'
import { Login } from './pages/Login'
import { Schedule } from './pages/Schedule'
import { Bookings } from './pages/Bookings'
import { Rating } from './pages/Rating'
import { Packs } from './pages/Packs'
import { Overview } from './admin/Overview'
import { Manage } from './admin/Manage'
import { Members } from './admin/Members'
import { PackagesAdmin } from './admin/PackagesAdmin'
import { Reports } from './admin/Reports'
import { Reviews } from './admin/Reviews'
import { Settings } from './admin/Settings'
import { Directory } from './platform/Directory'
import { NewStudio } from './platform/NewStudio'
import { Landing } from './platform/Landing'
import { initials, Logo } from './ui'

const PATHS: Record<Role, Set<string>> = {
  owner: new Set(['/overview', '/schedule', '/members', '/packages', '/reports', '/rating', '/settings']),
  member: new Set(['/schedule', '/bookings', '/rating', '/credits']),
}
/** Pages anyone can open without signing in, like a studio's public booking page. */
const PUBLIC_PATHS = new Set(['/schedule', '/credits'])
const studioHome = (slug: string, role: Role) => `/s/${slug}${role === 'owner' ? '/overview' : '/schedule'}`

interface Tab {
  path: string
  label: string
  icon: ComponentType<{ size?: number }>
  badge?: string | number
  render: () => ReactNode
}

export function App() {
  const route = useRoute()
  const { platform, account, joinStudio, ready, setActiveStudio, activeReady } = usePlatform()
  setStudioBase(route.studio)
  const studio = route.studio ? studioBySlug(platform, route.studio) : undefined
  const role = account && studio ? roleIn(studio, account.id) : null
  const home = account ? homeFor(platform, account.id) : '/studios'
  const isLogin = route.full === '/login' || route.full === '/signup'
  const studioId = studio?.studio.id ?? null
  useEffect(() => setActiveStudio(studioId), [studioId, setActiveStudio])

  useEffect(() => {
    if (!ready) return
    if (isLogin) {
      if (account) navigate(safeNext(route.query.get('next'), home))
    } else if (route.studio) {
      const query = route.query.toString()
      if (!studio) navigate('/studios')
      else if (route.path === '/' || route.path === '/classes') navigate(`/s/${studio.studio.slug}/schedule`)
      else if (!account) {
        if (!PUBLIC_PATHS.has(route.path)) navigate(`/login?next=${encodeURIComponent(route.full + (query ? `?${query}` : ''))}`)
      }
      else if (!role) joinStudio(studio.studio.id) // opening a studio you're not in yet makes you a member
      else if (!PATHS[role].has(route.path)) navigate(studioHome(studio.studio.slug, role))
    } else if (route.full === '/new-studio') {
      if (!account) navigate(`/login?next=${encodeURIComponent('/new-studio')}`)
    } else if (route.full !== '/studios' && route.full !== '/') {
      navigate(home)
    }
  }, [route, account, studio, role, home, isLogin, joinStudio, ready])

  return (
    <>
      <Notice />
      {isLogin ? (
        <Login route={route} />
      ) : route.full === '/' ? (
        <Landing />
      ) : !ready || (studio && !activeReady) ? (
        <Loading />
      ) : studio && !account && PUBLIC_PATHS.has(route.path) ? (
        <StudioScope studio={studio}><PublicShell route={route} /></StudioScope>
      ) : studio && role && PATHS[role].has(route.path) ? (
        <StudioScope studio={studio}>{role === 'owner' ? <AdminShell route={route} /> : <MemberShell route={route} />}</StudioScope>
      ) : route.full === '/studios' ? (
        <Directory />
      ) : route.full === '/new-studio' && account ? (
        <NewStudio />
      ) : (
        <Loading /> // redirecting
      )}
    </>
  )
}

function Loading() {
  return (
    <div className="loading" role="status" aria-live="polite">
      <Logo size={40} />
      <span className="spinner" />
      <span className="muted small">Loading…</span>
    </div>
  )
}

/** Banner for saves that fail after the screen already updated (e.g. the last spot was just taken). */
function Notice() {
  const { notice, dismissNotice, account, emailVerified, resendVerification, mode } = usePlatform()
  const [sent, setSent] = useState(false)
  if (notice) {
    return (
      <div className="notice" role="alert">
        <span>{notice}</span>
        <button className="icon-btn" onClick={dismissNotice} aria-label="Dismiss"><X size={16} /></button>
      </div>
    )
  }
  if (mode === 'cloud' && account && !emailVerified) {
    return (
      <div className="notice soft" role="status">
        <span>Check {account.email} for a link to verify your email. Verifying links any bookings and packages a studio already set up for you.</span>
        <button className="btn sm" disabled={sent} onClick={() => resendVerification().then(() => setSent(true))}>{sent ? 'Sent' : 'Resend'}</button>
      </div>
    )
  }
  return null
}

// ---------- Studio owner ----------

function AdminShell({ route }: { route: Route }) {
  const { state } = useStore()
  const [drawer, setDrawer] = useState(false)
  useEffect(() => setDrawer(false), [route.path])
  const rating = averageRating(state)

  const tabs: Tab[] = [
    { path: '/overview', label: 'Overview', icon: LayoutDashboard, render: () => <Overview /> },
    { path: '/schedule', label: 'Schedule', icon: CalendarDays, render: () => <Manage route={route} /> },
    { path: '/members', label: 'Members', icon: Users, render: () => <Members route={route} /> },
    { path: '/packages', label: 'Packages', icon: Package, render: () => <PackagesAdmin /> },
    { path: '/reports', label: 'Reports', icon: BarChart3, render: () => <Reports /> },
    { path: '/rating', label: 'Studio rating', icon: Star, badge: rating ? rating.average.toFixed(1) : undefined, render: () => <Reviews /> },
    { path: '/settings', label: 'Settings', icon: SettingsIcon, render: () => <Settings /> },
  ]
  const current = tabs.find((t) => t.path === route.path)

  return (
    <div className="admin">
      <aside className={`sidebar ${drawer ? 'open' : ''}`} aria-label="Main navigation">
        <div className="sidebar-head">
          <StudioSwitcher />
          <button className="icon-btn only-mobile" onClick={() => setDrawer(false)} aria-label="Close menu"><X size={18} /></button>
        </div>
        <nav>
          <span className="nav-label">Studio</span>
          {tabs.slice(0, 4).map((t) => <NavItem key={t.path} tab={t} active={route.path === t.path} />)}
          <span className="nav-label">Insights</span>
          {tabs.slice(4, 6).map((t) => <NavItem key={t.path} tab={t} active={route.path === t.path} />)}
          <span className="nav-label">Account</span>
          {tabs.slice(6).map((t) => <NavItem key={t.path} tab={t} active={route.path === t.path} />)}
        </nav>
        <div className="sidebar-foot">
          <Logo size={16} /> <span className="tiny muted">Powered by</span> <strong className="tiny">Aerelle</strong>
        </div>
      </aside>
      {drawer && <div className="scrim only-mobile" onClick={() => setDrawer(false)} />}

      <div className="admin-main">
        <header className="admin-header">
          <button className="icon-btn only-mobile" onClick={() => setDrawer(true)} aria-label="Open menu"><Menu size={20} /></button>
          <GlobalSearch />
          <div className="header-actions">
            <a className="btn primary hide-sm" href={link('/schedule?add=1')}><CalendarCheck size={16} /> Add class</a>
            <Alerts />
            <UserMenu role="owner" />
          </div>
        </header>
        <main className="admin-content" key={route.full}>
          {current?.render()}
        </main>
      </div>
    </div>
  )
}

function NavItem({ tab, active }: { tab: Tab; active: boolean }) {
  const Icon = tab.icon
  return (
    <a href={link(tab.path)} className="nav-item" aria-current={active ? 'page' : undefined}>
      <Icon size={18} />
      <span>{tab.label}</span>
      {tab.badge !== undefined && <span className="nav-badge"><Star size={11} /> {tab.badge}</span>}
    </a>
  )
}

/** Shows the current studio; opens a list of the person's other studios. */
function StudioSwitcher() {
  const { platform, account } = usePlatform()
  const { state } = useStore()
  if (!account) return null
  const { owned, joined } = studiosFor(platform, account.id)
  const current = state.studio
  const item = (s: (typeof owned)[number], role: Role) => (
    <a key={s.studio.id} href={`#${studioHome(s.studio.slug, role)}`} className="menu-item switch-item" onClick={(e) => closeDropdown(e.currentTarget)}>
      <span className="studio-mark">{initials(s.studio.name)}</span>
      <span className="switch-text">
        <strong>{s.studio.name}</strong>
        <span className="muted tiny">{s.studio.location}</span>
      </span>
      {s.studio.id === current.id && <Check size={16} className="switch-check" />}
    </a>
  )
  return (
    <details className="dropdown switcher">
      <summary className="switcher-btn" aria-label="Switch studio">
        <span className="studio-mark lg">{initials(current.name)}</span>
        <span className="brand-text">
          <span className="brand-name">{current.name}</span>
          <span className="brand-sub">{current.location}</span>
        </span>
        <ChevronsUpDown size={16} className="muted" />
      </summary>
      <div className="dropdown-menu card switcher-menu">
        {owned.length > 0 && <p className="dropdown-title">Studios you run</p>}
        {owned.map((s) => item(s, 'owner'))}
        {joined.length > 0 && <p className="dropdown-title">Studios you book at</p>}
        {joined.map((s) => item(s, 'member'))}
        <div className="menu-sep" />
        <a className="menu-item" href="#/studios" onClick={(e) => closeDropdown(e.currentTarget)}><Compass size={16} /> Browse studios</a>
        <a className="menu-item" href="#/new-studio" onClick={(e) => closeDropdown(e.currentTarget)}><Plus size={16} /> Create a studio</a>
      </div>
    </details>
  )
}

function GlobalSearch() {
  const { state } = useStore()
  const [q, setQ] = useState('')
  const term = q.trim().toLowerCase()
  const hits = term
    ? state.users
        .filter((u) => u.role === 'member' && [u.name, u.email, u.phone].some((f) => f.toLowerCase().includes(term)))
        .slice(0, 6)
    : []
  const open = (id: string) => {
    setQ('')
    navigate(`/members?tab=all&id=${id}`)
  }
  return (
    <div className="global-search">
      <Search size={16} />
      <input
        type="search"
        placeholder={`Search ${state.studio.name} members`}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && hits[0] && open(hits[0].id)}
        aria-label="Search members"
      />
      {hits.length > 0 && (
        <ul className="search-results card" role="listbox">
          {hits.map((u) => (
            <li key={u.id}>
              <button onClick={() => open(u.id)}>
                <span className="avatar sm">{initials(u.name)}</span>
                <span><strong>{u.name}</strong><span className="muted tiny block">{u.email}</span></span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {term && hits.length === 0 && <div className="search-results card empty-sm">No members match “{q}”.</div>}
    </div>
  )
}

const closeDropdown = (el: Element) => el.closest('details')?.removeAttribute('open')

function Alerts() {
  const { state } = useStore()
  const unpaid = state.orders.filter((o) => !o.paid)
  const weekAgo = Date.now() - 7 * 86_400_000
  const reviews = state.ratings.filter((r) => new Date(r.createdAt).getTime() > weekAgo)
  const low = reviews.filter((r) => r.stars <= 3)
  const items = [
    unpaid.length > 0 && {
      href: link('/members?tab=unpaid'),
      title: plural(unpaid.length, 'unpaid package'),
      text: `${money(state.studio.currency, unpaid.reduce((n, o) => n + o.net, 0))} outstanding`,
    },
    reviews.length > 0 && { href: link('/rating'), title: `${plural(reviews.length, 'new review')} this week`, text: 'See what members said' },
    low.length > 0 && { href: link('/rating'), title: `${plural(low.length, 'review')} of 3★ or less`, text: 'Worth a follow-up' },
  ].filter(Boolean) as { href: string; title: string; text: string }[]

  return (
    <details className="dropdown">
      <summary className="icon-btn" aria-label={`Notifications (${items.length})`}>
        <Bell size={18} />
        {items.length > 0 && <span className="dot" />}
      </summary>
      <div className="dropdown-menu card">
        <p className="dropdown-title">Notifications</p>
        {items.length === 0 ? (
          <p className="muted small">You're all caught up.</p>
        ) : (
          items.map((i) => (
            <a key={i.title} href={i.href} className="alert-item" onClick={(e) => closeDropdown(e.currentTarget)}>
              <strong>{i.title}</strong>
              <span className="muted small">{i.text}</span>
            </a>
          ))
        )}
      </div>
    </details>
  )
}

/** Account menu; `role` is the person's role in the studio being shown, if any. */
export function UserMenu({ role }: { role?: Role }) {
  const { account, logout, resetDemo, mode } = usePlatform()
  if (!account) return <a className="btn primary" href={`#/login?next=${encodeURIComponent(window.location.hash.slice(1) || '/studios')}`}>Sign in</a>
  return (
    <details className="dropdown">
      <summary className="user-chip" aria-label="Account">
        <span className="avatar">{initials(account.name)}</span>
        <span className="hide-sm">
          <strong className="small block">{account.name}</strong>
          <span className="muted tiny">{role === 'owner' ? 'Owner' : role === 'member' ? 'Member' : account.email}</span>
        </span>
        <ChevronDown size={16} className="hide-sm" />
      </summary>
      <div className="dropdown-menu card">
        <p className="dropdown-title">{account.email}</p>
        <a className="menu-item" href="#/studios" onClick={(e) => closeDropdown(e.currentTarget)}><Compass size={16} /> Browse studios</a>
        <a className="menu-item" href="#/new-studio" onClick={(e) => closeDropdown(e.currentTarget)}><Plus size={16} /> Create a studio</a>
        <div className="menu-sep" />
        {mode === 'demo' && (
          <button className="menu-item" onClick={() => confirm('Reset all demo data?') && resetDemo()}>
            <RotateCcw size={16} /> Reset demo data
          </button>
        )}
        <button className="menu-item" onClick={logout}><LogOut size={16} /> Sign out</button>
      </div>
    </details>
  )
}

// ---------- Visitor (not signed in) ----------

/** A studio's public booking page: browse classes and packages; booking or buying asks you to sign in. */
function PublicShell({ route }: { route: Route }) {
  const { state } = useStore()
  const rating = averageRating(state)
  const next = encodeURIComponent(`/s/${state.studio.slug}${route.path}`)
  const tabs: Tab[] = [
    { path: '/schedule', label: 'Classes', icon: CalendarDays, render: () => <Schedule /> },
    { path: '/credits', label: 'Packages', icon: Ticket, render: () => <Packs /> },
  ]
  const current = tabs.find((t) => t.path === route.path)
  return (
    <div className="member public">
      <header className="member-header">
        <div className="member-header-inner">
          <div className="switcher-btn public-brand">
            <span className="studio-mark lg">{initials(state.studio.name)}</span>
            <span className="brand-text">
              <span className="brand-name">{state.studio.name}</span>
              <span className="brand-sub">
                {state.studio.location}
                {rating && <> · <Star size={11} className="star-icon" /> {rating.average.toFixed(1)}</>}
              </span>
            </span>
          </div>
          <nav aria-label="Main" className="member-nav">
            {tabs.map((t) => {
              const Icon = t.icon
              return (
                <a key={t.path} href={link(t.path)} aria-current={route.path === t.path ? 'page' : undefined}>
                  <Icon size={17} />
                  <span>{t.label}</span>
                </a>
              )
            })}
          </nav>
          <div className="header-actions">
            <a className="btn sm" href={`#/login?next=${next}`}>Sign in</a>
            <a className="btn primary sm" href={`#/signup?next=${next}`}>Sign up</a>
          </div>
        </div>
      </header>
      <main className="member-content" key={route.full}>
        {current?.render()}
      </main>
      <footer className="public-foot">
        <a href="#/"><Logo size={18} /> Powered by <strong>Aerelle</strong></a>
      </footer>
    </div>
  )
}

// ---------- Member ----------

function MemberShell({ route }: { route: Route }) {
  const { state, user } = useStore()
  if (!user) return null
  const tabs: Tab[] = [
    { path: '/schedule', label: 'Book a class', icon: CalendarDays, render: () => <Schedule /> },
    { path: '/bookings', label: 'My bookings', icon: CalendarCheck, render: () => <Bookings /> },
    {
      path: '/rating',
      label: 'Rate',
      icon: Star,
      badge: state.sessions.filter((s) => canRate(state, user.id, s)).length || undefined,
      render: () => <Rating route={route} />,
    },
    { path: '/credits', label: 'Packages', icon: Ticket, render: () => <Packs /> },
  ]
  const current = tabs.find((t) => t.path === route.path)

  return (
    <div className="member">
      <header className="member-header">
        <div className="member-header-inner">
          <StudioSwitcher />
          <nav aria-label="Main" className="member-nav">
            {tabs.map((t) => {
              const Icon = t.icon
              return (
                <a key={t.path} href={link(t.path)} aria-current={route.path === t.path ? 'page' : undefined}>
                  <Icon size={17} />
                  <span>{t.label}</span>
                  {!!t.badge && <span className="count">{t.badge}</span>}
                </a>
              )
            })}
          </nav>
          <div className="header-actions">
            <a className="credits" href={link('/credits')} title="Classes left across your active packages at this studio">
              <Ticket size={15} /> {classesLeft(state, user.id)}<span className="hide-sm">&nbsp;{classesLeft(state, user.id) === 1 ? 'class' : 'classes'} left</span>
            </a>
            <UserMenu role="member" />
          </div>
        </div>
      </header>
      <main className="member-content" key={route.full}>
        {current?.render()}
      </main>
    </div>
  )
}
