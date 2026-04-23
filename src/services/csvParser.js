import Papa from 'papaparse'
import { normalizePriority } from '../utils/helpers'
import { EFFORT_MINUTES, EFFORT_OPTIONS, PRIORITY_MINUTES } from '../utils/constants'

const COLUMN_ALIASES = {
  testId: ['test_id', 'testid', 'tc_id', 'tc id', 'id', 'test id', 'case id', 'case_id'],
  title: ['title', 'test case title', 'test case', 'name', 'summary', 'case title'],
  module: ['module', 'feature', 'area', 'component', 'section'],
  subModule: ['sub-module', 'submodule', 'sub module', 'screen', 'sub_component'],
  preConditions: ['pre-conditions', 'preconditions', 'pre conditions', 'prerequisites', 'setup'],
  steps: ['test steps', 'steps', 'steps to reproduce', 'procedure', 'test_steps'],
  description: ['description', 'desc', 'details', 'summary_long'],
  expectedResult: ['expected result', 'expected_result', 'expected', 'expected behavior', 'expected outcome'],
  priority: ['priority', 'severity', 'importance', 'p'],
  type: ['type', 'test type', 'test_type', 'category', 'kind'],
  effort: ['effort', 'complexity', 'difficulty', 'toughness'],
  estMinutes: ['minutes', 'est minutes', 'estimated minutes', 'est_minutes', 'time', 'duration'],
  remarks: ['remarks', 'notes', 'comments', 'additional notes'],
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

function normKey(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

export function autoMap(headers) {
  const mapping = {}
  const normalized = headers.map((h) => ({ raw: h, lc: h.trim().toLowerCase(), norm: normKey(h) }))
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    const aliasNorms = aliases.map(normKey)
    const hit = normalized.find(
      (h) => aliases.includes(h.lc) || aliasNorms.includes(h.norm)
    )
    if (hit) mapping[field] = hit.raw
  }
  return mapping
}

/**
 * Parse a free-text "Test Steps" blob into an array of step strings.
 * Handles:
 *  - "1. Open the app\n2. Observe" → ["Open the app", "Observe"]
 *  - bullet points "- foo\n- bar"
 *  - plain newline-separated lines
 */
export function parseSteps(raw) {
  if (!raw) return []
  const lines = String(raw)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  // Strip leading "1.", "1)", "- ", "* " etc.
  return lines.map((l) => l.replace(/^(\d+[.)]|[-*•])\s*/, '').trim()).filter(Boolean)
}

function normalizeEffort(raw) {
  if (!raw) return ''
  const v = String(raw).trim().toLowerCase()
  if (!v) return ''
  if (v.startsWith('e')) return 'Easy'
  if (v.startsWith('m')) return 'Medium'
  if (v.startsWith('h')) return 'Hard'
  if (v.startsWith('c')) return 'Complex'
  const match = EFFORT_OPTIONS.find((o) => o.toLowerCase() === v)
  return match || ''
}

function computeMinutes({ estMinutesRaw, effort, priority }) {
  const explicit = Number(estMinutesRaw)
  if (Number.isFinite(explicit) && explicit > 0) return Math.round(explicit)
  if (effort && EFFORT_MINUTES[effort]) return EFFORT_MINUTES[effort]
  return PRIORITY_MINUTES[priority] || 5
}

export function applyMapping(rows, mapping, projectCode = 'TC') {
  return rows.map((row, i) => {
    const pickRaw = (field) => (mapping[field] ? row[mapping[field]] : '')
    const pick = (field) => {
      const val = pickRaw(field)
      return val ? String(val).trim() : ''
    }
    const testId =
      pick('testId') || `${projectCode.toUpperCase()}-${String(i + 1).padStart(3, '0')}`
    const steps = parseSteps(pick('steps') || pick('description'))
    const priority = normalizePriority(pick('priority'))
    const effort = normalizeEffort(pick('effort'))
    const estimatedMinutes = computeMinutes({
      estMinutesRaw: pickRaw('estMinutes'),
      effort,
      priority,
    })
    return {
      testId,
      title: pick('title') || '(untitled)',
      module: pick('module') || 'General',
      subModule: pick('subModule'),
      preConditions: pick('preConditions'),
      description: pick('description'),
      steps,
      expectedResult: pick('expectedResult'),
      priority,
      type: pick('type') || 'Positive',
      effort,
      remarks: pick('remarks'),
      estimatedMinutes,
    }
  })
}

export const SAMPLE_CSV_TEMPLATE = `TC_ID,Module,Sub-Module,Test Case Title,Pre-Conditions,Test Steps,Expected Result,Priority,Type
TC-001,Onboarding,Splash,Splash screen displays on cold start,App installed,"1. Open the app
2. Observe the screen","Logo and loading indicator appear.",Critical,Positive
TC-002,Onboarding,Splash,Splash displays for 4+ seconds,App installed,"1. Open the app
2. Time the splash","Splash remains visible for at least 4s.",High,Positive
TC-003,Auth,Login,Valid mobile number accepted,None,"1. Enter '9000000000'
2. Tap Send OTP","No validation error; OTP sent.",High,Positive
TC-004,Auth,Login,Mobile field rejects letters,None,"1. Try typing 'abc'","Letters blocked; only digits accepted.",High,Negative
TC-005,Auth,Login,Empty mobile shows error,None,"1. Leave mobile blank
2. Tap Send OTP","Validation error: 'Mobile number is required'.",High,Negative
`
