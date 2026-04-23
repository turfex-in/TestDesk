import Papa from 'papaparse'
import { normalizePriority, cn } from '../utils/helpers'

const COLUMN_ALIASES = {
  testId: ['test_id', 'testid', 'id', 'test id', 'tc id', 'tc_id', 'case id'],
  title: ['title', 'test case', 'name', 'summary', 'case title'],
  module: ['module', 'feature', 'area', 'component', 'section'],
  description: ['description', 'desc', 'details', 'steps', 'summary_long'],
  priority: ['priority', 'severity', 'importance', 'p'],
}

export function parseCsvFile(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      complete: (results) => {
        const rows = results.data.filter((r) => Object.values(r).some((v) => v && String(v).trim()))
        const headers = results.meta.fields || []
        resolve({ rows, headers, errors: results.errors })
      },
      error: (err) => reject(err),
    })
  })
}

export function autoMap(headers) {
  const lower = headers.map((h) => ({ raw: h, lc: h.trim().toLowerCase() }))
  const mapping = {}
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    const hit = lower.find((h) => aliases.includes(h.lc) || aliases.some((a) => h.lc.replace(/[^a-z0-9]/g, '') === a.replace(/[^a-z0-9]/g, '')))
    if (hit) mapping[field] = hit.raw
  }
  return mapping
}

export function applyMapping(rows, mapping, projectCode = 'TC') {
  return rows.map((row, i) => {
    const testId =
      (mapping.testId && row[mapping.testId]) ||
      `${projectCode.toUpperCase()}-${String(i + 1).padStart(3, '0')}`
    return {
      testId: String(testId).trim(),
      title: (mapping.title && row[mapping.title]?.trim()) || '(untitled)',
      module: (mapping.module && row[mapping.module]?.trim()) || 'General',
      description: (mapping.description && row[mapping.description]?.trim()) || '',
      priority: normalizePriority(mapping.priority && row[mapping.priority]),
    }
  })
}

export const SAMPLE_CSV_TEMPLATE = `test_id,title,module,description,priority
TFX-001,Init Sequence,Onboarding,App cold start and initial logo animation,High
TFX-002,Splash Animation,Onboarding,Splash screen should transition cleanly to landing,Medium
TFX-003,Auth Flow,Login,Valid credentials land user on dashboard,Critical
TFX-004,Token Refresh,Security,Refresh token rotates after 15 minutes,High
TFX-005,Logout Sync,Login,Logging out clears local session,Low
`
