import Dexie, { type EntityTable } from 'dexie';
import type { Action, ChatMessage, CheckIn, Goal, Note, Pillar, Settings, Task } from './types';

export class YourselfDB extends Dexie {
  goal!: EntityTable<Goal, 'id'>;
  pillars!: EntityTable<Pillar, 'id'>;
  actions!: EntityTable<Action, 'id'>;
  checkins!: EntityTable<CheckIn, 'id'>;
  tasks!: EntityTable<Task, 'id'>;
  notes!: EntityTable<Note, 'id'>;
  chat!: EntityTable<ChatMessage, 'id'>;
  settings!: EntityTable<Settings, 'id'>;

  constructor(name = 'yourself') {
    super(name);
    this.version(1).stores({
      goal: 'id',
      pillars: 'id, index',
      actions: 'id, pillarId, index',
      checkins: 'id, actionId, date',
      tasks: 'id, done, due, pillarId, createdAt',
      notes: 'id, pillarId, createdAt',
      chat: 'id, createdAt',
      settings: 'id',
    });
  }
}

export const db = new YourselfDB();

export type TableName = 'goal' | 'pillars' | 'actions' | 'checkins' | 'tasks' | 'notes' | 'chat' | 'settings';
export const TABLES: TableName[] = ['goal', 'pillars', 'actions', 'checkins', 'tasks', 'notes', 'chat', 'settings'];

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  name: '',
  theme: 'system',
  model: 'gemma3-1b-it-q4f16_1-MLC',
  aiEnabled: false,
  onboarded: false,
};

export async function getSettings(d: YourselfDB = db): Promise<Settings> {
  return (await d.settings.get('settings')) ?? DEFAULT_SETTINGS;
}
