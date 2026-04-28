import { Link } from 'react-router-dom'
import { Check, X, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import Badge from '../common/Badge.jsx'

export default function RegressionTable({ testCases = [], maxRounds = 3, initialSearch = '' }) {
  const [search, setSearch] = useState(initialSearch)
  // If we navigate from another bug link with a different testId param, reset
  // the filter to match the new target.
  useEffect(() => {
    setSearch(initialSearch)
  }, [initialSearch])
  const filtered = testCases.filter((tc) => {
    if (!search) return true
    const q = search.toLowerCase()
    return tc.title?.toLowerCase().includes(q) || tc.testId?.toLowerCase().includes(q)
  })

  return (
    <div className="card overflow-hidden">
      <div className="p-5 border-b border-outline-variant/40 flex items-center justify-between">
        <h3 className="text-h3">Regression Detailed Breakdown</h3>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-dim" />
          <input
            className="input pl-9 h-8 text-[13px] w-48"
            placeholder="Filter tests…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <table className="w-full text-body-md">
        <thead>
          <tr className="text-label-sm uppercase text-ink-dim bg-surface-low/40">
            <th className="text-left px-5 py-3 font-semibold">Test ID</th>
            <th className="text-left px-5 py-3 font-semibold">Title</th>
            {[...Array(maxRounds)].map((_, i) => (
              <th key={i} className="text-center px-3 py-3 font-semibold">
                Round {i + 1}
              </th>
            ))}
            <th className="text-left px-5 py-3 font-semibold">Current Status</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((tc) => (
            <tr
              key={tc.id}
              className="border-t border-outline-variant/30 hover:bg-surface-high/30 transition-colors"
            >
              <td className="px-5 py-3 font-mono text-primary">{tc.testId}</td>
              <td className="px-5 py-3">{tc.title}</td>
              {[...Array(maxRounds)].map((_, i) => {
                const res = tc.roundResults?.[`round${i + 1}`]
                return (
                  <td key={i} className="text-center px-3 py-3">
                    <Dot res={res} />
                  </td>
                )
              })}
              <td className="px-5 py-3">
                <StatusBadge tc={tc} />
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={maxRounds + 3} className="px-5 py-8 text-center text-ink-dim">
                No tests match.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="px-5 py-3 text-body-md text-ink-dim border-t border-outline-variant/40">
        Showing {filtered.length} of {testCases.length} test cases
      </div>
    </div>
  )
}

function Dot({ res }) {
  if (res === 'passed') return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-secondary/20 text-secondary">
      <Check size={14} />
    </span>
  )
  if (res === 'failed') return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-danger/20 text-danger">
      <X size={14} />
    </span>
  )
  return <span className="text-ink-dim">—</span>
}

function StatusBadge({ tc }) {
  if (tc.status === 'passed') return <Badge tone="secondary">Verified</Badge>
  if (tc.status === 'failed') return <Badge tone="danger">Failing</Badge>
  if (tc.status === 'retest') return <Badge tone="primary">Retest</Badge>
  return <Badge tone="tertiary">Pending</Badge>
}
