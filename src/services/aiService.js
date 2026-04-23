const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

function apiKey() {
  return import.meta.env.VITE_GROQ_API_KEY
}

export function aiReady() {
  return Boolean(apiKey())
}

/**
 * Expand a single test case via Groq Llama 3.3 70B.
 * Returns { steps: string[], expectedResult: string, estimatedMinutes: number }.
 * Falls back to a deterministic stub if the API key is missing or the call fails.
 */
export async function expandTestCase(tc) {
  if (!apiKey()) return fallbackExpand(tc)

  const messages = [
    {
      role: 'system',
      content:
        'You are a QA expert for mobile app testing. Expand brief test case descriptions into detailed, clear testing instructions. Always respond in valid JSON only, no markdown.',
    },
    {
      role: 'user',
      content: `Expand this test case:
Title: ${tc.title}
Module: ${tc.module}
Brief Description: ${tc.description || '(none — infer from title)'}
Priority: ${tc.priority}

Respond ONLY in this JSON format:
{
  "steps": ["Step 1: ...", "Step 2: ..."],
  "expectedResult": "detailed expected result",
  "estimatedMinutes": number
}`,
    },
  ]

  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,
        temperature: 0.3,
        max_tokens: 600,
        response_format: { type: 'json_object' },
      }),
    })
    if (!res.ok) {
      const txt = await res.text()
      throw new Error(`Groq ${res.status}: ${txt.slice(0, 200)}`)
    }
    const data = await res.json()
    const content = data.choices?.[0]?.message?.content || ''
    const parsed = safeParse(content)
    if (!parsed) throw new Error('Invalid JSON from Groq')
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
 * Expand all test cases with a rolling batch + rate-limit-friendly delay.
 * onProgress(done, total) is called after each batch completes.
 */
export async function expandAllTestCases(testCases, onProgress = () => {}, batchSize = 5, delayMs = 1000) {
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
