import { useState, useEffect } from 'react'

const MOCK_HISTORY = [
  { id:5, created_at:'2025-01-15T14:55:00Z', file_path:'BubbleSort.cpp',    source_language:'cpp',  status:'validated', confidence_score:0.94, iterations:1, original_complexity:'O(n²)',   optimized_complexity:'O(n log n)', validation_outcome:'pass', source_lines:18, output_lines:24, duration_ms:5820, entities_extracted:2, vector_results:5, graph_results:8, error_count:0 },
  { id:4, created_at:'2025-01-15T14:48:00Z', file_path:'Fibonacci.java',    source_language:'java', status:'validated', confidence_score:0.97, iterations:1, original_complexity:'O(2^n)',  optimized_complexity:'O(n)',      validation_outcome:'pass', source_lines:12, output_lines:20, duration_ms:5340, entities_extracted:1, vector_results:5, graph_results:6, error_count:0 },
  { id:3, created_at:'2025-01-15T14:41:00Z', file_path:'MergeSort.cpp',     source_language:'cpp',  status:'validated', confidence_score:0.91, iterations:2, original_complexity:'O(n log n)',optimized_complexity:'O(n log n)',validation_outcome:'pass', source_lines:22, output_lines:30, duration_ms:9200, entities_extracted:3, vector_results:5, graph_results:7, error_count:1 },
  { id:2, created_at:'2025-01-15T14:30:00Z', file_path:'BFS.cpp',           source_language:'cpp',  status:'failed',    confidence_score:0.71, iterations:2, original_complexity:'O(V+E)',  optimized_complexity:'O(V+E)',    validation_outcome:'fail', source_lines:20, output_lines:0,  duration_ms:11400, entities_extracted:2, vector_results:4, graph_results:9, error_count:2 },
  { id:1, created_at:'2025-01-15T14:20:00Z', file_path:'StringUtils.java',  source_language:'java', status:'validated', confidence_score:0.95, iterations:1, original_complexity:'O(n)',    optimized_complexity:'O(n)',      validation_outcome:'pass', source_lines:10, output_lines:16, duration_ms:4750, entities_extracted:2, vector_results:5, graph_results:4, error_count:0 },
]

function fmtDate(iso) {
  try { return new Date(iso).toLocaleString('en-IN', { dateStyle:'medium', timeStyle:'short' }) }
  catch { return iso }
}

function fmtMs(ms) {
  return ms >= 1000 ? `${(ms/1000).toFixed(1)}s` : `${ms}ms`
}

