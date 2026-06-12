import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'

const tariffUrl = `${import.meta.env.BASE_URL}platform-tariffs.json`

function setPlatformTariffs(data) {
  globalThis.__PLATFORM_TARIFFS__ = data
  if (typeof window !== 'undefined') {
    window.__PLATFORM_TARIFFS__ = data
  }
}

async function loadPlatformTariffs() {
  try {
    const response = await fetch(tariffUrl)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    setPlatformTariffs(await response.json())
  } catch (error) {
    console.error('Failed to load platform tariff data:', error)
    setPlatformTariffs(null)
  }
}

async function boot() {
  await loadPlatformTariffs()
  const [{ default: AppShell }, { AuthProvider }] = await Promise.all([
    import('./app/AppShell.jsx'),
    import('./lib/authClient.jsx'),
  ])

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </BrowserRouter>
    </React.StrictMode>,
  )
}

boot()
