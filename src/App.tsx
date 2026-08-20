import { useEffect, useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { initCloud } from './lib/cloud'
import { loadFoodIndex } from './lib/db'
import type { FoodIndex } from './lib/parser'
import Today from './pages/Today'
import LogPage from './pages/Log'
import Chat from './pages/Chat'
import MyFoods from './pages/MyFoods'
import Agenda from './pages/Agenda'
import SettingsPage from './pages/Settings'
import Guide from './pages/Guide'

const tabsLinks = [
  { to: '/', label: 'Vandaag', icon: <path d="M12 3l9 8h-2v9h-5v-6H10v6H5v-9H3z" /> },
  { to: '/chat', label: 'Chat', icon: <path d="M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H8l-5 4V5a1 1 0 0 1 1-1zm3 5h10v2H7zm0-3h10v2H7z" /> }
]

const tabsRechts = [
  { to: '/agenda', label: 'Agenda', icon: <path d="M7 2v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2zM5 9h14v11H5zm3 3v2h3v-2zm5 0v2h3v-2zm-5 4v2h3v-2z" /> },
  { to: '/instellingen', label: 'Doelen', icon: <path d="M4 6h10v2H4zm12 0h4v2h-4zM4 11h4v2H4zm6 0h10v2H10zM4 16h13v2H4zm15 0h1v2h-1zM14 4v6h2V4zm-6 5v6h2V9zm9 5v6h2v-6z" /> }
]

export default function App() {
  const [index, setIndex] = useState<FoodIndex | null>(null)

  useEffect(() => {
    loadFoodIndex().then(setIndex)
    void initCloud()
  }, [])

  return (
    <>
      <Routes>
        <Route path="/" element={<Today />} />
        <Route path="/log" element={<LogPage index={index} />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/producten" element={<MyFoods />} />
        <Route path="/agenda" element={<Agenda />} />
        <Route path="/historie" element={<Agenda />} />
        <Route path="/instellingen" element={<SettingsPage />} />
        <Route path="/uitleg" element={<Guide />} />
      </Routes>
      <nav className="tabbar" aria-label="Hoofdmenu">
        {tabsLinks.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'} className={({ isActive }) => (isActive ? 'actief' : '')}>
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{t.icon}</svg>
            {t.label}
          </NavLink>
        ))}
        <NavLink to="/log" className="tab-fab" aria-label="Eten loggen met je stem">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2a4 4 0 0 1 4 4v5a4 4 0 1 1-8 0V6a4 4 0 0 1 4-4zm-7 9h2a5 5 0 0 0 10 0h2a7 7 0 0 1-6 6.9V21h-2v-3.1A7 7 0 0 1 5 11z" />
          </svg>
        </NavLink>
        {tabsRechts.map((t) => (
          <NavLink key={t.to} to={t.to} className={({ isActive }) => (isActive ? 'actief' : '')}>
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{t.icon}</svg>
            {t.label}
          </NavLink>
        ))}
      </nav>
    </>
  )
}
