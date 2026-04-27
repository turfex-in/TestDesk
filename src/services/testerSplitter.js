/**
 * Split a flat list of test cases across N testers using one of three
 * strategies. Each strategy returns an array of length N where slot i is
 * the array of cases assigned to tester i. The original CSV order is
 * preserved within each tester's slice (so testers ride the natural app
 * flow within their assigned modules).
 *
 *   'module'     — recommended default. Group cases by module, then assign
 *                  whole modules to testers via greedy bin-packing on
 *                  estimatedMinutes. Each tester runs coherent end-to-end
 *                  flows. Falls back to a contiguous split if there's only
 *                  a single module.
 *   'contiguous' — cut the deck into N consecutive chunks, balancing by
 *                  estimatedMinutes (not strictly equal counts). Preserves
 *                  flow within each chunk but the cut points are arbitrary.
 *   'round-robin'— strict alternation. TC-001 → tester 0, TC-002 → tester 1,
 *                  etc. Worst for flow; included for completeness.
 */
export function splitAcrossTesters(testCases, testerCount, strategy = 'module') {
  const n = Math.max(1, testerCount | 0)
  if (n === 1) return [testCases.slice()]
  if (!testCases.length) return Array.from({ length: n }, () => [])

  if (strategy === 'round-robin') return splitRoundRobin(testCases, n)
  if (strategy === 'contiguous') return splitContiguous(testCases, n)
  return splitByModule(testCases, n)
}

function splitRoundRobin(testCases, n) {
  const buckets = Array.from({ length: n }, () => [])
  testCases.forEach((tc, i) => buckets[i % n].push(tc))
  return buckets
}

function splitContiguous(testCases, n) {
  const totalMin = sumMinutes(testCases)
  const targetPerBucket = totalMin / n
  const buckets = Array.from({ length: n }, () => [])
  let acc = 0
  let bucketIdx = 0
  for (const tc of testCases) {
    const m = caseMinutes(tc)
    // Move to next bucket once we've crossed the target boundary, but never
    // leave a bucket empty.
    if (
      bucketIdx < n - 1 &&
      buckets[bucketIdx].length > 0 &&
      acc + m / 2 > targetPerBucket * (bucketIdx + 1)
    ) {
      bucketIdx++
    }
    buckets[bucketIdx].push(tc)
    acc += m
  }
  return buckets
}

function splitByModule(testCases, n) {
  // Group preserving first-seen order so within-module CSV order is intact.
  const byModule = new Map()
  for (const tc of testCases) {
    const key = tc.module || '(no module)'
    if (!byModule.has(key)) byModule.set(key, [])
    byModule.get(key).push(tc)
  }

  // If there's effectively one module, by-module degenerates — fall back to
  // contiguous so we still split work fairly.
  if (byModule.size < n) return splitContiguous(testCases, n)

  // Greedy: sort modules by total minutes desc, assign each to the tester
  // with the lightest current load.
  const modules = [...byModule.entries()]
    .map(([name, cases]) => ({ name, cases, minutes: sumMinutes(cases) }))
    .sort((a, b) => b.minutes - a.minutes)

  const buckets = Array.from({ length: n }, () => ({ cases: [], minutes: 0 }))
  for (const mod of modules) {
    const lightest = buckets.reduce(
      (best, b, i) => (b.minutes < buckets[best].minutes ? i : best),
      0
    )
    buckets[lightest].cases.push(...mod.cases)
    buckets[lightest].minutes += mod.minutes
  }
  return buckets.map((b) => b.cases)
}

function caseMinutes(tc) {
  return Number(tc.estimatedMinutes) || 5
}

function sumMinutes(cases) {
  return cases.reduce((s, c) => s + caseMinutes(c), 0)
}

/**
 * Build a per-tester summary for the wizard preview. Returns an array where
 * each entry has counts/minutes/modules for one tester's slice.
 */
export function summarizeSplit(buckets) {
  return buckets.map((cases) => {
    const modules = new Map()
    for (const tc of cases) {
      const key = tc.module || '(no module)'
      modules.set(key, (modules.get(key) || 0) + 1)
    }
    return {
      caseCount: cases.length,
      minutes: sumMinutes(cases),
      modules: [...modules.entries()].map(([name, count]) => ({ name, count })),
    }
  })
}
