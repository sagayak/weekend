import { describe, it, expect } from 'vitest';
import { isDateSupport, getWeekMonday } from './utils';
import { RecurringSupportSettings } from './types';

describe('getWeekMonday', () => {
  it('returns Monday for a given Monday', () => {
    const monday = new Date('2023-10-23'); // A Monday
    const result = getWeekMonday(monday);
    expect(result.getDay()).toBe(1);
    expect(result.toISOString().split('T')[0]).toBe('2023-10-23');
  });

  it('returns Monday for a given Tuesday', () => {
    const tuesday = new Date('2023-10-24');
    const result = getWeekMonday(tuesday);
    expect(result.getDay()).toBe(1);
    expect(result.toISOString().split('T')[0]).toBe('2023-10-23');
  });

  it('returns previous Monday for Sunday', () => {
    const sunday = new Date('2023-10-29'); // Sunday of the same week
    const result = getWeekMonday(sunday);
    expect(result.getDay()).toBe(1);
    expect(result.toISOString().split('T')[0]).toBe('2023-10-23');
  });
});

describe('isDateSupport', () => {
  const baseSettings: RecurringSupportSettings = {
    saturday: true,
    sunday: true,
    interval: 1,
    baseDate: '2023-10-23', // Monday
  };

  it('returns true for every week when interval is 1', () => {
    expect(isDateSupport(new Date('2023-10-23'), baseSettings)).toBe(true); // Same week
    expect(isDateSupport(new Date('2023-10-30'), baseSettings)).toBe(true); // Next week
  });

  it('handles interval of 2', () => {
    const settings = { ...baseSettings, interval: 2 };
    expect(isDateSupport(new Date('2023-10-23'), settings)).toBe(true); // Base week
    expect(isDateSupport(new Date('2023-10-30'), settings)).toBe(false); // Next week (skip)
    expect(isDateSupport(new Date('2023-11-06'), settings)).toBe(true); // Week after (active)
  });

  it('handles interval of 3', () => {
    const settings = { ...baseSettings, interval: 3 };
    expect(isDateSupport(new Date('2023-10-23'), settings)).toBe(true);
    expect(isDateSupport(new Date('2023-10-30'), settings)).toBe(false);
    expect(isDateSupport(new Date('2023-11-06'), settings)).toBe(false);
    expect(isDateSupport(new Date('2023-11-13'), settings)).toBe(true);
  });
});
