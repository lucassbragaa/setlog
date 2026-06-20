import AsyncStorage from '@react-native-async-storage/async-storage';

import type { LoggedSet } from '../types/training';

const ACTIVE_SETS_KEY = '@setlog/active-sets/v1';

interface StoredSets {
  version: 1;
  updatedAt: string;
  sets: LoggedSet[];
}

function isStoredSets(value: unknown): value is StoredSets {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<StoredSets>;
  return candidate.version === 1 && Array.isArray(candidate.sets);
}

export async function loadActiveSets(): Promise<LoggedSet[] | null> {
  const raw = await AsyncStorage.getItem(ACTIVE_SETS_KEY);
  if (!raw) return null;

  const parsed: unknown = JSON.parse(raw);
  return isStoredSets(parsed) ? parsed.sets : null;
}

export async function saveActiveSets(sets: LoggedSet[]): Promise<void> {
  const payload: StoredSets = {
    version: 1,
    updatedAt: new Date().toISOString(),
    sets,
  };

  await AsyncStorage.setItem(ACTIVE_SETS_KEY, JSON.stringify(payload));
}
