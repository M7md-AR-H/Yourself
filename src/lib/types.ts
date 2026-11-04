// Core data model. Everything lives in IndexedDB on the device (local-first).

export type ID = string;

/** The centre of the mandala chart: one main goal. Singleton row with id "goal". */
export interface Goal {
  id: 'goal';
  title: string;
  updatedAt: number;
}

/** One of the 8 things the goal depends on (ring around the centre). index 0..7 */
export interface Pillar {
  id: ID;
  index: number;
  title: string;
  updatedAt: number;
}

/** One of the 8 small actions inside a pillar block. index 0..7 */
export interface Action {
  id: ID;
  pillarId: ID;
  index: number;
  title: string;
  updatedAt: number;
}

/** "I did <action> on <date>". One row per action per day. */
export interface CheckIn {
  id: ID; // `${actionId}:${date}`
  actionId: ID;
  date: string; // YYYY-MM-DD (local)
  createdAt: number;
}

export interface Task {
  id: ID;
  title: string;
  due?: string; // YYYY-MM-DD
  done: boolean;
  doneAt?: number;
  pillarId?: ID;
  actionId?: ID;
  createdAt: number;
  updatedAt: number;
}

export interface Note {
  id: ID;
  text: string;
  pillarId?: ID;
  source: 'chat' | 'manual';
  createdAt: number;
  updatedAt: number;
}

export interface ChatMessage {
  id: ID;
  role: 'user' | 'assistant';
  text: string;
  /** Human summary of what the AI changed ("Added task …"). */
  effects?: string[];
  createdAt: number;
}

export type ThemePref = 'system' | 'light' | 'dark';
export type ModelId = 'gemma3-1b-it-q4f16_1-MLC' | 'gemma-2-2b-it-q4f16_1-MLC' | 'gemma-4-E2B-it-q4f16_1-MLC';

export interface Settings {
  id: 'settings';
  name: string;
  theme: ThemePref;
  model: ModelId;
  /** User opted in to download + run the local model. */
  aiEnabled: boolean;
  onboarded: boolean;
}

export type Page = 'today' | 'chart' | 'review' | 'notes' | 'chat' | 'settings' | 'help';
