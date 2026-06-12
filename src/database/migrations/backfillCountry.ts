import { db } from '../../database/db'
export async function backfillCountries() {
  const services = await db.services.toArray()
  const expenses = await db.expenses.toArray()

  // Force missing country to 'GB' per user request (use country code 'GB')
  const servicesToUpdate = services.filter((s) => !s.country).map((s) => ({
    ...s,
    country: 'GB',
  }))

  const expensesToUpdate = expenses.filter((e) => !e.country).map((e) => ({
    ...e,
    country: 'GB',
  }))

  await db.transaction('rw', [db.services, db.expenses], async () => {
    if (servicesToUpdate.length) {
      await db.services.bulkPut(servicesToUpdate)
    }

    if (expensesToUpdate.length) {
      await db.expenses.bulkPut(expensesToUpdate)
    }
  })

  return {
    servicesUpdated: servicesToUpdate.length,
    expensesUpdated: expensesToUpdate.length,
  }
}

export default backfillCountries
