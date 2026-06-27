import type { UsageMode } from './settings'

export type ServiceIncomeStatus = 'PENDIENTE' | 'EJECUCION' | 'FINALIZADO';
export type ServiceIncomeType = 'ingreso' | 'ajuste' | 'otro';

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

  actualDuration?: number;

  country?: string;

  city?: string;
}
