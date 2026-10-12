import { useEffect, type ReactNode } from 'react'
import { useStore } from './lib/store'
import { canRate, classesLeft } from './lib/model'
import { navigate, safeNext, useRoute } from './lib/router'
import { plural } from './lib/format'
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
import { LazyScene } from './three/LazyScene'
import { Logo } from './ui'

const PUBLIC = new Set(['/login', '/signup'])
const PATHS = {
  owner: new Set(['/overview', '/schedule', '/members', '/packages', '/reports', '/rating', '/settings']),
  member: new Set(['/schedule', '/bookings', '/rating', '/credits']),
}

interface Tab {
  path: string
  label: string
  count?: number
  render: () => ReactNode
}

export function App() {
  const route = useRoute()
  const { state, user, logout, resetDemo } = useStore()
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

  const tabs: Tab[] =
    user.role === 'owner'
      ? [
          { path: '/overview', label: 'Overview', render: () => <Overview /> },
          { path: '/schedule', label: 'Schedule', render: () => <Manage /> },
          { path: '/members', label: 'Members', render: () => <Members route={route} /> },
          { path: '/packages', label: 'Packages', render: () => <PackagesAdmin /> },
          { path: '/reports', label: 'Reports', render: () => <Reports /> },
          { path: '/rating', label: 'Rating', render: () => <Reviews /> },
          { path: '/settings', label: 'Settings', render: () => <Settings /> },
        ]
      : [
          { path: '/schedule', label: 'Schedule', render: () => <Schedule /> },
          { path: '/bookings', label: 'My bookings', render: () => <Bookings /> },
          {
            path: '/rating',
            label: 'Rate',
            count: state.sessions.filter((s) => canRate(state, user.id, s)).length,
            render: () => <Rating route={route} />,
          },
          { path: '/credits', label: 'Packages', render: () => <Packs /> },
        ]
  const current = tabs.find((t) => t.path === route.path)

  return (
    <div className="shell">
      <LazyScene variant="ambient" />
      <header className="topbar">
        <a className="brand" href={`#${home}`}>
          <Logo />
          <span className="brand-text">
            <span className="brand-name">{state.studio.name}</span>
            <span className="brand-sub">by Aerelle</span>
          </span>
        </a>
        <nav aria-label="Main">
          {tabs.map((t) => (
            <a key={t.path} href={`#${t.path}`} aria-current={route.path === t.path ? 'page' : undefined}>
              {t.label}
              {!!t.count && <span className="count">{t.count}</span>}
            </a>
          ))}
        </nav>
        <div className="me">
          {user.role === 'member' && (
            <a className="credits" href="#/credits" title="Classes left across your active packages">
              {plural(classesLeft(state, user.id), 'class', 'classes')} left
            </a>
          )}
          <details className="menu">
            <summary aria-label="Account">{user.name.charAt(0)}</summary>
            <div className="card">
              <p><strong>{user.name}</strong></p>
              <p className="muted small">{user.email}</p>
              <button className="link" onClick={logout}>Sign out</button>
              <button className="link muted" onClick={() => confirm('Reset all demo data?') && resetDemo()}>
                Reset demo data
              </button>
            </div>
          </details>
        </div>
      </header>
      <main className={user.role === 'owner' ? 'wide' : ''} key={route.path}>
        {current?.render()}
      </main>
    </div>
  )
}
