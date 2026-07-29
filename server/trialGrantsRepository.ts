export interface TrialGrantRow {
  deviceCode: string
  userCode: string | null
  issuedAt: string
  expiresAt: string
}

export interface TrialGrantsRepository {
  findByDeviceCode(deviceCode: string): Promise<TrialGrantRow | null>
  insert(row: TrialGrantRow): Promise<void>
}

/**
 * Doble en memoria para tests: implementa TrialGrantsRepository sin tocar
 * Neon, para que el servicio de trial se pueda probar en TDD de forma
 * determinista y sin infraestructura de base de datos en CI.
 */
export class InMemoryTrialGrantsRepository implements TrialGrantsRepository {
  private readonly rows = new Map<string, TrialGrantRow>()

  async findByDeviceCode(deviceCode: string): Promise<TrialGrantRow | null> {
    return this.rows.get(deviceCode) ?? null
  }

  async insert(row: TrialGrantRow): Promise<void> {
    if (this.rows.has(row.deviceCode)) {
      throw new Error(`Ya existe una fila de trial para ${row.deviceCode}.`)
    }
    this.rows.set(row.deviceCode, row)
  }

  count(): number {
    return this.rows.size
  }
}
