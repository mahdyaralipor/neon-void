import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// self-hosted fonts (no Google Fonts dependency — works offline / behind filters)
import '@fontsource/vazirmatn/arabic-400.css'
import '@fontsource/vazirmatn/latin-400.css'
import '@fontsource/vazirmatn/arabic-500.css'
import '@fontsource/vazirmatn/latin-500.css'
import '@fontsource/vazirmatn/arabic-700.css'
import '@fontsource/vazirmatn/latin-700.css'
import '@fontsource/vazirmatn/arabic-800.css'
import '@fontsource/vazirmatn/latin-800.css'
import '@fontsource/vazirmatn/arabic-900.css'
import '@fontsource/vazirmatn/latin-900.css'
import '@fontsource/orbitron/500.css'
import '@fontsource/orbitron/700.css'
import '@fontsource/orbitron/900.css'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
