import {
  exportDatabaseSnapshot,
  importDatabaseSnapshot,
  type DatabaseSnapshot,
} from '../database/db'
import { downloadText } from '../utils/download'

export async function exportBackup() {
  const snapshot = await exportDatabaseSnapshot()
  const content = JSON.stringify(snapshot, null, 2)

  downloadText(content, 'backup.json', 'application/json')
}

export async function importBackup(file: File) {
  const content = await file.text()
  const snapshot = JSON.parse(content) as DatabaseSnapshot

  await importDatabaseSnapshot(snapshot)
}
