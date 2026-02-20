import type { StreakData, StreakState, StreakChangeCallback } from '@/types/streak';
import { getJsonCookie, setJsonCookie } from '@/lib/cookieUtils';

const COOKIE_NAME = 'streak';

function getTodayDate(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getYesterdayDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export class StreakManager {
  private state: StreakState;
  private listeners: Set<StreakChangeCallback> = new Set();
  private celebrationTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    const saved = getJsonCookie<StreakData>(COOKIE_NAME);
    if (saved) {
      this.state = { ...saved, isNewStreakDay: false };
    } else {
      this.state = {
        currentStreak: 0,
        longestStreak: 0,
        lastDrawDate: '',
        drewToday: false,
        isNewStreakDay: false,
      };
    }
    this.checkStreakValidity();
  }

  /**
   * On app open, verify the streak is still valid.
   * If lastDrawDate is older than yesterday the streak has lapsed — reset it.
   * Also refresh `drewToday` for the current calendar day.
   */
  private checkStreakValidity(): void {
    const today = getTodayDate();
    const yesterday = getYesterdayDate();

    if (this.state.lastDrawDate === today) {
      this.state.drewToday = true;
      return;
    }

    // Not drawn today yet
    this.state.drewToday = false;

    if (this.state.lastDrawDate !== yesterday && this.state.lastDrawDate !== '') {
      // Streak has lapsed — reset
      this.state.currentStreak = 0;
    }
    this.persist();
  }

  /**
   * Record a drawing action. Idempotent per calendar day.
   * First call on a new day extends (or starts) the streak.
   */
  recordDraw(): void {
    const today = getTodayDate();

    if (this.state.lastDrawDate === today) {
      // Already recorded today — no-op
      return;
    }

    const yesterday = getYesterdayDate();

    if (this.state.lastDrawDate === yesterday) {
      // Consecutive day — extend streak
      this.state.currentStreak += 1;
    } else {
      // First draw ever, or streak lapsed — start fresh
      this.state.currentStreak = 1;
    }

    this.state.longestStreak = Math.max(this.state.currentStreak, this.state.longestStreak);
    this.state.lastDrawDate = today;
    this.state.drewToday = true;
    this.state.isNewStreakDay = true;

    this.persist();
    this.notifyListeners();

    // Auto-clear celebration flag after 3 seconds
    if (this.celebrationTimer) clearTimeout(this.celebrationTimer);
    this.celebrationTimer = setTimeout(() => {
      this.state.isNewStreakDay = false;
      this.notifyListeners();
    }, 3000);
  }

  getState(): StreakState {
    return { ...this.state };
  }

  subscribe(callback: StreakChangeCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(): void {
    const snapshot = this.getState();
    this.listeners.forEach((cb) => cb(snapshot));
  }

  private persist(): void {
    const data: StreakData = {
      currentStreak: this.state.currentStreak,
      longestStreak: this.state.longestStreak,
      lastDrawDate: this.state.lastDrawDate,
      drewToday: this.state.drewToday,
    };
    setJsonCookie(COOKIE_NAME, data);
  }

  destroy(): void {
    if (this.celebrationTimer) clearTimeout(this.celebrationTimer);
    this.listeners.clear();
  }
}
