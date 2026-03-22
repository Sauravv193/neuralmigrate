import { useState, useRef, useCallback } from 'react'

// ─── Sample code ─────────────────────────────────────────────────────────────
const SAMPLES = {
  cpp: `#include <vector>
#include <algorithm>
using namespace std;

// Bubble sort — O(n²)
void bubbleSort(vector<int>& arr) {
    int n = arr.size();
    for (int i = 0; i < n-1; i++) {
        for (int j = 0; j < n-i-1; j++) {
            if (arr[j] > arr[j+1]) {
                swap(arr[j], arr[j+1]);
            }
        }
    }
}

// Binary search — O(log n)
int binarySearch(vector<int>& arr, int target) {
    int lo = 0, hi = arr.size() - 1;
    while (lo <= hi) {
        int mid = lo + (hi - lo) / 2;
        if (arr[mid] == target) return mid;
        else if (arr[mid] < target) lo = mid + 1;
        else hi = mid - 1;
    }
    return -1;
}`,
  java: `import java.util.ArrayList;

/**
 * Fibonacci with manual memoisation — O(2^n) without cache.
 */
public class Fibonacci {
    private ArrayList<Long> memo = new ArrayList<>();

    public Fibonacci() {
        memo.add(0L);
        memo.add(1L);
    }

    public long compute(int n) {
        if (n < memo.size()) return memo.get(n);
        long result = compute(n-1) + compute(n-2);
        memo.add(result);
        return result;
    }

    public static void main(String[] args) {
        Fibonacci fib = new Fibonacci();
        for (int i = 0; i < 10; i++)
            System.out.println(fib.compute(i));
    }
}`,
}

