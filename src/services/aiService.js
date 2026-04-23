const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_URL = (model, key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`

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
    const res = await fetch(GEMINI_URL(GEMINI_MODEL, apiKey()), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 800,
          responseMimeType: 'application/json',
        },
      }),
    })
    if (!res.ok) {
      const txt = await res.text()
      throw new Error(`Gemini ${res.status}: ${txt.slice(0, 200)}`)
    }
    const data = await res.json()
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
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

  const res = await fetch(GEMINI_URL(GEMINI_MODEL, apiKey()), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 600 },
    }),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Gemini ${res.status}: ${txt.slice(0, 200)}`)
  }
  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
  if (!text) throw new Error('Empty response from Gemini')
  return text
}

/**
 * Expand all test cases with a rolling batch + rate-limit-friendly delay.
 * onProgress(done, total) is called after each batch completes.
 */
export async function expandAllTestCases(testCases, onProgress = () => {}, batchSize = 5, delayMs = 1200) {
  const out = []
  for (let i = 0; i < testCases.length; i += batchSize) {
    const slice = testCases.slice(i, i + batchSize)
    const expanded = await Promise.all(slice.map(expandTestCase))
    out.push(...expanded)
    onProgress(Math.min(i + batchSize, testCases.length), testCases.length)
    if (i + batchSize < testCases.length) {
      await new Promise((r) => setTimeout(r, delayMs))
    }
  }
  return out
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
