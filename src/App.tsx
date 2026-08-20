import { useEffect, useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { loadFoodIndex } from './lib/db'
import type { FoodIndex } from './lib/parser'
import Today from './pages/Today'
import LogPage from './pages/Log'
import Chat from './pages/Chat'
import MyFoods from './pages/MyFoods'
import History from './pages/History'
import SettingsPage from './pages/Settings'
import Guide from './pages/Guide'

const tabs = [
  { to: '/', label: 'Vandaag', icon: <path d="M12 3l9 8h-2v9h-5v-6H10v6H5v-9H3z" /> },
  { to: '/chat', label: 'Chat', icon: <path d="M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H8l-5 4V5a1 1 0 0 1 1-1zm3 5h10v2H7zm0-3h10v2H7z" /> },
  { to: '/historie', label: 'Historie', icon: <path d="M12 4a8 8 0 1 1-8 8H2l3.5-4L9 12H6a6 6 0 1 0 6-6zm-1 3h2v5l4 2.4-1 1.7-5-3z" /> },
  { to: '/instellingen', label: 'Doelen', icon: <path d="M4 6h10v2H4zm12 0h4v2h-4zM4 11h4v2H4zm6 0h10v2H10zM4 16h13v2H4zm15 0h1v2h-1zM14 4v6h2V4zm-6 5v6h2V9zm9 5v6h2v-6z" /> },
  { to: '/uitleg', label: 'Uitleg', icon: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-2h2zm1.6-6.1c-.5.5-1 .9-1.3 1.4-.2.4-.3.8-.3 1.7h-2c0-1.2.2-1.9.6-2.5.4-.6 1-1.1 1.5-1.6.4-.4.7-.8.7-1.4 0-.9-.7-1.5-1.8-1.5s-1.9.7-2 1.8H8c.1-2.2 1.7-3.8 4-3.8 2.2 0 3.8 1.3 3.8 3.3 0 1.1-.5 1.9-1.2 2.6z" /> }
]

export default function App() {
  const [index, setIndex] = useState<FoodIndex | null>(null)

  useEffect(() => {
    loadFoodIndex().then(setIndex)
  }, [])

  return (
    <>
      <Routes>
        <Route path="/" element={<Today />} />
        <Route path="/log" element={<LogPage index={index} />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/producten" element={<MyFoods />} />
        <Route path="/historie" element={<History />} />
        <Route path="/instellingen" element={<SettingsPage />} />
        <Route path="/uitleg" element={<Guide />} />
      </Routes>
      <nav className="tabbar" aria-label="Hoofdmenu">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'} className={({ isActive }) => (isActive ? 'actief' : '')}>
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{t.icon}</svg>
            {t.label}
          </NavLink>
        ))}
      </nav>
    </>
  )
}
