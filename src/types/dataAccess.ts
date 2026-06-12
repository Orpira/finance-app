export interface DateRange {
  from?: string
  to?: string
}

export interface ListOptions {
  newestFirst?: boolean
}

export interface DateRangeListOptions extends DateRange, ListOptions {}