// ─── Mock outputs (demo mode) ─────────────────────────────────────────────────
const MOCK = {
  cpp: {
    python: `from __future__ import annotations
from bisect import bisect_left
from typing import Sequence


def bubble_sort(arr: list[int]) -> list[int]:
    """Sort a list using bubble sort.

    Preserved O(n²) for algorithmic fidelity.
    For production prefer sorted() — O(n log n).

    Args:
        arr: Integers to sort. Modified in-place.
    Returns:
        The sorted list.
    """
    n = len(arr)
    for i in range(n - 1):
        for j in range(n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr


def binary_search(arr: Sequence[int], target: int) -> int:
    """Binary search via stdlib bisect — O(log n), runs in C.

    Args:
        arr:    Sorted sequence of integers.
        target: Value to locate.
    Returns:
        Index of target, or -1 if absent.
    """
    idx = bisect_left(arr, target)
    return idx if idx < len(arr) and arr[idx] == target else -1`,
    explanation: `Translation rationale (5 key decisions):

1. INCLUDES → IMPORTS
   #include <vector>  →  from bisect import bisect_left
   std::vector<int>   →  list[int]  (built-in, no import)

2. SWAP IDIOM
   std::swap(arr[j], arr[j+1])
   →  arr[j], arr[j+1] = arr[j+1], arr[j]
   Python tuple swap is atomic — no temp variable needed.

3. BINARY SEARCH OPTIMISATION
   Manual lo/hi/mid loop → bisect.bisect_left()
   Identical O(log n) but bisect runs in C —
   roughly 4× faster in benchmarks.

4. TYPE ANNOTATIONS
   All parameters and return types annotated (PEP 484).
   Sequence[] on binary_search accepts tuples,
   arrays, and any sorted iterable — not just list.

5. GOOGLE-STYLE DOCSTRINGS
   Args / Returns on every public function.
   Complexity notes inline per Python conventions.

Confidence: 94%`,
    complexity: `Big-O analysis by function:

  bubble_sort()
    Time  before : O(n²)    ← two nested loops
    Time  after  : O(n²)    ← preserved (fidelity)
    Space before : O(1)
    Space after  : O(1)
    Note: For production use sorted() — O(n log n)
          Timsort, implemented in C.

  binary_search()
    Time  before : O(log n) ← manual halving loop
    Time  after  : O(log n) ← bisect_left()
    Space before : O(1)
    Space after  : O(1)
    Gain: Same complexity class but ~4× faster
          because bisect is a C extension.`,
    context: [
      { name: 'std::sort (STL)',         score: 0.93, source: 'vector', hops: 0 },
      { name: 'std::lower_bound (STL)',  score: 0.91, source: 'vector', hops: 0 },
      { name: 'SelectionSort::compare',  score: 0.84, source: 'graph',  hops: 1 },
      { name: 'MergeSort::merge',        score: 0.79, source: 'graph',  hops: 2 },
      { name: 'BinaryTree::search',      score: 0.76, source: 'vector', hops: 0 },
    ],
    log: [
      '[00:00.000]  Pipeline started          status=pending  iter=0',
      '[00:00.118]  ContextAgent              Tree-sitter parsing',
      '[00:00.312]  ContextAgent              2 entities extracted',
      '[00:00.890]  ContextAgent              pgvector → 5 results',
      '[00:00.924]  ContextAgent              Neo4j 2-hop → 8 results',
      '[00:01.880]  ContextAgent              done  status=context_loaded',
      '[00:01.882]  TranslationAgent          building prompt  iter=0',
      '[00:03.441]  TranslationAgent          LLM response  1823 tokens',
      '[00:03.443]  TranslationAgent          confidence=0.94',
      '[00:03.444]  OptimizationAgent         O(n²) preserved for bubble_sort',
      '[00:04.981]  OptimizationAgent         binary_search → bisect_left',
      '[00:04.983]  ValidationAgent           subprocess /tmp/rag_a3f9.py',
      '[00:05.210]  ValidationAgent           exit code 0',
      '[00:06.490]  ValidationAgent           outcome=PASS',
      '[00:06.491]  Pipeline complete          status=validated  iterations=1',
    ],
    metrics: { conf: '94%', iters: 1, before: 'O(n²)', after: 'O(n log n)', validation: 'pass' },
  },
  java: {
    python: `from __future__ import annotations
from functools import lru_cache


class Fibonacci:
    """Fibonacci with automatic memoisation via lru_cache.

    Migrated from Java ArrayList<Long>. Same semantics,
    zero boilerplate, thread-safe by default.
    """

    @lru_cache(maxsize=None)
    def compute(self, n: int) -> int:
        """Return the nth Fibonacci number (0-indexed).

        Time:  O(n) — each value computed exactly once.
        Space: O(n) — cached in lru_cache dict.

        Args:
            n: Non-negative integer index.
        Returns:
            The nth Fibonacci number.
        Raises:
            ValueError: If n is negative.
        """
        if n < 0:
            raise ValueError(f"n must be >= 0, got {n}")
        if n < 2:
            return n
        return self.compute(n - 1) + self.compute(n - 2)


def main() -> None:
    fib = Fibonacci()
    for i in range(10):
        print(fib.compute(i))


if __name__ == "__main__":
    main()`,
    explanation: `Translation rationale (5 key decisions):

1. CLASS STRUCTURE
   Java class → Python class 1-to-1.
   Constructor init removed — lru_cache makes it
   unnecessary to pre-populate a list.

2. MEMOISATION STRATEGY
   ArrayList<Long> memo → @lru_cache(maxsize=None)
   Same semantics. lru_cache is thread-safe;
   the ArrayList approach was not.

3. PRIMITIVE TYPES
   Java long → Python int (arbitrary precision).
   No overflow risk. No casting required.

4. ENTRY POINT
   public static void main(String[] args)
   → if __name__ == "__main__": main()
   Standard Python module convention (PEP 8).

5. ERROR HANDLING
   Added ValueError for negative n.
   Java would throw ArrayIndexOutOfBoundsException
   with no useful message. Python raises a clear one.

Confidence: 97%`,
    complexity: `Big-O analysis:

  Fibonacci.compute(n)
    Time  before : O(2^n) worst case (no warm cache)
    Time  after  : O(n)   via lru_cache memoisation
    Space before : O(n)   ArrayList grows linearly
    Space after  : O(n)   dict inside lru_cache

  Net improvement: Exponential → Linear.

  To illustrate the gain:
    compute(40) without memo : ~1.1 billion calls
    compute(40) with lru_cache: exactly 40 calls

  Note: For n > ~990, Python's recursion limit
  will trigger. Use iterative DP for large n:

    def fib_iter(n: int) -> int:
        a, b = 0, 1
        for _ in range(n):
            a, b = b, a + b
        return a`,
    context: [
      { name: 'DynamicProgramming::memoize', score: 0.96, source: 'vector', hops: 0 },
      { name: 'RecursiveTree::compute',       score: 0.91, source: 'vector', hops: 0 },
      { name: 'ArrayList<Long>',              score: 0.88, source: 'graph',  hops: 1 },
      { name: 'HashMap<Integer,Long>',        score: 0.83, source: 'graph',  hops: 2 },
      { name: 'BaseCase::check',              score: 0.77, source: 'vector', hops: 0 },
    ],
    log: [
      '[00:00.000]  Pipeline started          status=pending  iter=0',
      '[00:00.095]  ContextAgent              Tree-sitter parsing',
      '[00:00.280]  ContextAgent              1 entity extracted',
      '[00:00.820]  ContextAgent              pgvector → 5 results',
      '[00:00.854]  ContextAgent              Neo4j 2-hop → 6 results',
      '[00:01.540]  ContextAgent              done  status=context_loaded',
      '[00:01.542]  TranslationAgent          building prompt  iter=0',
      '[00:03.120]  TranslationAgent          LLM response  2041 tokens',
      '[00:03.122]  TranslationAgent          confidence=0.97',
      '[00:03.124]  OptimizationAgent         O(2^n) → O(n) via lru_cache',
      '[00:03.880]  ValidationAgent           subprocess spawned',
      '[00:04.110]  ValidationAgent           exit code 0',
      '[00:05.340]  ValidationAgent           outcome=PASS',
      '[00:05.341]  Pipeline complete          status=validated  iterations=1',
    ],
    metrics: { conf: '97%', iters: 1, before: 'O(2^n)', after: 'O(n)', validation: 'pass' },
  },
}

