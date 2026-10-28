import type { ReliefEntry } from '@stretchly/shared';
import { toDateKey } from './formatDate';

/** Consecutive days with a session, ending today (or yesterday if none yet today). */
export function computeStreak(reliefData: ReliefEntry[]): number {
  const dates = new Set(reliefData.map((r) => r.date));
  let streak = 0;
  const cursor = new Date();
  if (!dates.has(toDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (dates.has(toDateKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
