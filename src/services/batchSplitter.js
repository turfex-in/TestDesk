import { addDays, isWeekend, format } from 'date-fns'
import {
  PRIORITY_WEIGHT,
  PRIORITY_ORDER,
  DEFAULT_DAILY_CAPACITY,
  DAILY_WEIGHT_CAP,
  DAILY_HARD_CAP,
  TESTCASE_STATUS,
} from '../utils/constants'

/**
 * Split test cases into daily batches by priority weight.
 * - Weights: Critical=3, High=2, Medium=1.5, Low=1
 * - Cap: dailyCapacity (count) OR weightCap (weight points), whichever hits first
 * - Sort by priority desc, then group same module together
 * - Skip weekends
 */
export function splitIntoBatches(
  testCases,
  {
    startDate = new Date(),
    dailyCapacity = DEFAULT_DAILY_CAPACITY,
    weightCap = DAILY_WEIGHT_CAP,
    skipWeekends = true,
  } = {}
) {
  const sorted = [...testCases].sort((a, b) => {
    const pa = PRIORITY_ORDER.indexOf(a.priority)
    const pb = PRIORITY_ORDER.indexOf(b.priority)
    if (pa !== pb) return pa - pb
    return (a.module || '').localeCompare(b.module || '')
  })

  const days = []
  let current = { cases: [], weight: 0 }
  for (const tc of sorted) {
    const w = PRIORITY_WEIGHT[tc.priority] || 1
    if (
      current.cases.length >= dailyCapacity ||
      current.weight + w > weightCap
    ) {
      days.push(current)
      current = { cases: [], weight: 0 }
    }
    current.cases.push(tc)
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
    // Retest cases without a forward batchDate: assign today
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
