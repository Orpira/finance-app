import { db } from '../database/db'

export async function resetLocalAppForPinRecovery() {
  await db.delete()

  Object.keys(localStorage)
    .filter((key) => key.startsWith('finance-app:'))
    .forEach((key) => localStorage.removeItem(key))

  sessionStorage.clear()
}
