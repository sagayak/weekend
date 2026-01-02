import { RecurringSupportSettings } from './types';

export const getWeekMonday = (d: Date): Date => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
};

export const isDateSupport = (targetDate: Date, settings: RecurringSupportSettings): boolean => {
  const { interval, baseDate } = settings;
  const startMonday = getWeekMonday(new Date(baseDate));
  const targetMonday = getWeekMonday(targetDate);

  // Calculate absolute week difference between the starting week and target week
  const diffWeeks = Math.round((targetMonday.getTime() - startMonday.getTime()) / (7 * 24 * 60 * 60 * 1000));

  // Check if this week falls on the frequency cycle
  return Math.abs(diffWeeks) % (interval || 1) === 0;
};
