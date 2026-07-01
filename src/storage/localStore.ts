import AsyncStorage from '@react-native-async-storage/async-storage';

import { AppData } from '../domain/types';
import { defaultAppData } from '../domain/seeds';

const STORAGE_KEY = '@setlog/hevy-core/v1';

const mergeWithDefaults = (rawData: Partial<AppData>): AppData => {
  const defaults = defaultAppData();

  return {
    ...defaults,
    ...rawData,
    settings: {
      ...defaults.settings,
      ...(rawData.settings ?? {}),
    },
    exercise_templates:
      rawData.exercise_templates && rawData.exercise_templates.length > 0
        ? rawData.exercise_templates
        : defaults.exercise_templates,
    routines: rawData.routines && rawData.routines.length > 0 ? rawData.routines : defaults.routines,
    routine_folders:
      rawData.routine_folders && rawData.routine_folders.length > 0 ? rawData.routine_folders : defaults.routine_folders,
    workouts: rawData.workouts ?? defaults.workouts,
    active_workout: rawData.active_workout ?? defaults.active_workout,
    body_measurements: rawData.body_measurements ?? defaults.body_measurements,
  };
};

export const loadAppData = async (): Promise<AppData> => {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);

  if (!raw) return defaultAppData();

  try {
    return mergeWithDefaults(JSON.parse(raw) as Partial<AppData>);
  } catch {
    return defaultAppData();
  }
};

export const saveAppData = async (data: AppData) => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export const resetAppData = async () => {
  const defaults = defaultAppData();
  await saveAppData(defaults);
  return defaults;
};
