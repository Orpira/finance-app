export type ExpenseType = 'gasto' | 'ajuste'

export interface Expense {
  id?: number;

  type: ExpenseType;

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

  exchangeRateUsed?: number;

  eurCopExchangeRateUsed?: number;

  relatedIncomeId?: number;

  earningPeriodId?: number;

  seasonPeriodId?: number;

  notes?: string;

  createdAt: string;

  country?: string;

  city?: string;
}
