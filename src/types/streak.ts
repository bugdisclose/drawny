/** Cookie-persisted streak data */
export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastDrawDate: string; // YYYY-MM-DD in local timezone
  drewToday: boolean;
}

/** Reactive UI state — extends cookie data with animation flag */
export interface StreakState extends StreakData {
  isNewStreakDay: boolean; // true for ~3s when streak extends on a new day
}

export type StreakChangeCallback = (state: StreakState) => void;
