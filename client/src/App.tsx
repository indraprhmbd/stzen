import { Routes, Route } from 'react-router-dom'
import { BrandProvider } from './hooks/useBrand'
import Catalog from './pages/Catalog'
import Admin from './pages/Admin'

function App() {
  return (
    <BrandProvider>
      <div className="min-h-screen bg-base-100">
        <Routes>
          <Route path="/" element={<Catalog />} />
          <Route path="/login" element={<div className="flex items-center justify-center min-h-screen"><p>Login coming in Epic 3</p></div>} />
          <Route path="/dashboard" element={<div className="flex items-center justify-center min-h-screen"><p>Dashboard coming in Epic 4</p></div>} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </div>
    </BrandProvider>
  )
}

export default App
