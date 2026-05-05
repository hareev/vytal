import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Dashboard } from './pages/Dashboard'
import { Connect } from './pages/Connect'
import { useVytalStore } from './hooks/useVytalStore'

export default function App() {
  const connected = useVytalStore(s => !!s.connection)

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={connected ? <Navigate to="/dashboard" /> : <Connect />} />
        <Route path="/connect" element={<Connect />} />
        <Route path="/dashboard" element={connected ? <Dashboard /> : <Navigate to="/connect" />} />
      </Routes>
    </BrowserRouter>
  )
}
