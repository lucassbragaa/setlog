import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AppData, LoggedSet } from '../types/training';
import { isUpgradeableAppData, upgradeAppData } from './migrations';

const APP_DATA_KEY = '@setlog/app-data/v3';
const PREVIOUS_APP_DATA_KEY = '@setlog/app-data/v2';
const LEGACY_SETS_KEY = '@setlog/active-sets/v1';

function isAppData(value: unknown): value is AppData {
  return isUpgradeableAppData(value);
}

export async function loadAppData(): Promise<AppData | null> {
  const raw = await AsyncStorage.getItem(APP_DATA_KEY) ?? await AsyncStorage.getItem(PREVIOUS_APP_DATA_KEY);
  if (!raw) return null;
  const parsed: unknown = JSON.parse(raw);
  const upgraded = isAppData(parsed) ? upgradeAppData(parsed) : null;
  if (upgraded) await saveAppData(upgraded);
  return upgraded;
}

export async function loadLegacySets(): Promise<LoggedSet[] | null> {
  const raw = await AsyncStorage.getItem(LEGACY_SETS_KEY);
  if (!raw) return null;
  const parsed = JSON.parse(raw) as { sets?: LoggedSet[] };
  return Array.isArray(parsed.sets) ? parsed.sets : null;
}

export async function saveAppData(data: AppData): Promise<void> {
  await AsyncStorage.setItem(APP_DATA_KEY, JSON.stringify(data));
}
