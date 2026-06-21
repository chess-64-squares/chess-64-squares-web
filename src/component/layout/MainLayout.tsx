import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import type { User } from '../../types'

export function MainLayout({ token, user, onLogout }: { token: string; user: User | null; onLogout: () => void }) {
  const navigate = useNavigate()

  return (
    <main className="app-shell">
      <aside className="side-nav">
        <button className="brand vertical" onClick={() => navigate(token ? '/play' : '/login')} type="button">
          <span className="brand-mark">64</span>
          <span>Chess 64 Squares</span>
        </button>

        <nav className="nav-actions vertical" aria-label="Primary">
          {token ? (
            <>
              <NavLink className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')} to="/play">Play</NavLink>
              <NavLink className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')} to="/profile">Profile</NavLink>
              {user && <span className="nav-user">{user.username}</span>}
              <button className="button tertiary small" onClick={onLogout}>Sign out</button>
            </>
          ) : (
            <>
              <NavLink className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')} to="/login">Sign in</NavLink>
              <NavLink className="button primary small" to="/register">Register</NavLink>
            </>
          )}
        </nav>
      </aside>
      <section className="app-content">
        <Outlet />
      </section>
    </main>
  )
}
