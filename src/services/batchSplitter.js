import { addDays, isWeekend, format } from 'date-fns'
import {
  PRIORITY_WEIGHT,
  PRIORITY_ORDER,
  DEFAULT_DAILY_CAPACITY,
  DEFAULT_DAILY_MINUTES,
  DAILY_WEIGHT_CAP,
  DAILY_HARD_CAP,
  TESTCASE_STATUS,
} from '../utils/constants'

/**
 * Split test cases into daily batches.
 *
 * Ordering strategies (`orderBy`):
 *   'csv'      — preserve the input order (default). Day N gets cases N in sequence.
 *                Best when the CSV is authored in logical execution flow
 *                (e.g. splash → auth → home → payments).
 *   'priority' — sort by priority desc, then module. Best when you want to burn
 *                down the riskiest tests first.
 *   'module'   — group same-module cases together, tie-break by test ID.
 *
 * Capacity: each day fills until EITHER `dailyCapacity` count OR `weightCap`
 * weight points is reached (weights are priority-derived).
 *
 * Skips weekends by default.
 */
export function splitIntoBatches(
  testCases,
  {
    startDate = new Date(),
    dailyCapacity = DEFAULT_DAILY_CAPACITY,
    dailyMinutes = DEFAULT_DAILY_MINUTES,
    skipWeekends = true,
    orderBy = 'csv',
  } = {}
) {
  const indexed = testCases.map((tc, i) => ({ ...tc, __idx: i }))

  let sorted
  if (orderBy === 'priority') {
    sorted = indexed.sort((a, b) => {
      const pa = PRIORITY_ORDER.indexOf(a.priority)
      const pb = PRIORITY_ORDER.indexOf(b.priority)
      if (pa !== pb) return pa - pb
      const m = (a.module || '').localeCompare(b.module || '')
      if (m !== 0) return m
      return a.__idx - b.__idx
    })
  } else if (orderBy === 'module') {
    sorted = indexed.sort((a, b) => {
      const m = (a.module || '').localeCompare(b.module || '')
      if (m !== 0) return m
      const s = (a.subModule || '').localeCompare(b.subModule || '')
      if (s !== 0) return s
      return (a.testId || '').localeCompare(b.testId || '')
    })
  } else {
    sorted = indexed // csv order
  }

  const days = []
  let current = { cases: [], minutes: 0, weight: 0 }
  for (const tc of sorted) {
    const mins = Number(tc.estimatedMinutes) || 5
    const w = PRIORITY_WEIGHT[tc.priority] || 1
    const wouldExceedMinutes = current.minutes + mins > dailyMinutes
    const wouldExceedCount = current.cases.length >= dailyCapacity
    // Always allow at least one case per day — never create an empty day.
    if (current.cases.length > 0 && (wouldExceedMinutes || wouldExceedCount)) {
      days.push(current)
      current = { cases: [], minutes: 0, weight: 0 }
    }
    const { __idx, ...rest } = tc
    current.cases.push(rest)
    current.minutes += mins
    current.weight += w
  }
  if (current.cases.length) days.push(current)

  const dated = []
  let cursor = new Date(startDate)
  cursor.setHours(0, 0, 0, 0)
  for (let i = 0; i < days.length; i++) {
    if (skipWeekends) {
      while (isWeekend(cursor)) cursor = addDays(cursor, 1)
    }
    dated.push({
      dayNumber: i + 1,
      date: format(cursor, 'yyyy-MM-dd'),
      cases: days[i].cases,
      minutes: days[i].minutes,
      weight: days[i].weight,
    })
    cursor = addDays(cursor, 1)
  }
  return dated
}

/**
 * Preview of distribution, used for review screen of create-round wizard.
 */
export function distributionSummary(batches) {
  return batches.map((b) => {
    const counts = { Critical: 0, High: 0, Medium: 0, Low: 0 }
    for (const tc of b.cases) counts[tc.priority] = (counts[tc.priority] || 0) + 1
    return { ...b, counts }
  })
}

/**
 * Carry-over: pending cases from past days whose date ≤ today roll onto today.
 * Retests: cases with status=retest are added to today's batch (marked isRetest=true upstream).
 * Returns an array of patches: { id, batchDate, isCarryOver?, isRetest? }.
 */
export function computeCarryOvers(allCases, todayStr) {
  const patches = []
  for (const tc of allCases) {
    if (
      tc.status === TESTCASE_STATUS.PENDING &&
      tc.batchDate &&
      tc.batchDate < todayStr
    ) {
      patches.push({
        id: tc.id,
        batchDate: todayStr,
        isCarryOver: true,
      })
    }
    if (
      tc.status === TESTCASE_STATUS.RETEST &&
      (!tc.batchDate || tc.batchDate < todayStr)
    ) {
      patches.push({
        id: tc.id,
        batchDate: todayStr,
        isRetest: true,
      })
    }
  }
  return patches
}
