export interface ServiceIncome {
  id?: number;

  date: string;

  duration: number;

  totalAmount: number;

  currency: string;

  percentage: number;

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
}
