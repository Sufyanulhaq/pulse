import { useRef, useState } from 'react'
import { useData } from '../../state/DataContext.jsx'
import { useToast } from '../../state/ToastContext.jsx'
import { SESSION_COLUMNS, downloadText, toCSV } from '../../lib/csv.js'
import { Icon } from '../../components/Icon.jsx'

/** Download as CSV or JSON, or restore from a JSON backup. */
export function ExportMenu({ showImport = false }) {
  const { sessions, importSessions } = useData()
  const { toast } = useToast()
  const fileRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const stamp = new Date().toISOString().slice(0, 10)

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const parsed = JSON.parse(await file.text())
      const list = Array.isArray(parsed) ? parsed : parsed.sessions
      if (!Array.isArray(list)) throw new Error('That file has no list of sessions in it.')
      const r = await importSessions(list)
      toast(`Imported ${r.imported}. ${r.duplicates} already existed${r.invalid ? `, ${r.invalid} were not valid` : ''}.`, { tone: 'success' })
    } catch (err) {
      toast(err instanceof SyntaxError ? 'That file is not valid JSON.' : err.message, { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="row">
      <button
        className="btn btn-ghost btn-sm"
        type="button"
        disabled={!sessions.length}
        onClick={() => downloadText(`pulse-sessions-${stamp}.csv`, toCSV([...sessions].reverse(), SESSION_COLUMNS), 'text/csv')}
      >
        <Icon.Download width={15} height={15} /> CSV
      </button>
      <button
        className="btn btn-ghost btn-sm"
        type="button"
        disabled={!sessions.length}
        onClick={() => downloadText(`pulse-backup-${stamp}.json`, JSON.stringify({ exportedAt: new Date().toISOString(), sessions }, null, 2), 'application/json')}
      >
        <Icon.Download width={15} height={15} /> JSON
      </button>
      {showImport && (
        <>
          <button className="btn btn-ghost btn-sm" type="button" disabled={busy} onClick={() => fileRef.current?.click()}>
            <Icon.Upload width={15} height={15} /> {busy ? 'Importing…' : 'Import JSON'}
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onFile} />
        </>
      )}
    </div>
  )
}
