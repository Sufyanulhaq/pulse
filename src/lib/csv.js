/**
 * Build CSV text. Cells that start with = + - @ (or a tab / carriage return)
 * get a leading apostrophe so a spreadsheet does not run them as formulas.
 */
export function csvCell(value) {
  if (value == null) return ''
  let text = String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  if (/[",\n\r]/.test(text)) text = `"${text.replace(/"/g, '""')}"`
  return text
}

export function toCSV(rows, columns) {
  const header = columns.map((c) => csvCell(c.label)).join(',')
  const body = rows.map((row) => columns.map((c) => csvCell(c.value(row))).join(','))
  return [header, ...body].join('\r\n')
}

export function downloadText(filename, text, type = 'text/plain') {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const SESSION_COLUMNS = [
  { label: 'Started', value: (s) => new Date(s.start).toISOString() },
  { label: 'Ended', value: (s) => new Date(s.end).toISOString() },
  { label: 'Focused minutes', value: (s) => s.minutes },
  { label: 'Planned minutes', value: (s) => s.planned },
  { label: 'Label', value: (s) => s.label },
  { label: 'Tag', value: (s) => s.tag },
  { label: 'Interruptions', value: (s) => s.interruptions },
  { label: 'Finished', value: (s) => (s.completed ? 'yes' : 'no') },
]