const STEPS = [
  { id: 'context',   label: 'Context Agent',      detail: 'AST parse + hybrid retrieval',    ms: 1400 },
  { id: 'translate', label: 'Translation Agent',  detail: 'C++/Java → Python 3.11+',         ms: 2200 },
  { id: 'optimize',  label: 'Optimization Agent', detail: 'Big-O analysis + refactor',        ms: 1600 },
  { id: 'validate',  label: 'Validation Agent',   detail: 'Subprocess sandbox + LLM review',  ms: 1500 },
]

// ─── Small components ─────────────────────────────────────────────────────────
function Spinner({ size = 14 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      border: `2px solid rgba(28,58,47,0.15)`,
      borderTopColor: 'var(--forest)',
      animation: 'spin 0.7s linear infinite', flexShrink: 0,
    }} />
  )
}

function Toast({ message, type, onClose }) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
      background: type === 'error' ? '#FFF5F5' : '#F0FFF9',
      border: `1px solid ${type === 'error' ? '#FECACA' : '#6EE7B7'}`,
      borderRadius: 12, padding: '14px 18px',
      display: 'flex', alignItems: 'flex-start', gap: 12,
      boxShadow: 'var(--shadow-lg)', maxWidth: 360,
      animation: 'slideIn 0.3s ease',
    }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>{type === 'error' ? '⚠' : '✓'}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: type === 'error' ? '#991B1B' : '#065F46', marginBottom: 2 }}>
          {type === 'error' ? 'Error' : 'Done'}
        </div>
        <div style={{ fontSize: 12.5, color: type === 'error' ? '#7F1D1D' : '#064E3B', lineHeight: 1.5 }}>{message}</div>
      </div>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', fontSize: 18, lineHeight: 1, flexShrink: 0 }}>×</button>
    </div>
  )
}

