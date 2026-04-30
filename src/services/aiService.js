// Ordered fallback list — if one model is overloaded, try the next.
const GEMINI_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash']
const GEMINI_MODEL = GEMINI_MODELS[0]
const GEMINI_URL = (model, key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`
const RETRY_STATUSES = new Set([429, 500, 502, 503, 504])

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function callGemini(body, { maxAttempts = 3, timeoutMs = 25000 } = {}) {
  let lastErr
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const model = GEMINI_MODELS[Math.min(attempt, GEMINI_MODELS.length - 1)]
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const res = await fetch(GEMINI_URL(model, apiKey()), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify(body),
      })
      if (res.ok) {
        clearTimeout(timer)
        return await res.json()
      }
      const txt = await res.text()
      lastErr = new Error(`Gemini ${res.status} (${model}): ${txt.slice(0, 160)}`)
      if (!RETRY_STATUSES.has(res.status)) throw lastErr
    } catch (err) {
      lastErr = err
      if (err.name !== 'AbortError' && !(lastErr.message || '').match(/Gemini \d+/)) throw err
    } finally {
      clearTimeout(timer)
    }
    // Exponential backoff before next attempt: 600ms, 1800ms
    await sleep(600 * Math.pow(3, attempt))
  }
  throw lastErr || new Error('Gemini: unknown error')
}

function apiKey() {
  return import.meta.env.VITE_GEMINI_API_KEY
}

export function aiReady() {
  return Boolean(apiKey())
}

export function aiProviderName() {
  return 'Gemini'
}

/**
 * Expand a single test case via Google Gemini.
 * Returns { steps: string[], expectedResult: string, estimatedMinutes: number }.
 * Falls back to a deterministic stub if the API key is missing or the call fails.
 */
export async function expandTestCase(tc) {
  if (!apiKey()) return fallbackExpand(tc)

  const systemInstruction =
    'You are a QA expert for mobile app testing. Expand brief test case descriptions into detailed, clear testing instructions. Always respond in valid JSON only, no markdown, no prose.'

  const userPrompt = `Expand this test case:
Title: ${tc.title}
Module: ${tc.module}
Brief Description: ${tc.description || '(none — infer from title)'}
Priority: ${tc.priority}

Respond ONLY in this JSON format:
{
  "steps": ["Step 1: ...", "Step 2: ..."],
  "expectedResult": "detailed expected result",
  "estimatedMinutes": number
}`

  try {
    const data = await callGemini({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 },
      },
    })
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const finishReason = data?.candidates?.[0]?.finishReason
    if (!content) {
      // eslint-disable-next-line no-console
      console.warn('[aiService] empty content, finishReason:', finishReason, data)
      throw new Error(`Empty response (finishReason: ${finishReason || 'unknown'})`)
    }
    const parsed = safeParse(content)
    if (!parsed) throw new Error('Invalid JSON from Gemini')
    return {
      steps: Array.isArray(parsed.steps) ? parsed.steps.map(String) : [],
      expectedResult: String(parsed.expectedResult || ''),
      estimatedMinutes: Number(parsed.estimatedMinutes) || 5,
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[aiService] falling back:', err.message)
    return fallbackExpand(tc)
  }
}

/**
 * Enhance a tester's brief bug description into a structured, developer-friendly report.
 * Returns the enhanced text. Throws on failure so the caller can show a toast.
 */
export async function enhanceBugDescription(briefDescription, testCaseTitle, module, steps) {
  if (!apiKey()) throw new Error('Gemini API key not configured')

  const prompt = `You are a QA expert. A tester has written a brief bug description. Enhance it into a clear, structured bug report that a developer can immediately understand and act on.

Test Case: ${testCaseTitle}
Module: ${module}
Steps Performed: ${steps?.join(', ') || 'N/A'}

Tester's brief description: "${briefDescription}"

Rewrite this into a structured bug report with these sections:
- **What happened**: Clear description of the actual behavior
- **Where**: Exact screen/component/flow where it occurred
- **Frequency**: Always / Sometimes / Once (infer from description)
- **Impact**: How this affects the user experience

Keep it concise but developer-friendly. Don't add steps to reproduce (those are already in the test case). Write in plain text without markdown headers — just use line breaks between sections.
Respond with ONLY the enhanced description text, nothing else.`

  const data = await callGemini({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 1200,
      thinkingConfig: { thinkingBudget: 0 },
    },
  })
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
  if (!text) throw new Error('Empty response from Gemini')
  return text
}

/**
 * Expand all test cases with a rolling batch + rate-limit-friendly delay.
 * onProgress(done, total) is called after each batch completes.
 */
export async function expandAllTestCases(testCases, onProgress = () => {}, batchSize = 5, delayMs = 1200) {
  const out = new Array(testCases.length)
  let done = 0
  for (let i = 0; i < testCases.length; i += batchSize) {
    const slice = testCases.slice(i, i + batchSize)
    await Promise.all(
      slice.map(async (tc, j) => {
        const result = await expandTestCase(tc)
        out[i + j] = result
        done += 1
        onProgress(done, testCases.length)
      })
    )
    if (i + batchSize < testCases.length) {
      await new Promise((r) => setTimeout(r, delayMs))
    }
  }
  return out
}

/**
 * Ask Gemini to evaluate tester effectiveness from a payload of per-tester
 * stats + team baselines. Returns an array of
 *   { name, score, strengths[], weaknesses[], recommendation }
 * one entry per tester. Throws on failure (let the caller toast).
 *
 * Caller responsibility: only send anonymized / project-scoped data; this
 * helper makes no judgments about what's safe to send.
 */
export async function evaluateTesterEffectiveness({ testers, teamBaselines, projectName }) {
  if (!apiKey()) throw new Error('Gemini API key not configured')
  if (!testers?.length) throw new Error('No testers to evaluate')

  const systemInstruction = `You are a QA team lead writing a private effectiveness review for each tester from real execution metrics, engagement data, and the actual text of their recent bug reports. Score 1-10. Be honest and specific — generic feedback is useless.

Effectiveness factors (in order of weight):
1. Bug-report SUBSTANCE — read each tester's sample_bugs. Are they specific (clear steps, observed behaviour, environment) or terse ("not working", "broken")? avg_description_length_chars and screenshot_attach_rate_pct corroborate. A tester filing few well-written bugs beats one filing many one-liners.
2. Bug-report quality (outcome) — bug_fix_rate_pct vs bug_backlog_rate_pct. High fix-rate = real signal; high backlog-rate = noise.
3. Critical-bug detection — bugs_critical and bugs_high count more than total volume.
4. TestDesk engagement — active_days and total_active_minutes vs team. Steady daily presence > sporadic drive-bys.
5. Volume — cases_executed vs team baseline.
6. Run speed — avg_seconds_per_case vs baseline. Much faster + low pass-rate or terse bugs = rushing. Fast + healthy pass-rate + detailed bugs = efficient.
7. Pass-rate balance — 75-95% healthy. >95% with no bug detail = rubber-stamping. <60% = flaky cases or env problems.

For EACH tester, produce:
- score: integer 1-10. Calibrate ruthlessly. 9-10 = clear leaders across multiple factors. 7-8 = solid contributors. 5-6 = average with gaps. 3-4 = significant concerns. 1-2 = not effective.
- summary: TWO sentences. The first reads like a one-line verdict ("Steady but rushes the documentation."). The second cites two or three SPECIFIC numbers from the metrics (e.g. "Logged 2h 14m across 4 active days, averaged 21s per test, but only 38 chars per bug description on average."). Use the numbers verbatim from the input — don't make any up.
- timing_insight: ONE sentence specifically about engagement and run speed. Cite total_active_minutes (format as Xh Ym), active_days, avg_seconds_per_case, and how those compare to the team baseline. Example: "Spent 1h 47m on TestDesk over 3 days (team avg 2h 30m / 4 days) and runs each case in 18s vs team 25s — fast and present, slightly under-engaged."
- bug_quality_insight: ONE sentence specifically about the prose quality of their bugs, citing avg_description_length_chars, screenshot_attach_rate_pct, and characterizing the sample_bugs you read. Example: "Bug reports average 142 chars with 80% screenshots — sample bugs read as structured walkthroughs with environment notes." Or: "Bugs average 24 chars and 0% screenshots — most read like 'doesn't work' with no repro context."
- strengths: 1-2 short chip-style phrases (max 6 words). May be empty if no real strengths.
- weaknesses: 1-2 short chip-style phrases (max 6 words). Always provide at least one — every tester has gaps.
- recommendation: ONE concrete action sentence (max 25 words). Reference the specific weakness it addresses.

Respond in valid JSON only. No prose, no markdown fences.

Schema:
{
  "evaluations": [
    {
      "name": "<tester name>",
      "score": <1-10>,
      "summary": "<2 sentences>",
      "timing_insight": "<1 sentence>",
      "bug_quality_insight": "<1 sentence>",
      "strengths": ["<phrase>"],
      "weaknesses": ["<phrase>"],
      "recommendation": "<action>"
    }
  ]
}`

  const userPrompt = `Project: ${projectName || 'Unnamed'}

Team baselines:
${JSON.stringify(teamBaselines, null, 2)}

Per-tester stats:
${JSON.stringify(testers, null, 2)}

Evaluate each tester. Return JSON only.`

  const data = await callGemini({
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature: 0.3,
      // 4500 covers the longer schema (summary + two insight sentences)
      // for ~10 testers' worth of structured output.
      maxOutputTokens: 4500,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 0 },
    },
  })
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
  const parsed = safeParse(content)
  if (!parsed?.evaluations || !Array.isArray(parsed.evaluations)) {
    throw new Error('Gemini returned malformed evaluation')
  }
  return parsed.evaluations
}

function safeParse(str) {
  try {
    return JSON.parse(str)
  } catch {
    const match = str.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        return JSON.parse(match[0])
      } catch {
        return null
      }
    }
    return null
  }
}

function fallbackExpand(tc) {
  const base = (tc.description || tc.title || '').trim()
  const steps = [
    `Open the app and navigate to the ${tc.module || 'target'} module`,
    `Prepare the preconditions described by: "${base.slice(0, 80) || tc.title}"`,
    'Perform the user action described in the title',
    'Observe the system response carefully',
  ]
  const est = tc.priority === 'Critical' ? 8 : tc.priority === 'High' ? 6 : tc.priority === 'Medium' ? 4 : 3
  return {
    steps,
    expectedResult: base || `The ${tc.module || 'feature'} behaves as described in the test title without errors.`,
    estimatedMinutes: est,
  }
}
