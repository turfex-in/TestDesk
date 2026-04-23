// Adds an "Effort" column to the detailed Turfex CSV using a simple rubric:
//   - Payment, Booking, Slot Picker, QR Scanner, Verify   → Hard
//   - End-to-end or security / data isolation             → Complex
//   - Simple validation, UI labels, navigation            → Easy
//   - Default                                             → Medium
//   - Criticals get at least Medium; full payment/booking Complex
import { readFileSync, writeFileSync } from 'node:fs'
import Papa from 'papaparse'

const IN = new URL('../Turfex_Test_Cases_Detailed.csv', import.meta.url)
const OUT = new URL('../Turfex_Test_Cases_With_Effort.csv', import.meta.url)

const raw = readFileSync(IN, 'utf8')
const parsed = Papa.parse(raw, { header: true, skipEmptyLines: true })

function classify(row) {
  const module = (row['Module'] || '').toLowerCase()
  const subModule = (row['Sub-Module'] || '').toLowerCase()
  const title = (row['Test Case Title'] || '').toLowerCase()
  const priority = row['Priority']
  const type = row['Type']

  const isComplex = (
    (module.includes('network') && (subModule.includes('concurrency') || subModule.includes('security'))) ||
    title.includes('end-to-end') ||
    title.includes('atomic') ||
    title.includes('razorpay signature') ||
    title.includes('two users booking same slot') ||
    title.includes('slot ttl expires') ||
    title.includes('server-side price validation')
  )

  const isHard = (
    subModule.includes('qr scanner') ||
    subModule.includes('verify') ||
    subModule.includes('slot picker') ||
    subModule.includes('booking confirm') ||
    subModule.includes('payment processing') ||
    subModule.includes('booking confirmed') ||
    subModule.includes('booking detail') ||
    subModule.includes('rating screen') ||
    subModule.includes('earnings') ||
    (module.includes('admin panel') && subModule.includes('notifications') && title.includes('send'))
  )

  const isEasy = (
    title.includes('validation error') ||
    title.includes('validation error shown') ||
    title.includes('counter ') ||
    title.includes('badge') ||
    title.includes('shown') && title.includes('displayed') === false && !title.includes('flow') && !title.includes('payment') ||
    title.includes('label') ||
    title.includes('empty state') ||
    title.includes('navigate') ||
    title.includes('opens') ||
    title.includes('placeholder')
  )

  if (isComplex) return 'Complex'
  if (isHard) return 'Hard'
  if (isEasy) return 'Easy'
  if (priority === 'Critical') return 'Medium'
  if (priority === 'Low') return 'Easy'
  return 'Medium'
}

const rows = parsed.data.map((r) => {
  const out = {}
  for (const key of parsed.meta.fields) {
    out[key] = r[key] ?? ''
    // Insert Effort immediately after Type
    if (key === 'Type') out['Effort'] = classify(r)
  }
  return out
})

const fields = [...parsed.meta.fields]
const typeIdx = fields.indexOf('Type')
if (typeIdx >= 0) fields.splice(typeIdx + 1, 0, 'Effort')

const csv = Papa.unparse(rows, { columns: fields, header: true })
writeFileSync(OUT, csv)

const counts = rows.reduce((m, r) => {
  m[r.Effort] = (m[r.Effort] || 0) + 1
  return m
}, {})
console.log('Total rows:', rows.length)
console.log('Effort distribution:', counts)
console.log('Wrote:', OUT.pathname)
