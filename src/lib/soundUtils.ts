/**
 * Sound utilities for ink meter notifications
 * Uses Web Audio API to generate simple notification sounds
 *
 * A single AudioContext is reused across all calls to avoid leaking
 * contexts (browsers limit simultaneous AudioContexts to ~6-8).
 */

let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    sharedAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  // Resume if suspended (browsers suspend contexts created before user gesture)
  if (sharedAudioContext.state === 'suspended') {
    sharedAudioContext.resume();
  }
  return sharedAudioContext;
}

/**
 * Play a pleasant "ding" sound when ink is full
 */
export function playInkFullSound(): void {
  try {
    const audioContext = getAudioContext();

    const playTone = (frequency: number, startTime: number, duration: number) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';

      // Envelope: quick attack, gentle decay
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };

    const now = audioContext.currentTime;
    // Two-tone ding: C6 -> E6 (pleasant, uplifting)
    playTone(1046.5, now, 0.15); // C6
    playTone(1318.5, now + 0.1, 0.2); // E6
  } catch (error) {
    console.warn('[Sound] Failed to play ink full sound:', error);
  }
}

/**
 * Play a subtle "empty" sound when ink runs out
 */
export function playInkEmptySound(): void {
  try {
    const audioContext = getAudioContext();

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.type = 'sine';

    const now = audioContext.currentTime;
    const duration = 0.3;

    // Descending frequency (E4 -> C4)
    oscillator.frequency.setValueAtTime(329.63, now); // E4
    oscillator.frequency.exponentialRampToValueAtTime(261.63, now + duration); // C4

    // Gentle envelope
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.2, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);

    oscillator.start(now);
    oscillator.stop(now + duration);
  } catch (error) {
    console.warn('[Sound] Failed to play ink empty sound:', error);
  }
}

/**
 * Request notification permission from the user
 * @returns Promise that resolves to true if permission granted
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('[Notification] Browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (error) {
      console.warn('[Notification] Failed to request permission:', error);
      return false;
    }
  }

  return false;
}

/**
 * Show a browser notification when ink is full
 */
export function showInkFullNotification(): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  try {
    const notification = new Notification('Ink Refilled!', {
      body: 'Your ink meter is full. Time to draw!',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'ink-full',
      requireInteraction: false,
      silent: true,
    });

    setTimeout(() => notification.close(), 4000);
  } catch (error) {
    console.warn('[Notification] Failed to show notification:', error);
  }
}
