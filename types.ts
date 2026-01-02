
export type DayType = 'Saturday' | 'Sunday';
export type RecurringType = 'none' | 'weekly' | 'monthly';

export interface WeekendDay {
  id: string; // date string YYYY-MM-DD
  date: Date;
  type: DayType;
  plan: string;
  isBusy: boolean;
  isSupport: boolean;
  recurring: RecurringType;
}

export interface RecurringSupportSettings {
  saturday: boolean;
  sunday: boolean;
  interval: number; // e.g., every 1, 2, or 3 weeks
  baseDate: string; // ISO string to anchor the interval calculation
  customBg?: string; // Base64 or URL for custom background
}

export interface AppState {
  weekendDays: Record<string, WeekendDay>;
  recurringSupport: RecurringSupportSettings;
}
