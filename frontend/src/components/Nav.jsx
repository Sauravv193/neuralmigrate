import { useState, useEffect } from 'react'

const NAV_ITEMS = [
  { id: 'home',    label: 'Overview' },
  { id: 'demo',    label: 'Live Demo' },
  { id: 'metrics', label: 'Metrics' },
  { id: 'history', label: 'History' },
  { id: 'arch',    label: 'Architecture' },
  { id: 'docs',    label: 'Docs' },
]

export default function Nav({ page, setPage }) {
  const [scrolled,  setScrolled]  = useState(false)
  const [menuOpen,  setMenuOpen]  = useState(false)
  const [mobile,    setMobile]    = useState(window.innerWidth < 900)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    const onResize = () => setMobile(window.innerWidth < 900)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  const go = (p) => { setPage(p); setMenuOpen(false) }

  return (
    <>
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        height: 58, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 24px',
        background: scrolled || menuOpen ? 'rgba(250,247,242,0.96)' : 'transparent',
        backdropFilter: scrolled || menuOpen ? 'blur(18px)' : 'none',
        borderBottom: scrolled || menuOpen ? '1px solid var(--border)' : '1px solid transparent',
        boxShadow: scrolled ? '0 1px 12px rgba(26,22,18,0.06)' : 'none',
        transition: 'all 0.3s ease',
      }}>
        {/* Logo */}
        <div onClick={() => go('home')} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
          <div style={{ width: 28, height: 28, background: 'linear-gradient(135deg, var(--forest) 0%, var(--forest-mid) 100%)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <path d="M3 13L8 3L13 13" stroke="#F5F0E8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4.5 10H11.5" stroke="#F5F0E8" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
            </svg>
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16, color: 'var(--ink)', letterSpacing: '-0.3px' }}>NeuralMigrate</span>
        </div>

        {/* Desktop links */}
        {!mobile && (
          <ul style={{ display: 'flex', alignItems: 'center', gap: 2, listStyle: 'none' }}>
            {NAV_ITEMS.map(({ id, label }) => (
              <li key={id}>
                <button onClick={() => go(id)} style={{
                  padding: '5px 12px', borderRadius: 8, fontSize: 13.5, fontWeight: 500,
                  color: page === id ? 'var(--forest)' : 'var(--ink-soft)',
                  background: page === id ? 'var(--forest-faint2)' : 'transparent',
                  border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)',
                  letterSpacing: '-0.1px', transition: 'all 0.18s',
                }}>{label}</button>
              </li>
            ))}
            <li style={{ marginLeft: 6 }}>
              <button onClick={() => go('demo')} style={{
                padding: '6px 18px', borderRadius: 8, fontSize: 13.5, fontWeight: 600,
                background: 'linear-gradient(135deg, var(--forest) 0%, var(--forest-mid) 100%)',
                color: 'var(--cream)', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-body)', boxShadow: '0 2px 8px rgba(28,58,47,0.25)',
                transition: 'all 0.2s',
              }}>Try it free</button>
            </li>
          </ul>
        )}

        {/* Mobile hamburger */}
        {mobile && (
          <button onClick={() => setMenuOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 22, height: 2, background: 'var(--ink)', borderRadius: 1, transition: 'all 0.2s',
                transform: menuOpen ? (i === 0 ? 'rotate(45deg) translate(5px,5px)' : i === 1 ? 'scaleX(0)' : 'rotate(-45deg) translate(5px,-5px)') : 'none',
                opacity: menuOpen && i === 1 ? 0 : 1,
              }} />
            ))}
          </button>
        )}
      </nav>

      {/* Mobile dropdown */}
      {mobile && menuOpen && (
        <div style={{ position: 'fixed', top: 58, left: 0, right: 0, zIndex: 99, background: 'rgba(250,247,242,0.98)', backdropFilter: 'blur(18px)', borderBottom: '1px solid var(--border)', padding: '12px 16px 20px', boxShadow: 'var(--shadow-md)' }}>
          {NAV_ITEMS.map(({ id, label }) => (
            <button key={id} onClick={() => go(id)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '11px 16px', borderRadius: 10, fontSize: 15, fontWeight: page === id ? 600 : 400, color: page === id ? 'var(--forest)' : 'var(--ink)', background: page === id ? 'var(--forest-faint2)' : 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', marginBottom: 2 }}>
              {label}
            </button>
          ))}
          <button onClick={() => go('demo')} style={{ display: 'block', width: '100%', textAlign: 'center', marginTop: 10, padding: '12px', borderRadius: 10, fontSize: 15, fontWeight: 600, background: 'var(--forest)', color: 'var(--cream)', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
            Try it free
          </button>
        </div>
      )}
    </>
  )
}
