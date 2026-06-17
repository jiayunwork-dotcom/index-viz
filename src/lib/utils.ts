import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomFloat(min: number, max: number, decimals = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

export function randomString(length = 5): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function generateSequence(
  type: 'increasing' | 'decreasing' | 'random' | 'duplicates' | 'normal',
  count: number,
  min = 1,
  max = 100
): number[] {
  const result: number[] = [];
  switch (type) {
    case 'increasing':
      for (let i = 0; i < count; i++) result.push(min + i);
      break;
    case 'decreasing':
      for (let i = 0; i < count; i++) result.push(max - i);
      break;
    case 'random':
      for (let i = 0; i < count; i++) result.push(randomInt(min, max));
      break;
    case 'duplicates': {
      const unique = Math.max(1, Math.floor(count / 3));
      for (let i = 0; i < count; i++) {
        result.push(randomInt(min, min + unique - 1));
      }
      break;
    }
    case 'normal': {
      const mean = (min + max) / 2;
      const std = (max - min) / 6;
      for (let i = 0; i < count; i++) {
        const u1 = Math.random() || 1e-10;
        const u2 = Math.random();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        const val = Math.round(mean + z * std);
        result.push(Math.max(min, Math.min(max, val)));
      }
      break;
    }
  }
  return result;
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
