import { Link } from 'react-router-dom'
import { Glyph } from './Glyph'

export function SyncChip({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; title: string }> = {
    local: { label: 'Local', cls: '', title: 'Progress is saved in this browser' },
    'signed-out': { label: 'Not synced', cls: 'chip-warn', title: 'Supabase is configured — sign in under Settings to sync' },
    syncing: { label: 'Syncing', cls: 'chip-accent', title: 'Saving to Supabase' },
    synced: { label: 'Synced', cls: 'chip-good', title: 'Saved to Supabase' },
    error: { label: 'Sync error', cls: 'chip-red', title: 'Could not reach Supabase — progress is still saved locally' },
  }
  const m = map[status] ?? map.local
  return (
    <Link to="/settings" className={`chip ${m.cls}`} title={m.title}>
      <Glyph name={status === 'local' ? 'dot' : 'sync'} size={10} />
      {m.label}
    </Link>
  )
}
