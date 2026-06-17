import { create } from 'zustand';

export interface AnimationFrame<T = any> {
  id: string;
  data: T;
  description: string;
}

interface AnimationState {
  isPlaying: boolean;
  currentFrame: number;
  speed: number;
  frames: AnimationFrame[];
  setPlaying: (playing: boolean) => void;
  setSpeed: (speed: number) => void;
  setFrames: <T>(frames: AnimationFrame<T>[]) => void;
  nextFrame: () => void;
  prevFrame: () => void;
  reset: () => void;
  goToFrame: (index: number) => void;
}

export const useAnimationStore = create<AnimationState>((set, get) => ({
  isPlaying: false,
  currentFrame: 0,
  speed: 1,
  frames: [],
  setPlaying: (playing) => set({ isPlaying: playing }),
  setSpeed: (speed) => set({ speed }),
  setFrames: (frames) => set({ frames, currentFrame: 0, isPlaying: false }),
  nextFrame: () => {
    const { currentFrame, frames } = get();
    if (currentFrame < frames.length - 1) {
      set({ currentFrame: currentFrame + 1 });
    } else {
      set({ isPlaying: false });
    }
  },
  prevFrame: () => {
    const { currentFrame } = get();
    if (currentFrame > 0) {
      set({ currentFrame: currentFrame - 1 });
    }
  },
  reset: () => set({ currentFrame: 0, isPlaying: false }),
  goToFrame: (index) => set({ currentFrame: Math.max(0, Math.min(get().frames.length - 1, index)) }),
}));