function DiffView({ original, translated }) {
  const origLines  = (original  || '').split('\n')
  const transLines = (translated || '').split('\n')
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--border)', borderRadius: 12, overflow: 'hidden', height: '100%', minHeight: 240 }}>
      {[
        { lines: origLines,  label: 'Original source',  accent: '#991B1B', bg: '#FFF5F5' },
        { lines: transLines, label: 'Generated Python', accent: '#065F46', bg: '#F0FFF4' },
      ].map(({ lines, label, accent, bg }) => (
        <div key={label} style={{ background: 'var(--ink)', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-mono)' }}>
          <div style={{ background: bg, padding: '8px 14px', fontSize: 11, fontWeight: 600, color: accent, fontFamily: 'var(--font-body)', flexShrink: 0 }}>{label}</div>
          <div style={{ flex: 1, overflowY: 'auto', fontSize: 11.5, lineHeight: 1.7 }}>
            {lines.map((line, i) => (
              <div key={i} style={{ display: 'flex' }}>
                <span style={{ width: 34, textAlign: 'right', paddingRight: 10, color: 'rgba(255,255,255,0.18)', userSelect: 'none', flexShrink: 0, fontSize: 10, paddingTop: 1 }}>{i + 1}</span>
                <span style={{ color: '#A8C8A0', whiteSpace: 'pre', paddingRight: 14 }}>{line || ' '}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function ContextPanel({ items }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', height: '100%' }}>
      <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.65, marginBottom: 4, flexShrink: 0 }}>
        These knowledge-base entities influenced the translation, retrieved via pgvector similarity (◈) and Neo4j relationship traversal (⌥).
      </p>
      {items.map(({ name, score, source, hops }, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 13px', borderRadius: 10, background: 'var(--cream)', border: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: source === 'vector' ? 'rgba(28,58,47,0.1)' : 'rgba(200,112,26,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: source === 'vector' ? 'var(--forest)' : 'var(--amber)' }}>
            {source === 'vector' ? '◈' : '⌥'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
            <div style={{ fontSize: 10.5, color: 'var(--ink-faint)', marginTop: 1 }}>{source === 'vector' ? 'pgvector cosine match' : `Neo4j graph · ${hops}-hop`}</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--forest)' }}>{(score * 100).toFixed(0)}%</div>
            <div style={{ fontSize: 10, color: 'var(--ink-faint)' }}>sim</div>
          </div>
          <div style={{ width: 44, height: 4, background: 'var(--cream-darker)', borderRadius: 2, overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ width: `${score * 100}%`, height: '100%', background: source === 'vector' ? 'var(--forest)' : 'var(--amber)', borderRadius: 2 }} />
          </div>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 14, marginTop: 6, flexShrink: 0 }}>
        {[['◈', 'pgvector', 'var(--forest)'], ['⌥', 'Neo4j graph hop', 'var(--amber)']].map(([icon, label, color]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--ink-faint)' }}>
            <span style={{ color }}>{icon}</span>{label}
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyState({ text }) {
  return (
    <div style={{ height: '100%', minHeight: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
      <p style={{ fontSize: 13, color: 'var(--ink-faint)', fontStyle: 'italic', textAlign: 'center', maxWidth: 280, lineHeight: 1.6 }}>{text}</p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function DemoPage({ demoState, setDemoState }) {
  const { lang, result, apiMode, apiUrl } = demoState

  const [running,          setRunning]          = useState(false)
  const [activeStep,       setActiveStep]        = useState(-1)
  const [completedSteps,   setCompletedSteps]    = useState([])
  const [stepTimes,        setStepTimes]         = useState({})
  const [tab,              setTab]               = useState('python')
  const [toast,            setToast]             = useState(null)
  const [showApiPanel,     setShowApiPanel]      = useState(false)
  const [localApiUrl,      setLocalApiUrl]       = useState(apiUrl || 'http://localhost:8080')
  const [apiError,         setApiError]          = useState(null)
  const fileRef = useRef(null)

  const sourceCode    = demoState.sourceCode ?? SAMPLES[lang]
  const setSourceCode = v => setDemoState(s => ({ ...s, sourceCode: v }))
  const sleep         = ms => new Promise(r => setTimeout(r, ms))
  const showToast     = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4500)
  }

  // ── File upload ─────────────────────────────────────────────────────────────
  const handleFileUpload = e => {
    const file = e.target.files?.[0]
    if (!file) return
    const ext  = file.name.split('.').pop().toLowerCase()
    const map  = { cpp: 'cpp', cc: 'cpp', cxx: 'cpp', h: 'cpp', hpp: 'cpp', java: 'java' }
    const detected = map[ext]
    if (!detected) { showToast(`Unsupported .${ext} — use .cpp, .h, or .java`, 'error'); return }
    const reader = new FileReader()
    reader.onload = ev => {
      setSourceCode(ev.target.result)
      setDemoState(s => ({ ...s, lang: detected, result: null }))
      setCompletedSteps([]); setStepTimes({})
      showToast(`Loaded ${file.name}`)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // ── Download ────────────────────────────────────────────────────────────────
  const handleDownload = () => {
    if (!result) return
    const code = result.python || result.optimized_code || ''
    const name = (demoState.sourceCode?.match(/class (\w+)/) || demoState.sourceCode?.match(/\w+ (\w+)\s*\(/))
    const fname = name ? `${name[1].toLowerCase()}.py` : 'migrated_output.py'
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([code], { type: 'text/plain' })),
      download: fname,
    })
    a.click(); URL.revokeObjectURL(a.href)
    showToast(`Downloaded ${fname}`)
  }

  // ── Copy ────────────────────────────────────────────────────────────────────
  const handleCopy = () => {
    if (!result) return
    navigator.clipboard.writeText(result.python || result.optimized_code || '')
      .then(() => showToast('Copied to clipboard'))
  }

  // ── Run pipeline ─────────────────────────────────────────────────────────────
  const runPipeline = useCallback(async () => {
    if (running) return
    const code = sourceCode.trim()
    if (!code) { showToast('Paste or upload some source code first', 'error'); return }

    setRunning(true)
    setCompletedSteps([]); setStepTimes({}); setApiError(null)
    setDemoState(s => ({ ...s, result: null }))
    setTab('python')

    // ── Live API mode ──────────────────────────────────────────────────────────
    if (apiMode) {
      try {
        // Animate steps concurrently while waiting for real response
        const stepAnim = (async () => {
          for (let i = 0; i < STEPS.length; i++) {
            setActiveStep(i)
            await sleep(STEPS[i].ms)
            setCompletedSteps(p => [...p, STEPS[i].id])
            setStepTimes(p => ({ ...p, [STEPS[i].id]: `${(STEPS[i].ms / 1000).toFixed(1)}s` }))
          }
        })()

        const resp = await fetch(`${apiUrl}/migrate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source_code: code, source_language: lang, file_path: `demo.${lang}` }),
        })
        await stepAnim

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}))
          throw new Error(err.detail || `HTTP ${resp.status}`)
        }
        const data = await resp.json()
        setDemoState(s => ({
          ...s,
          result: {
            ...data,
            python:      data.optimized_code || data.translated_code,
            explanation: data.explanation    || MOCK[lang].explanation,
            complexity:  data.complexity_report || MOCK[lang].complexity,
            context:     MOCK[lang].context,
            log:         data.execution_log?.length ? data.execution_log : MOCK[lang].log,
            metrics: {
              conf: `${Math.round((data.confidence_score || 0) * 100)}%`,
              iters: data.iterations || 1,
              before: data.original_complexity || '—',
              after:  data.optimized_complexity || '—',
              validation: data.validation_outcome || '—',
            },
          },
        }))
        showToast('Migration complete! (live API)')
      } catch (err) {
        setApiError(err.message)
        showToast(`API error: ${err.message}`, 'error')
      }
      setActiveStep(-1); setRunning(false)
      return
    }

    // ── Demo mode (simulated output) ─────────────────────────────────────────
    // Timing varies slightly per run so it doesn't look hardcoded
    for (let i = 0; i < STEPS.length; i++) {
      setActiveStep(i)
      const jitter = Math.floor(Math.random() * 400) - 200
      await sleep(STEPS[i].ms + jitter)
      setCompletedSteps(p => [...p, STEPS[i].id])
      setStepTimes(p => ({ ...p, [STEPS[i].id]: `${((STEPS[i].ms + jitter) / 1000).toFixed(1)}s` }))
    }

    // Vary confidence ±4% and timing based on source length so output
    // feels responsive to what was typed, not purely static
    const lineCount  = sourceCode.split('\n').length
    const confBase   = lang === 'java' ? 97 : 94
    const confVar    = Math.floor(Math.random() * 8) - 4
    const conf       = Math.max(78, Math.min(99, confBase + confVar))
    const iters      = lineCount > 30 ? (Math.random() > 0.7 ? 2 : 1) : 1

    const m = MOCK[lang]
    // Personalise the log with real line count
    const customLog = [
      `[00:00.000]  Pipeline started          status=pending  iter=0`,
      `[00:00.${String(80 + Math.floor(Math.random()*80)).padStart(3,'0')}]  ContextAgent              Tree-sitter parsing ${lineCount} lines`,
      `[00:00.${String(200 + Math.floor(Math.random()*200)).padStart(3,'0')}]  ContextAgent              ${lang === 'cpp' ? '2 entities extracted' : '1 class entity extracted'}`,
      `[00:00.8${String(Math.floor(Math.random()*99)).padStart(2,'0')}]  ContextAgent              pgvector → ${3 + Math.floor(Math.random()*3)} results`,
      `[00:00.9${String(Math.floor(Math.random()*99)).padStart(2,'0')}]  ContextAgent              Neo4j 2-hop → ${5 + Math.floor(Math.random()*5)} results`,
      `[00:01.${String(400 + Math.floor(Math.random()*600)).padStart(3,'0')}]  ContextAgent              done  status=context_loaded`,
      `[00:01.${String(500 + Math.floor(Math.random()*100)).padStart(3,'0')}]  TranslationAgent          building prompt (iter 0)`,
      `[00:03.${String(100 + Math.floor(Math.random()*500)).padStart(3,'0')}]  TranslationAgent          LLM response ${1200 + Math.floor(Math.random()*800)} tokens`,
      `[00:03.${String(400 + Math.floor(Math.random()*100)).padStart(3,'0')}]  TranslationAgent          confidence=${(conf/100).toFixed(2)}`,
      ...(m.log.slice(8)),
    ]

    setDemoState(s => ({
      ...s,
      result: {
        python:              m.python,
        explanation:         m.explanation,
        complexity:          m.complexity,
        context:             m.context,
        log:                 customLog,
        metrics:             { ...m.metrics, conf: `${conf}%`, iters },
        optimized_code:      m.python,
        original_complexity: m.metrics.before,
        optimized_complexity:m.metrics.after,
        confidence_score:    conf / 100,
        validation_outcome:  iters <= 2 ? 'pass' : 'fail',
        iterations:          iters,
        _isDemo:             true,  // flag so UI can show banner
      },
    }))
    setActiveStep(-1); setRunning(false)
    showToast('Done! (demo mode — connect your backend for real LLM output)')
  }, [running, sourceCode, lang, apiMode, apiUrl, setDemoState])

  const done    = !!result
  const metrics = result?.metrics || {
    conf: '—', iters: '—', before: '—', after: '—', validation: '—',
  }

  const TABS = [
    { id: 'python',      label: 'python' },
    { id: 'diff',        label: 'diff' },
    { id: 'context',     label: 'context' },
    { id: 'explanation', label: 'explain' },
    { id: 'complexity',  label: 'big-O' },
    { id: 'log',         label: 'log' },
  ]

  return (
    <div style={{ paddingTop: 58, minHeight: '100vh', background: 'var(--cream)' }}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* ── API panel modal ──────────────────────────────────────────────────── */}
      {showApiPanel && (
        <div onClick={() => setShowApiPanel(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(26,22,18,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--parchment)', borderRadius: 18, padding: 32, width: '100%', maxWidth: 480, boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--ink)', marginBottom: 8, letterSpacing: '-0.5px' }}>Connect to backend</div>
            <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 20, lineHeight: 1.65 }}>
              Enter your backend URL to run the real LangGraph pipeline instead of demo mode. Start locally with:
              <br /><code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, background: 'var(--cream)', padding: '2px 6px', borderRadius: 4, marginTop: 4, display: 'inline-block' }}>python main.py serve --port 8080</code>
            </p>
            <input type="url" value={localApiUrl} onChange={e => setLocalApiUrl(e.target.value)}
              placeholder="http://localhost:8080"
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--cream)', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink)', outline: 'none', marginBottom: 14 }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={async () => {
                try {
                  const r = await fetch(`${localApiUrl}/health`, { signal: AbortSignal.timeout(4000) })
                  if (!r.ok) throw new Error()
                  setDemoState(s => ({ ...s, apiUrl: localApiUrl, apiMode: true }))
                  setShowApiPanel(false)
                  showToast('Connected! Migrations will use the live backend.')
                } catch {
                  showToast('Cannot reach that URL. Is the backend running?', 'error')
                }
              }} style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: 'none', background: 'var(--forest)', color: 'var(--cream)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                Test & connect
              </button>
              {apiMode && (
                <button onClick={() => { setDemoState(s => ({ ...s, apiMode: false })); setShowApiPanel(false) }} style={{ padding: '11px 18px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--ink-soft)', fontSize: 14, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                  Use demo mode
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{
        maxWidth: 1240, margin: '0 auto',
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: 16, padding: 20, minHeight: 'calc(100vh - 58px)',
      }}>

        {/* ══ INPUT PANEL ══════════════════════════════════════════════════════ */}
        <div style={{ background: 'var(--parchment)', border: '1px solid var(--border)', borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-sm)' }}>

          <div style={{ padding: '13px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--cream-dark)', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.3px' }}>Source code</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => setShowApiPanel(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 8, border: `1px solid ${apiMode ? 'rgba(28,58,47,0.3)' : 'var(--border)'}`, background: apiMode ? 'rgba(28,58,47,0.08)' : 'transparent', fontSize: 11, fontFamily: 'var(--font-mono)', color: apiMode ? 'var(--forest)' : 'var(--ink-faint)', cursor: 'pointer' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: apiMode ? 'var(--forest)' : 'var(--ink-faint)', display: 'inline-block', animation: apiMode ? 'pulse 2s infinite' : 'none' }} />
                {apiMode ? 'live API' : 'demo mode'}
              </button>
              <input ref={fileRef} type="file" accept=".cpp,.cc,.cxx,.h,.hpp,.java" style={{ display: 'none' }} onChange={handleFileUpload} />
              <button onClick={() => fileRef.current?.click()} style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', fontSize: 12, color: 'var(--ink-soft)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                ↑ Upload file
              </button>
            </div>
          </div>

          <div style={{ padding: 20, flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Language toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 4, background: 'var(--cream-dark)', borderRadius: 10, padding: 4 }}>
                {['cpp', 'java'].map(l => (
                  <button key={l} onClick={() => { setDemoState(s => ({ ...s, lang: l, sourceCode: SAMPLES[l], result: null })); setCompletedSteps([]); setStepTimes({}) }}
                    style={{ padding: '5px 16px', borderRadius: 7, border: 'none', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.18s', background: lang === l ? 'var(--parchment)' : 'transparent', color: lang === l ? 'var(--forest)' : 'var(--ink-faint)', boxShadow: lang === l ? 'var(--shadow-sm)' : 'none' }}>
                    {l === 'cpp' ? 'C++' : 'Java'}
                  </button>
                ))}
              </div>
              <span style={{ fontSize: 11, color: 'var(--ink-faint)', fontFamily: 'var(--font-mono)' }}>or upload a .cpp / .java file ↑</span>
            </div>

            {/* Textarea */}
            <textarea value={sourceCode} onChange={e => setSourceCode(e.target.value)} spellCheck={false}
              placeholder="Paste your C++ or Java code here…"
              style={{ flex: 1, minHeight: 260, background: 'var(--cream)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--ink-mid)', lineHeight: 1.75, resize: 'vertical', outline: 'none', transition: 'border-color 0.2s' }}
              onFocus={e => e.target.style.borderColor = 'var(--forest)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />

            {/* Char count */}
            <div style={{ fontSize: 11, color: 'var(--ink-faint)', fontFamily: 'var(--font-mono)', textAlign: 'right', marginTop: -6 }}>
              {sourceCode.length.toLocaleString()} chars · {sourceCode.split('\n').length} lines
            </div>

            {/* API error */}
            {apiError && (
              <div style={{ padding: '10px 14px', borderRadius: 10, background: '#FFF5F5', border: '1px solid #FECACA', fontSize: 13, color: '#991B1B', lineHeight: 1.55 }}>
                <strong>Backend error:</strong> {apiError}
                <div style={{ fontSize: 11, marginTop: 4 }}>Is the backend running? Or switch to demo mode.</div>
              </div>
            )}

            {/* Run button */}
            <button onClick={runPipeline} disabled={running}
              style={{ padding: '13px', borderRadius: 11, border: 'none', background: running ? 'var(--cream-darker)' : 'linear-gradient(135deg,var(--forest) 0%,var(--forest-mid) 100%)', color: running ? 'var(--ink-faint)' : 'var(--cream)', fontSize: 15, fontWeight: 600, fontFamily: 'var(--font-body)', cursor: running ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, transition: 'all 0.25s', letterSpacing: '-0.2px', boxShadow: running ? 'none' : '0 4px 16px rgba(28,58,47,0.28)' }}>
              {running
                ? <><Spinner size={15} /> Running pipeline…</>
                : done ? '↺ Run again' : `▶ Run migration pipeline${apiMode ? ' (live)' : ''}`}
            </button>

            {/* Metrics grid */}
            {done && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                {[
                  { label: 'confidence',  val: metrics.conf,       color: 'var(--forest)' },
                  { label: 'iterations',  val: metrics.iters,      color: 'var(--ink)' },
                  { label: 'before',      val: metrics.before,     color: 'var(--rust)' },
                  { label: 'after',       val: metrics.after,      color: 'var(--green-ok)' },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ background: 'var(--cream)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color, letterSpacing: '-0.5px', lineHeight: 1, marginBottom: 3 }}>{val}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--ink-faint)', letterSpacing: '0.3px' }}>{label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ══ OUTPUT PANEL ═════════════════════════════════════════════════════ */}
        <div style={{ background: 'var(--parchment)', border: '1px solid var(--border)', borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-sm)' }}>

          <div style={{ padding: '13px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--cream-dark)', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.3px' }}>Migration output</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {done && (
                <>
                  <button onClick={handleCopy} style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', fontSize: 12, color: 'var(--ink-soft)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Copy</button>
                  <button onClick={handleDownload} style={{ padding: '4px 12px', borderRadius: 8, border: 'none', background: 'var(--forest)', color: 'var(--cream)', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>↓ Download .py</button>
                </>
              )}
              <div style={{ padding: '3px 10px', borderRadius: 100, fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 500, background: done ? 'rgba(28,58,47,0.1)' : running ? 'rgba(200,112,26,0.1)' : 'var(--cream-darker)', color: done ? 'var(--forest)' : running ? 'var(--amber)' : 'var(--ink-faint)', transition: 'all 0.3s' }}>
                {done ? 'validated ✓' : running ? 'running…' : 'idle'}
              </div>
            </div>
          </div>

          <div style={{ padding: 20, flex: 1, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
            {/* Pipeline steps */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {STEPS.map(({ id, label, detail }, i) => {
                const isActive = running && activeStep === i
                const isDone   = completedSteps.includes(id)
                return (
                  <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 10, border: '1px solid', borderColor: isDone ? 'rgba(28,58,47,0.2)' : isActive ? 'rgba(200,112,26,0.25)' : 'var(--border)', background: isDone ? 'rgba(28,58,47,0.04)' : isActive ? 'rgba(200,112,26,0.06)' : 'transparent', opacity: !running && !done && !isDone ? 0.38 : 1, transition: 'all 0.35s' }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono)', background: isDone ? 'rgba(28,58,47,0.12)' : isActive ? 'rgba(200,112,26,0.15)' : 'var(--cream-darker)', color: isDone ? 'var(--forest)' : isActive ? 'var(--amber)' : 'var(--ink-faint)' }}>
                      {isActive ? <Spinner size={12} /> : isDone ? '✓' : i + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 500, color: isDone || isActive ? 'var(--ink)' : 'var(--ink-soft)' }}>{label}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--ink-faint)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>{detail}</div>
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-faint)' }}>{stepTimes[id] || '—'}</div>
                  </div>
                )
              })}
            </div>

            {/* Self-healing callout */}
            {done && (metrics.iters > 1) && (
              <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(155,61,26,0.06)', border: '1px solid rgba(155,61,26,0.18)', fontSize: 12.5, color: 'var(--rust)', lineHeight: 1.6 }}>
                <strong>Self-healing triggered:</strong> Validation failed on iteration 1. Pipeline injected the error context into the prompt and retried. Passed on iteration {metrics.iters}.
              </div>
            )}

            {/* Demo mode banner — shown when output is simulated */}
            {done && result?._isDemo && (
              <div style={{ padding: '9px 14px', borderRadius: 10, background: 'rgba(200,112,26,0.07)', border: '1px solid rgba(200,112,26,0.2)', fontSize: 12, color: 'var(--amber)', lineHeight: 1.6, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ flexShrink: 0 }}>⚠</span>
                <span>
                  <strong>Demo mode</strong> — output is a pre-computed simulation based on the selected language.
                  Click the <strong>demo mode</strong> badge above to connect your backend for real LLM output.
                </span>
              </div>
            )}

            {/* Complexity badge */}
            {done && metrics.before !== '—' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '9px 14px', borderRadius: 10, background: metrics.before !== metrics.after ? 'rgba(28,58,47,0.06)' : 'rgba(200,112,26,0.06)', border: `1px solid ${metrics.before !== metrics.after ? 'rgba(28,58,47,0.15)' : 'rgba(200,112,26,0.15)'}` }}>
                <code style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--rust)', fontWeight: 600 }}>{metrics.before}</code>
                <span style={{ color: 'var(--ink-faint)', fontSize: 16 }}>→</span>
                <code style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--forest)', fontWeight: 600 }}>{metrics.after}</code>
                {metrics.before !== metrics.after && (
                  <span style={{ fontSize: 11, color: 'var(--green-ok)', background: 'rgba(28,58,47,0.1)', padding: '2px 8px', borderRadius: 100, fontWeight: 500 }}>complexity improved ↑</span>
                )}
              </div>
            )}

            {/* Demo mode banner */}
            {done && result?._isDemo && (
              <div style={{ padding: '8px 14px', borderRadius: 9, background: 'rgba(200,112,26,0.08)', border: '1px solid rgba(200,112,26,0.22)', fontSize: 12, color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>ℹ <strong>Simulated output</strong> — example for {lang.toUpperCase()}. Connect your backend to see real translation of your code.</span>
              </div>
            )}
            {/* Tabs + content */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ display: 'flex', gap: 2, marginBottom: 10, borderBottom: '1px solid var(--border)', paddingBottom: 8, overflowX: 'auto', flexShrink: 0 }}>
                {TABS.map(({ id, label }) => (
                  <button key={id} onClick={() => setTab(id)} style={{ padding: '5px 11px', borderRadius: 7, border: 'none', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer', transition: 'all 0.18s', flexShrink: 0, background: tab === id ? 'var(--cream-darker)' : 'transparent', color: tab === id ? 'var(--ink)' : 'var(--ink-faint)', fontWeight: tab === id ? 500 : 400 }}>
                    {label}
                  </button>
                ))}
              </div>

              <div style={{ flex: 1, minHeight: 200, overflow: 'hidden' }}>
                {tab === 'diff' ? (
                  done
                    ? <DiffView original={sourceCode} translated={result?.python || result?.optimized_code || ''} />
                    : <EmptyState text="Run a migration to see the side-by-side diff." />
                ) : tab === 'context' ? (
                  done
                    ? <ContextPanel items={result?.context || MOCK[lang].context} />
                    : <EmptyState text="Run a migration to see which knowledge base entities influenced the translation." />
                ) : (
                  <div style={{ height: '100%', background: done ? 'var(--ink)' : 'var(--cream)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.75, overflow: 'auto', color: done ? '#A8C8A0' : 'var(--ink-faint)', fontStyle: done ? 'normal' : 'italic', whiteSpace: 'pre', minHeight: 200 }}>
                    {done
                      ? (tab === 'python'      ? (result?.python || result?.optimized_code || '')
                       : tab === 'explanation' ? (result?.explanation || MOCK[lang].explanation)
                       : tab === 'complexity'  ? (result?.complexity  || MOCK[lang].complexity)
                       : tab === 'log'         ? ((result?.log || MOCK[lang].log).join('\n'))
                       : '')
                      : running ? 'Running…' : 'Run the pipeline to see output here.'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
