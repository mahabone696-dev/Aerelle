import { useEffect, useState, type ComponentType, type ReactNode } from 'react'
import {
  BarChart3, Bell, CalendarDays, CalendarCheck, ChevronDown, LayoutDashboard, LogOut, Menu, Package, RotateCcw,
  Search, Settings as SettingsIcon, Star, Ticket, Users, X,
} from 'lucide-react'
import { useStore } from './lib/store'
import { averageRating, canRate, classesLeft } from './lib/model'
import { navigate, safeNext, useRoute, type Route } from './lib/router'
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
import { initials, Logo } from './ui'

const PUBLIC = new Set(['/login', '/signup'])
const PATHS = {
  owner: new Set(['/overview', '/schedule', '/members', '/packages', '/reports', '/rating', '/settings']),
  member: new Set(['/schedule', '/bookings', '/rating', '/credits']),
}

interface Tab {
  path: string
  label: string
  icon: ComponentType<{ size?: number }>
  badge?: string | number
  render: () => ReactNode
}

export function App() {
  const route = useRoute()
  const { user } = useStore()
  const isPublic = PUBLIC.has(route.path)
  const home = user?.role === 'owner' ? '/overview' : '/schedule'

  // Protected pages bounce to "/login?next=..." and come back after signing in.
  useEffect(() => {
    if (!user && !isPublic) {
      const query = route.query.toString()
      const next = route.path === '/' ? '' : `?next=${encodeURIComponent(route.path + (query ? `?${query}` : ''))}`
      navigate(`/login${next}`)
    } else if (user && isPublic) {
      navigate(safeNext(route.query.get('next'), home))
    } else if (user && !PATHS[user.role].has(route.path)) {
      // Unknown page, or one that belongs to the other role (e.g. a member link opened by the owner).
      navigate(home)
    }
  }, [user, route, isPublic, home])

  if (!user || isPublic) return <Login route={route} />
  return user.role === 'owner' ? <AdminShell route={route} /> : <MemberShell route={route} />
}

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
          <a className="brand" href="#/overview">
            <Logo size={34} />
            <span className="brand-text">
              <span className="brand-name">{state.studio.name}</span>
              <span className="brand-sub">{state.studio.location}</span>
            </span>
          </a>
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
            <a className="btn primary hide-sm" href="#/schedule?add=1"><CalendarCheck size={16} /> Add class</a>
            <Alerts />
            <UserMenu />
          </div>
        </header>
        <main className="admin-content" key={route.path}>
          {current?.render()}
        </main>
      </div>
    </div>
  )
}

function NavItem({ tab, active }: { tab: Tab; active: boolean }) {
  const Icon = tab.icon
  return (
    <a href={`#${tab.path}`} className="nav-item" aria-current={active ? 'page' : undefined}>
      <Icon size={18} />
      <span>{tab.label}</span>
      {tab.badge !== undefined && <span className="nav-badge"><Star size={11} /> {tab.badge}</span>}
    </a>
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
        placeholder="Search members by name, email or phone"
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
      href: '#/members?tab=unpaid',
      title: plural(unpaid.length, 'unpaid package'),
      text: `${money(state.studio.currency, unpaid.reduce((n, o) => n + o.net, 0))} outstanding`,
    },
    reviews.length > 0 && { href: '#/rating', title: `${plural(reviews.length, 'new review')} this week`, text: 'See what members said' },
    low.length > 0 && { href: '#/rating', title: `${plural(low.length, 'review')} of 3★ or less`, text: 'Worth a follow-up' },
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

function UserMenu() {
  const { user, logout, resetDemo } = useStore()
  if (!user) return null
  return (
    <details className="dropdown">
      <summary className="user-chip" aria-label="Account">
        <span className="avatar">{initials(user.name)}</span>
        <span className="hide-sm">
          <strong className="small block">{user.name}</strong>
          <span className="muted tiny">{user.role === 'owner' ? 'Owner' : 'Member'}</span>
        </span>
        <ChevronDown size={16} className="hide-sm" />
      </summary>
      <div className="dropdown-menu card">
        <p className="dropdown-title">{user.email}</p>
        <button className="menu-item" onClick={() => confirm('Reset all demo data?') && resetDemo()}>
          <RotateCcw size={16} /> Reset demo data
        </button>
        <button className="menu-item" onClick={logout}><LogOut size={16} /> Sign out</button>
      </div>
    </details>
  )
}

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
          <a className="brand" href="#/schedule">
            <Logo size={32} />
            <span className="brand-text">
              <span className="brand-name">{state.studio.name}</span>
              <span className="brand-sub">{state.studio.location}</span>
            </span>
          </a>
          <nav aria-label="Main" className="member-nav">
            {tabs.map((t) => {
              const Icon = t.icon
              return (
                <a key={t.path} href={`#${t.path}`} aria-current={route.path === t.path ? 'page' : undefined}>
                  <Icon size={17} />
                  <span>{t.label}</span>
                  {!!t.badge && <span className="count">{t.badge}</span>}
                </a>
              )
            })}
          </nav>
          <div className="header-actions">
            <a className="credits" href="#/credits" title="Classes left across your active packages">
              <Ticket size={15} /> {plural(classesLeft(state, user.id), 'class', 'classes')} left
            </a>
            <UserMenu />
          </div>
        </div>
      </header>
      <main className="member-content" key={route.path}>
        {current?.render()}
      </main>
    </div>
  )
}
