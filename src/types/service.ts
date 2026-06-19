export type ServiceIncomeStatus = 'PENDIENTE' | 'EJECUCION' | 'FINALIZADO';

export interface ServiceIncome {
  id?: number;

  createdAt?: string;

  status?: ServiceIncomeStatus;

  paymentType?: string;

  date: string;

  duration: number;

  totalAmount: number;

  currency: string;

  percentage: number;

  earningPeriodId?: number;

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
