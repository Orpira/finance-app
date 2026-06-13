export interface Appointment {
  id?: number;

  dateTime: string;

  duration: number;

  expectedAmount: number;

  currency: string;

  notes?: string;

  completed: boolean;

  timerStartedAt?: string;

  timerStoppedAt?: string;

  actualDuration?: number;

  timerMode?: 'automatic' | 'manual' | 'manualPending';
}
