import { Navigate, Route, Routes } from 'react-router-dom'
import { CheckinPage } from './pages/CheckinPage'
import { StatsPage } from './pages/StatsPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<CheckinPage />} />
      <Route path="/stats" element={<StatsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
