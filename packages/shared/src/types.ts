export interface Exercise {
  id: string;
  name: string;
  description: string;
  duration: number; // in seconds
  category: 'neck' | 'shoulders' | 'back' | 'hips' | 'wrists' | 'eyes';
  instructions: string[];
}

export interface ReliefEntry {
  date: string;
  painArea: string;
  beforePain: number; // 1-10
  afterPain: number; // 1-10
  exerciseIds: string[];
}

export type Theme = 'fast-wellness' | 'calm' | 'energizer';

export interface UserSettings {
  reminderInterval: number; // in minutes
  remindersEnabled: boolean;
  preferredDuration: number; // in minutes
  theme: Theme;
}

export type View = 'dashboard' | 'library' | 'progress' | 'settings';
