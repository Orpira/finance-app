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

  expectedAmount: number;

  currency: string;

  country?: string;

  city?: string;

  notes?: string;

  reminders: AppointmentReminder[];

  completed: boolean;

  timerStartedAt?: string;

  timerStoppedAt?: string;

  actualDuration?: number;

  timerMode?: 'automatic' | 'manual' | 'manualPending';
}