export default function HistoryPage({ apiUrl }) {
  const [rows, setRows]     = useState([])
  const [loading, setLoad]  = useState(true)
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoad, setDL] = useState(false)
  const [filter, setFilter] = useState('all')   // 'all' | 'cpp' | 'java' | 'pass' | 'fail'
  const [isLive, setIsLive] = useState(false)

  useEffect(() => {
    fetch(`${apiUrl}/history?limit=50`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d && d.length > 0) { setRows(d); setIsLive(true) }
        else setRows(MOCK_HISTORY)
        setLoad(false)
      })
      .catch(() => { setRows(MOCK_HISTORY); setLoad(false) })
  }, [apiUrl])

  const openDetail = async (id) => {
    if (selected === id) { setSelected(null); setDetail(null); return }
    setSelected(id); setDL(true)
    try {
      const r = await fetch(`${apiUrl}/history/${id}`)
      setDetail(r.ok ? await r.json() : null)
    } catch { setDetail(null) }
    setDL(false)
  }

  const filtered = rows.filter(r => {
    if (filter === 'cpp')  return r.source_language === 'cpp'
    if (filter === 'java') return r.source_language === 'java'
    if (filter === 'pass') return r.validation_outcome === 'pass'
    if (filter === 'fail') return r.validation_outcome !== 'pass'
    return true
  })

  if (loading) return (
    <div style={{ paddingTop: 58, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--ink-faint)' }}>Loading history…</div>
    </div>
  )

  return (
    <div style={{ paddingTop: 58, minHeight: '100vh', background: 'var(--cream)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '56px 32px' }}>

        <div style={{ marginBottom: 36, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '2px', color: 'var(--amber)', textTransform: 'uppercase', marginBottom: 14 }}>Run history</div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,4vw,44px)', fontWeight: 700, letterSpacing: '-1.5px', color: 'var(--ink)', lineHeight: 1.1 }}>Migration History</h1>
            <p style={{ fontSize: 15, color: 'var(--ink-soft)', marginTop: 8, lineHeight: 1.6 }}>
              Every pipeline run — logged with full metrics, confidence scores, and output.
              {!isLive && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--amber)', marginLeft: 8 }}>showing demo data</span>}
            </p>
          </div>
          {/* Summary chips */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {[
              { id:'all',  label:`All (${rows.length})` },
              { id:'cpp',  label:`C++ (${rows.filter(r=>r.source_language==='cpp').length})` },
              { id:'java', label:`Java (${rows.filter(r=>r.source_language==='java').length})` },
              { id:'pass', label:`Passed (${rows.filter(r=>r.validation_outcome==='pass').length})` },
              { id:'fail', label:`Failed (${rows.filter(r=>r.validation_outcome!=='pass').length})` },
            ].map(({ id, label }) => (
              <button key={id} onClick={() => setFilter(id)} style={{ padding: '5px 14px', borderRadius: 8, border: '1px solid', borderColor: filter === id ? 'var(--forest)' : 'var(--border)', background: filter === id ? 'rgba(28,58,47,0.08)' : 'transparent', color: filter === id ? 'var(--forest)' : 'var(--ink-soft)', fontSize: 13, fontFamily: 'var(--font-body)', cursor: 'pointer', fontWeight: filter === id ? 600 : 400, transition: 'all 0.18s' }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div style={{ background: 'var(--parchment)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead>
                <tr style={{ background: 'var(--cream)' }}>
                  {['File', 'Lang', 'Status', 'Confidence', 'Complexity', 'Iter', 'Duration', 'Entities', 'Date'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 500, color: 'var(--ink-faint)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', letterSpacing: '0.3px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} style={{ padding: '32px', textAlign: 'center', color: 'var(--ink-faint)', fontStyle: 'italic' }}>No runs match this filter.</td></tr>
                ) : filtered.map((row, i) => (
                  <>
                    <tr key={row.id}
                      onClick={() => openDetail(row.id)}
                      style={{ borderBottom: '1px solid var(--border)', background: selected === row.id ? 'rgba(28,58,47,0.04)' : i % 2 === 0 ? 'var(--parchment)' : 'transparent', cursor: 'pointer', transition: 'background 0.15s' }}
                      onMouseEnter={e => { if (selected !== row.id) e.currentTarget.style.background = 'var(--cream)' }}
                      onMouseLeave={e => { if (selected !== row.id) e.currentTarget.style.background = i % 2 === 0 ? 'var(--parchment)' : 'transparent' }}
                    >
                      <td style={{ padding: '11px 14px', maxWidth: 180 }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.file_path.split('/').pop()}
                        </div>
                        {row.source_lines > 0 && <div style={{ fontSize: 10.5, color: 'var(--ink-faint)', fontFamily: 'var(--font-mono)' }}>{row.source_lines}L → {row.output_lines}L</div>}
                      </td>
                      <td style={{ padding: '11px 14px', fontFamily: 'var(--font-mono)', fontSize: 11.5, fontWeight: 600, color: row.source_language === 'cpp' ? 'var(--forest)' : 'var(--amber)' }}>
                        {row.source_language.toUpperCase()}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ padding: '3px 9px', borderRadius: 100, fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 500, background: row.status === 'validated' ? 'rgba(28,58,47,0.08)' : 'rgba(155,61,26,0.08)', color: row.status === 'validated' ? 'var(--forest)' : 'var(--rust)' }}>
                          {row.status === 'validated' ? '✓ pass' : '✗ fail'}
                        </span>
                      </td>
                      <td style={{ padding: '11px 14px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: row.confidence_score >= 0.9 ? 'var(--forest)' : row.confidence_score >= 0.8 ? 'var(--amber)' : 'var(--rust)' }}>
                        {Math.round(row.confidence_score * 100)}%
                      </td>
                      <td style={{ padding: '11px 14px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>
                        <span style={{ color: 'var(--rust)' }}>{row.original_complexity || '—'}</span>
                        {row.original_complexity && row.optimized_complexity && row.original_complexity !== row.optimized_complexity && (
                          <> <span style={{ color: 'var(--ink-faint)' }}>→</span> <span style={{ color: 'var(--forest)' }}>{row.optimized_complexity}</span></>
                        )}
                      </td>
                      <td style={{ padding: '11px 14px', fontFamily: 'var(--font-mono)', fontSize: 12, color: row.iterations > 1 ? 'var(--amber)' : 'var(--ink-soft)', textAlign: 'center' }}>
                        {row.iterations}{row.iterations > 1 ? ' ↩' : ''}
                      </td>
                      <td style={{ padding: '11px 14px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-soft)' }}>{fmtMs(row.duration_ms)}</td>
                      <td style={{ padding: '11px 14px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-faint)' }}>
                        {row.entities_extracted}e / {row.vector_results}v / {row.graph_results}g
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--ink-faint)', whiteSpace: 'nowrap' }}>{fmtDate(row.created_at)}</td>
                    </tr>
                    {/* Expanded detail row */}
                    {selected === row.id && (
                      <tr key={`detail-${row.id}`}>
                        <td colSpan={9} style={{ padding: '20px 24px', background: 'rgba(28,58,47,0.03)', borderBottom: '1px solid var(--border)' }}>
                          {detailLoad ? (
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-faint)' }}>Loading detail…</div>
                          ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: detail?.output_code ? '1fr 1fr' : '1fr', gap: 16 }}>
                              <div>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>
                                  {detail?.source_code ? 'Source code' : 'Details'}
                                </div>
                                <div style={{ background: 'var(--ink)', borderRadius: 10, padding: '14px 16px', fontFamily: 'var(--font-mono)', fontSize: 11.5, color: '#A8C8A0', lineHeight: 1.7, maxHeight: 280, overflowY: 'auto', whiteSpace: 'pre' }}>
                                  {detail?.source_code || `entities: ${row.entities_extracted}\nvector hits: ${row.vector_results}\ngraph hits: ${row.graph_results}\nerrors: ${row.error_count}`}
                                </div>
                              </div>
                              {detail?.output_code && (
                                <div>
                                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>Generated Python</div>
                                  <div style={{ background: 'var(--ink)', borderRadius: 10, padding: '14px 16px', fontFamily: 'var(--font-mono)', fontSize: 11.5, color: '#A8C8A0', lineHeight: 1.7, maxHeight: 280, overflowY: 'auto', whiteSpace: 'pre' }}>
                                    {detail.output_code}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p style={{ fontSize: 12, color: 'var(--ink-faint)', fontFamily: 'var(--font-mono)', marginTop: 14, textAlign: 'center' }}>
          Click any row to expand source and output code · e = entities · v = vector hits · g = graph hops
        </p>
      </div>
    </div>
  )
}
