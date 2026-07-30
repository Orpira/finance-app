import type {
  IncomeCalculationMethod,
  WorkedTimeUnit,
} from '../catalogs/incomeCalculationMethods'
import type { ReportStatusCode, ReportStatusLabel } from '../catalogs/reportStatuses'
import type { UsageMode } from './settings'

export type ServiceIncomeStatus = 'PENDIENTE' | 'EJECUCION' | 'FINALIZADO';
export type ServiceIncomeType = 'ingreso' | 'ajuste' | 'otro';
export type ServiceTimerStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'notified'
  | 'dismissed';

export interface ServiceIncome {
  id?: number;

  createdAt?: string;

  status?: ServiceIncomeStatus;

  type?: ServiceIncomeType;

  usageMode?: UsageMode;

  paymentType?: string;

  notes?: string;

  date: string;

  duration: number;

  durationLabel?: string;

  totalAmount: number;

  currency: string;

  percentage: number;

  earningPeriodId?: number;

  seasonPeriodId?: number;

  earningPercentage?: number;

  realGain: number;

  eurValue: number;

  copValue: number;

  exchangeRateUsed: number;

  baseCurrency?: string;

  secondaryCurrency?: string;

  baseCurrencyValue?: number;

  secondaryCurrencyValue?: number;

  exchangeRateBaseToSecondary?: number;

  timerStartedAt?: string;

  timerStoppedAt?: string;

  timerStatus?: ServiceTimerStatus;

  timerEndsAt?: string;

  timerCompletedAt?: string;

  whatsappNotifiedAt?: string;

  actualDuration?: number;

  country?: string;

  city?: string;

  reportStatusCode?: ReportStatusCode;
  reportStatusLabel?: ReportStatusLabel;
  reportedAt?: string;
  reportReference?: string;
  reportNotes?: string;

  /** Snapshot: método con el que se creó este ingreso (PB-IS-0007). Nunca se recalcula al editar Configuración. */
  incomeCalculationMethod?: IncomeCalculationMethod;

  /** Suma cacheada de los IncomeAdditional vinculados. */
  additionalsTotal?: number;

  /** totalAmount + additionalsTotal ("Total del ingreso" bruto). */
  totalIncome?: number;

  /** Solo 'hourly_workday': tiempo trabajado tal cual lo tecleó la usuaria, en workedTimeUnit. */
  workedTime?: number;

  /** Snapshot de la unidad usada para workedTime en este ingreso. */
  workedTimeUnit?: WorkedTimeUnit;

  /** workedTime ya convertido a horas (snapshot). */
  workedHours?: number;

  /** Valor por hora efectivamente aplicado a este ingreso (autocompletado desde Configuración, sobreescribible por ingreso). */
  hourlyRateApplied?: number;

  /** true si este ingreso inició el cronómetro de "Servicio por tiempo". */
  timerUsed?: boolean;

  updatedAt?: string;
}
