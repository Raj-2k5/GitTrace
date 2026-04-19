import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { AuthProvider } from './contexts/AuthContext'
import { WatchProvider } from './contexts/WatchContext'
import './index.css'
import App from './App.jsx'
import AuthCallback from './pages/AuthCallback.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <HelmetProvider>
        <BrowserRouter>
          <AuthProvider>
            <WatchProvider>
              <Routes>
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="*" element={<App />} />
              </Routes>
            </WatchProvider>
          </AuthProvider>
        </BrowserRouter>
      </HelmetProvider>
    </ErrorBoundary>
  </StrictMode>,
)
