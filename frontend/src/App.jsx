import { useState, useEffect } from 'react'
import Nav from './components/Nav.jsx'
import HomePage from './pages/HomePage.jsx'
import DemoPage from './pages/DemoPage.jsx'
import ArchPage from './pages/ArchPage.jsx'
import DocsPage from './pages/DocsPage.jsx'
import MetricsPage from './pages/MetricsPage.jsx'
import HistoryPage from './pages/HistoryPage.jsx'

const INIT_DEMO = {
  lang: 'cpp',
  sourceCode: null,
  result: null,
  apiMode: false,
  apiUrl: typeof import.meta !== 'undefined'
    ? (import.meta.env?.VITE_API_URL || 'http://localhost:8080')
    : 'http://localhost:8080',
}

export default function App() {
  const [page, setPage] = useState('home')
  const [demoState, setDemoState] = useState(() => {
    try {
      const s = sessionStorage.getItem('nm_demo')
      return s ? { ...INIT_DEMO, ...JSON.parse(s) } : INIT_DEMO
    } catch { return INIT_DEMO }
  })

  useEffect(() => {
    try { sessionStorage.setItem('nm_demo', JSON.stringify(demoState)) } catch {}
  }, [demoState])

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }) }, [page])

  const pages = {
    home:    <HomePage    setPage={setPage} />,
    demo:    <DemoPage    setPage={setPage} demoState={demoState} setDemoState={setDemoState} />,
    arch:    <ArchPage    setPage={setPage} />,
    metrics: <MetricsPage setPage={setPage} apiUrl={demoState.apiUrl} />,
    history: <HistoryPage setPage={setPage} apiUrl={demoState.apiUrl} />,
    docs:    <DocsPage    setPage={setPage} />,
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <Nav page={page} setPage={setPage} />
      <main>{pages[page] || pages.home}</main>
    </div>
  )
}
