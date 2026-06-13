export interface Expense {
  id?: number;

  date: string;

  category: string;

  amount: number;

  currency: string;

  eurValue: number;

  copValue: number;

  baseCurrency?: string;

  secondaryCurrency?: string;

  baseCurrencyValue?: number;

  secondaryCurrencyValue?: number;

  exchangeRateBaseToSecondary?: number;

  country?: string;

  city?: string;
}
