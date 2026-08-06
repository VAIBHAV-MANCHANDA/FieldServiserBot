import { NavLink, Route, Routes } from 'react-router-dom'
import './App.css'
import AiAssistantPage from './pages/AiAssistantPage.jsx'
import ChatHistoryPage from './pages/ChatHistoryPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'

const navItems = [
  { label: 'AI Assistant', path: '/', shortcut: 'AI' },
  { label: 'Dashboard', path: '/dashboard', shortcut: 'DB' },
  { label: 'Chat History', path: '/history', shortcut: 'CH' },
]

function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Application sidebar">
        <div className="sidebar__brand">
          <span className="brand-mark" aria-hidden="true">WA</span>
          <div>
            <p className="sidebar__eyebrow">AI Analytics</p>
            <h1 className="sidebar__title">Workforce</h1>
          </div>
        </div>

        <nav className="sidebar__nav" aria-label="Primary">
          {navItems.map((item) => (
            <NavLink
              key={`${item.label}-${item.path}`}
              className={({ isActive }) => isActive ? 'sidebar-link sidebar-link--active' : 'sidebar-link'}
              to={item.path}
            >
              <span className="sidebar-link__icon" aria-hidden="true">{item.shortcut}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
          {/* <button type="button" className="sidebar-link sidebar-link--muted">
            <span className="sidebar-link__icon" aria-hidden="true">RP</span>
            <span>Reports</span>
          </button>
          <button type="button" className="sidebar-link sidebar-link--muted">
            <span className="sidebar-link__icon" aria-hidden="true">ST</span>
            <span>Settings</span>
          </button> */}
        </nav>

        <div className="sidebar__profile">
          <span className="sidebar__avatar" aria-hidden="true">HS</span>
          <div>
            <strong>Analytics User</strong>
            <small>Workforce Admin</small>
          </div>
        </div>
      </aside>

      <div className="app-shell__content">
        <header className="topbar">
          <div>
            <p className="topbar__eyebrow">AI Workforce Analytics C</p>
            <h2 className="topbar__title">Operational intelligence dashboard</h2>
          </div>
          <div className="topbar__status">
            <span className="topbar__status-dot" aria-hidden="true" />
            Live MySQL reports
          </div>
        </header>

        <main className="app-shell__main">
          <Routes>
            <Route element={<AiAssistantPage />} path="/" />
            <Route element={<DashboardPage />} path="/dashboard" />
            <Route element={<ChatHistoryPage />} path="/history" />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default App
