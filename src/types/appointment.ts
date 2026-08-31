import type { ReportStatusCode, ReportStatusLabel } from '../catalogs/reportStatuses'
import type { IncomeCalculationMethod, WorkedTimeUnit } from '../catalogs/incomeCalculationMethods'

export type AppointmentReminderUnit = 'minutes' | 'hours' | 'days';

export type AppointmentReminderType = 'local' | 'inApp';

export interface AppointmentReminder {
  id: string;

  amount: number;

  unit: AppointmentReminderUnit;

  type: AppointmentReminderType;
}

export interface Appointment {
  id?: number;

  dateTime: string;

  duration: number;

  durationLabel?: string;

  expectedAmount: number;

  currency: string;

  paymentType?: string;

  /** Snapshot: método vigente en Configuración al crear la cita (PB-IS-0007/Agenda). Nunca se recalcula al editar Configuración ni al editar la cita. */
  incomeCalculationMethod?: IncomeCalculationMethod;

  /** Solo 'hourly_workday': tiempo trabajado tal cual lo tecleó la profesional, en workedTimeUnit. Nunca medido por cronómetro. */
  workedTime?: number;

  /** Snapshot de la unidad con la que se registró el tiempo trabajado. */
  workedTimeUnit?: WorkedTimeUnit;

  /** Solo 'hourly_workday': valor por hora aplicado (snapshot desde Configuración al crear la cita). */
  hourlyRateApplied?: number;

  country?: string;

  city?: string;

  earningPeriodId?: number;

  seasonPeriodId?: number;

  notes?: string;

  reminders: AppointmentReminder[];

  completed: boolean;

  timerStartedAt?: string;

  timerStoppedAt?: string;

  actualDuration?: number;

  timerMode?: 'automatic' | 'manual' | 'manualPending';

  reportStatusCode?: ReportStatusCode;
  reportStatusLabel?: ReportStatusLabel;
  reportedAt?: string;
}
