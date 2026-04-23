import { Link } from 'react-router-dom'
import { Filter, MoreVertical, ImageIcon } from 'lucide-react'
import Badge from '../common/Badge.jsx'
import Avatar from '../common/Avatar.jsx'
import { statusTone, fmtRelative } from '../../utils/helpers'
import { BUG_STATUS_LABEL } from '../../utils/constants'

const SEVERITY_TONE = { Critical: 'danger', High: 'tertiary', Medium: 'primary', Low: 'secondary' }

export default function RecentBugs({ bugs, users }) {
  const userMap = Object.fromEntries(users.map((u) => [u.uid, u]))
  return (
    <div className="card overflow-hidden">
      <div className="p-5 border-b border-outline-variant/40 flex items-center justify-between">
        <h3 className="text-h3">Recent Bug Reports</h3>
        <div className="flex items-center gap-2">
          <button className="btn btn-sm btn-ghost w-8 p-0">
            <Filter size={16} />
          </button>
          <button className="btn btn-sm btn-ghost w-8 p-0">
            <MoreVertical size={16} />
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-body-md">
          <thead>
            <tr className="text-label-sm uppercase text-ink-dim bg-surface-low/40">
              <th className="text-left px-5 py-3 font-semibold">ID</th>
              <th className="text-left px-5 py-3 font-semibold">Issue Title</th>
              <th className="text-left px-5 py-3 font-semibold">Severity</th>
              <th className="text-left px-5 py-3 font-semibold">Reporter</th>
              <th className="text-left px-5 py-3 font-semibold">Status</th>
              <th className="text-left px-5 py-3 font-semibold">Evidence</th>
            </tr>
          </thead>
          <tbody>
            {bugs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-ink-dim">
                  No bugs reported yet.
                </td>
              </tr>
            )}
            {bugs.map((b) => {
              const reporter = userMap[b.reportedBy]
              const thumb = b.screenshots?.[0]
              return (
                <tr key={b.id} className="border-t border-outline-variant/30 hover:bg-surface-high/30 transition-colors">
                  <td className="px-5 py-3 font-mono text-primary whitespace-nowrap">
                    <Link to={`/bugs/${b.id}`}>{b.bugId || b.id.slice(0, 8)}</Link>
                  </td>
                  <td className="px-5 py-3">
                    <Link to={`/bugs/${b.id}`} className="block font-medium hover:text-primary">
                      {b.title}
                    </Link>
                    {b.device && <div className="text-[12px] text-ink-dim truncate">{b.device}</div>}
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={SEVERITY_TONE[b.severity] || 'neutral'}>{b.severity}</Badge>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={reporter?.name} size="xs" />
                      <span className="text-body-md truncate">{reporter?.name || '—'}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={statusTone(b.status)}>{BUG_STATUS_LABEL[b.status] || b.status}</Badge>
                  </td>
                  <td className="px-5 py-3">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt=""
                        className="w-12 h-8 rounded object-cover border border-outline-variant/50"
                      />
                    ) : (
                      <div className="w-12 h-8 rounded bg-surface-low border border-outline-variant/40 flex items-center justify-center text-ink-dim">
                        <ImageIcon size={14} />
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
