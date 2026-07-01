import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  addTemplateToWorkout,
  completedSets,
  completedWorkouts,
  exerciseStats,
  formatDate,
  formatDateTime,
  formatDuration,
  muscleDistribution,
  previousSetsForExercise,
  workoutDurationSeconds,
  workoutSetCount,
  workoutVolume,
} from './src/domain/metrics';
import {
  cloneRoutineToWorkout,
  equipmentLabels,
  exerciseTypeLabels,
  muscleLabels,
  setTypeLabels,
} from './src/domain/seeds';
import { AppData, ExerciseTemplate, Routine, SetType, TrainingSet, Workout, WorkoutExercise } from './src/domain/types';
import { loadAppData, resetAppData, saveAppData } from './src/storage/localStore';

type Tab = 'workout' | 'routines' | 'exercises' | 'profile';
type SheetMode = 'none' | 'add-exercise' | 'exercise-detail' | 'finish-workout';

const colors = {
  bg: '#050505',
  panel: '#101114',
  panel2: '#17191F',
  panel3: '#22242B',
  text: '#F5F5F7',
  muted: '#9A9AA2',
  subtle: '#696A72',
  border: '#2C2E36',
  blue: '#2F80FF',
  blueSoft: '#102648',
  green: '#36D399',
  red: '#FF5C5C',
  yellow: '#F5C542',
};

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'workout', label: 'Workout', icon: '＋' },
  { id: 'routines', label: 'Routines', icon: '▦' },
  { id: 'exercises', label: 'Exercises', icon: '⌕' },
  { id: 'profile', label: 'Profile', icon: '◉' },
];

const setTypes: SetType[] = ['normal', 'warmup', 'failure', 'dropset'];

const numericValue = (value: string) => {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

const parseDateInput = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed;
};

const dateInputValue = (iso?: string) => {
  const date = iso ? new Date(iso) : new Date();
  if (Number.isNaN(date.getTime())) return dateInputValue();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const makeSet = (index: number, type: SetType, weight: number | null, reps: number | null, rpe: number | null): TrainingSet => ({
  id: `set-${Date.now()}-${index}`,
  index,
  type,
  weight_kg: weight,
  reps,
  distance_meters: null,
  duration_seconds: null,
  custom_metric: null,
  rpe,
  completed_at: new Date().toISOString(),
});

const formatKg = (value: number | null) => (value === null ? '—' : `${value.toLocaleString('pt-BR')} kg`);

const formatNumber = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 0 });

export default function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('workout');
  const [sheetMode, setSheetMode] = useState<SheetMode>('none');
  const [selectedExercise, setSelectedExercise] = useState<ExerciseTemplate | null>(null);
  const [selectedExerciseTargetId, setSelectedExerciseTargetId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [muscleFilter, setMuscleFilter] = useState<string>('all');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    loadAppData().then(loaded => {
      setData(loaded);
      setIsLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!data || !isLoaded) return;

    const handle = setTimeout(() => {
      saveAppData(data).then(() => setLastSavedAt(new Date().toISOString()));
    }, 250);

    return () => clearTimeout(handle);
  }, [data, isLoaded]);

  const templatesById = useMemo(() => {
    const map = new Map<string, ExerciseTemplate>();
    data?.exercise_templates.forEach(template => map.set(template.id, template));
    return map;
  }, [data?.exercise_templates]);

  if (!data) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar style="light" />
        <View style={styles.loading}>
          <Text style={styles.loadingLogo}>SETLOG</Text>
          <Text style={styles.loadingTitle}>Carregando seu log...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const patchData = (updater: (current: AppData) => AppData) => {
    setData(current => (current ? updater(current) : current));
  };

  const updateActiveWorkout = (updater: (workout: Workout) => Workout) => {
    patchData(current => {
      if (!current.active_workout) return current;

      return {
        ...current,
        active_workout: updater(current.active_workout),
      };
    });
  };

  const startRoutine = (routine: Routine) => {
    patchData(current => ({
      ...current,
      active_workout: cloneRoutineToWorkout(routine),
    }));
    setActiveTab('workout');
  };

  const startEmpty = () => {
    const timestamp = new Date().toISOString();
    patchData(current => ({
      ...current,
      active_workout: {
        id: `workout-${Date.now()}`,
        title: 'Empty Workout',
        routine_id: null,
        description: '',
        start_time: timestamp,
        end_time: null,
        created_at: timestamp,
        updated_at: timestamp,
        exercises: [],
      },
    }));
    setActiveTab('workout');
  };

  const finishWorkout = (title: string, date: string, description: string) => {
    patchData(current => {
      if (!current.active_workout) return current;

      const start = new Date(current.active_workout.start_time);
      const chosenDate = parseDateInput(date);
      const finishedAt = new Date();
      const activeDurationMs = Math.max(0, finishedAt.getTime() - start.getTime());
      const normalizedStart =
        chosenDate === null || Number.isNaN(start.getTime())
          ? current.active_workout.start_time
          : new Date(
              chosenDate.getFullYear(),
              chosenDate.getMonth(),
              chosenDate.getDate(),
              start.getHours(),
              start.getMinutes(),
            ).toISOString();

      const finishedWorkout: Workout = {
        ...current.active_workout,
        title: title.trim() || current.active_workout.title,
        description,
        start_time: normalizedStart,
        end_time: new Date(new Date(normalizedStart).getTime() + activeDurationMs).toISOString(),
        updated_at: new Date().toISOString(),
        exercises: current.active_workout.exercises.map(exercise => ({
          ...exercise,
          sets: exercise.sets.filter(set => Boolean(set.completed_at)),
        })),
      };

      return {
        ...current,
        active_workout: null,
        workouts: [finishedWorkout, ...current.workouts],
      };
    });
    setSheetMode('none');
  };

  const addExercise = (template: ExerciseTemplate) => {
    if (selectedExerciseTargetId) {
      patchData(current => ({
        ...current,
        routines: current.routines.map(routine => {
          if (routine.id !== selectedExerciseTargetId) return routine;

          return {
            ...routine,
            updated_at: new Date().toISOString(),
            exercises: [
              ...routine.exercises,
              {
                id: `routine-exercise-${Date.now()}`,
                index: routine.exercises.length + 1,
                exercise_template_id: template.id,
                title: template.title,
                superset_id: null,
                rest_seconds: current.settings.default_rest_seconds,
                notes: '',
                sets: [],
              },
            ],
          };
        }),
      }));
      setSelectedExerciseTargetId(null);
    } else {
      updateActiveWorkout(workout => addTemplateToWorkout(workout, template));
    }

    setSheetMode('none');
  };

  const completeSet = (
    exerciseId: string,
    setType: SetType,
    weight: number | null,
    reps: number | null,
    rpe: number | null,
  ) => {
    updateActiveWorkout(workout => ({
      ...workout,
      updated_at: new Date().toISOString(),
      exercises: workout.exercises.map(exercise => {
        if (exercise.id !== exerciseId) return exercise;

        return {
          ...exercise,
          sets: [...exercise.sets, makeSet(completedSets(exercise.sets).length + 1, setType, weight, reps, rpe)],
        };
      }),
    }));
  };

  const removeSet = (exerciseId: string, setId: string) => {
    updateActiveWorkout(workout => ({
      ...workout,
      exercises: workout.exercises.map(exercise => {
        if (exercise.id !== exerciseId) return exercise;

        return {
          ...exercise,
          sets: exercise.sets.filter(set => set.id !== setId).map((set, index) => ({ ...set, index: index + 1 })),
        };
      }),
    }));
  };

  const moveRoutineExercise = (routineId: string, exerciseId: string, direction: -1 | 1) => {
    patchData(current => ({
      ...current,
      routines: current.routines.map(routine => {
        if (routine.id !== routineId) return routine;

        const currentIndex = routine.exercises.findIndex(exercise => exercise.id === exerciseId);
        const nextIndex = currentIndex + direction;
        if (currentIndex < 0 || nextIndex < 0 || nextIndex >= routine.exercises.length) return routine;

        const exercises = [...routine.exercises];
        const [item] = exercises.splice(currentIndex, 1);
        exercises.splice(nextIndex, 0, item);

        return {
          ...routine,
          updated_at: new Date().toISOString(),
          exercises: exercises.map((exercise, index) => ({ ...exercise, index: index + 1 })),
        };
      }),
    }));
  };

  const renameRoutine = (routineId: string, title: string) => {
    patchData(current => ({
      ...current,
      routines: current.routines.map(routine =>
        routine.id === routineId ? { ...routine, title, updated_at: new Date().toISOString() } : routine,
      ),
    }));
  };

  const createRoutine = () => {
    patchData(current => ({
      ...current,
      routines: [
        {
          id: `routine-${Date.now()}`,
          title: 'New Routine',
          folder_id: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          exercises: [],
        },
        ...current.routines,
      ],
    }));
    setActiveTab('routines');
  };

  const openExerciseDetail = (template: ExerciseTemplate) => {
    setSelectedExercise(template);
    setSheetMode('exercise-detail');
  };

  const openAddExercise = (routineId: string | null = null) => {
    setSelectedExerciseTargetId(routineId);
    setSheetMode('add-exercise');
  };

  const renderedTab = {
    workout: (
      <WorkoutScreen
        data={data}
        templatesById={templatesById}
        onStartEmpty={startEmpty}
        onStartRoutine={startRoutine}
        onAddExercise={() => openAddExercise(null)}
        onCompleteSet={completeSet}
        onRemoveSet={removeSet}
        onFinish={() => setSheetMode('finish-workout')}
      />
    ),
    routines: (
      <RoutinesScreen
        data={data}
        onStartRoutine={startRoutine}
        onCreateRoutine={createRoutine}
        onRenameRoutine={renameRoutine}
        onAddExercise={openAddExercise}
        onMoveExercise={moveRoutineExercise}
      />
    ),
    exercises: (
      <ExercisesScreen
        data={data}
        search={search}
        muscleFilter={muscleFilter}
        onSearch={setSearch}
        onMuscleFilter={setMuscleFilter}
        onOpenExercise={openExerciseDetail}
      />
    ),
    profile: (
      <ProfileScreen
        data={data}
        lastSavedAt={lastSavedAt}
        onReset={() => {
          if (Platform.OS === 'web' && typeof window !== 'undefined' && !window.confirm('Resetar todos os dados locais do Setlog neste aparelho?')) {
            return;
          }

          resetAppData().then(setData);
        }}
        onUpdateSettings={settings => patchData(current => ({ ...current, settings: { ...current.settings, ...settings } }))}
      />
    ),
  }[activeTab];

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.phoneFrame}>
        <View style={styles.content}>{renderedTab}</View>
        <View style={styles.tabBar}>
          {tabs.map(tab => (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={[styles.tabButton, activeTab === tab.id && styles.tabButtonActive]}
            >
              <Text style={[styles.tabIcon, activeTab === tab.id && styles.tabTextActive]}>{tab.icon}</Text>
              <Text style={[styles.tabLabel, activeTab === tab.id && styles.tabTextActive]}>{tab.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ExercisePickerSheet
        visible={sheetMode === 'add-exercise'}
        data={data}
        search={search}
        muscleFilter={muscleFilter}
        onSearch={setSearch}
        onMuscleFilter={setMuscleFilter}
        onClose={() => {
          setSheetMode('none');
          setSelectedExerciseTargetId(null);
        }}
        onSelect={addExercise}
      />

      <ExerciseDetailSheet
        visible={sheetMode === 'exercise-detail' && selectedExercise !== null}
        data={data}
        template={selectedExercise}
        onClose={() => setSheetMode('none')}
      />

      <FinishWorkoutSheet
        visible={sheetMode === 'finish-workout' && data.active_workout !== null}
        workout={data.active_workout}
        onClose={() => setSheetMode('none')}
        onFinish={finishWorkout}
      />
    </SafeAreaView>
  );
}

function WorkoutScreen({
  data,
  templatesById,
  onStartEmpty,
  onStartRoutine,
  onAddExercise,
  onCompleteSet,
  onRemoveSet,
  onFinish,
}: {
  data: AppData;
  templatesById: Map<string, ExerciseTemplate>;
  onStartEmpty: () => void;
  onStartRoutine: (routine: Routine) => void;
  onAddExercise: () => void;
  onCompleteSet: (exerciseId: string, setType: SetType, weight: number | null, reps: number | null, rpe: number | null) => void;
  onRemoveSet: (exerciseId: string, setId: string) => void;
  onFinish: () => void;
}) {
  const workout = data.active_workout;

  if (!workout) {
    return (
      <ScreenScroll>
        <HeroHeader eyebrow="Start Workout" title="Workout" subtitle="Comece vazio ou escolha uma rotina. O treino vira um log salvo ao finalizar." />
        <PrimaryButton label="Start Empty Workout" onPress={onStartEmpty} />

        <SectionHeader title="Routines" action="Manage templates in Routines" />
        <View style={styles.cardGrid}>
          {data.routines.map(routine => (
            <Pressable key={routine.id} style={styles.routineLaunchCard} onPress={() => onStartRoutine(routine)}>
              <Text style={styles.cardTitle}>{routine.title}</Text>
              <Text style={styles.cardSubtitle}>
                {routine.exercises.length} exercícios · {routine.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0)} sets planejados
              </Text>
              <Text style={styles.blueLink}>Start Routine</Text>
            </Pressable>
          ))}
        </View>

        <RecentWorkouts data={data} />
      </ScreenScroll>
    );
  }

  return (
    <ScreenScroll>
      <View style={styles.activeHeader}>
        <View>
          <Text style={styles.kicker}>Active Workout</Text>
          <Text style={styles.screenTitle}>{workout.title}</Text>
          <Text style={styles.screenSubtitle}>{formatDuration(workoutDurationSeconds(workout))} · {workoutSetCount(workout)} sets</Text>
        </View>
        <Pressable style={styles.finishButton} onPress={onFinish}>
          <Text style={styles.finishText}>Finish</Text>
        </Pressable>
      </View>

      <View style={styles.statRow}>
        <MiniStat label="Volume" value={`${formatNumber(workoutVolume(workout))} kg`} />
        <MiniStat label="Exercises" value={String(workout.exercises.length)} />
        <MiniStat label="Date" value={formatDate(workout.start_time)} />
      </View>

      {workout.exercises.length === 0 ? (
        <EmptyCard title="Sem exercícios ainda" copy="Adicione um exercício para começar a logar os sets." />
      ) : (
        workout.exercises.map(exercise => (
          <WorkoutExerciseCard
            key={exercise.id}
            data={data}
            workout={workout}
            exercise={exercise}
            template={templatesById.get(exercise.exercise_template_id)}
            onCompleteSet={onCompleteSet}
            onRemoveSet={onRemoveSet}
          />
        ))
      )}

      <Pressable style={styles.addExerciseButton} onPress={onAddExercise}>
        <Text style={styles.addExerciseText}>＋ Add Exercise</Text>
      </Pressable>
    </ScreenScroll>
  );
}

function WorkoutExerciseCard({
  data,
  workout,
  exercise,
  template,
  onCompleteSet,
  onRemoveSet,
}: {
  data: AppData;
  workout: Workout;
  exercise: WorkoutExercise;
  template?: ExerciseTemplate;
  onCompleteSet: (exerciseId: string, setType: SetType, weight: number | null, reps: number | null, rpe: number | null) => void;
  onRemoveSet: (exerciseId: string, setId: string) => void;
}) {
  const previous = previousSetsForExercise(data, exercise.exercise_template_id, workout.routine_id);
  const nextPrevious = previous[completedSets(exercise.sets).length];
  const [setType, setSetType] = useState<SetType>('normal');
  const [weight, setWeight] = useState(nextPrevious?.weight_kg?.toString() ?? '');
  const [reps, setReps] = useState(nextPrevious?.reps?.toString() ?? '');
  const [rpe, setRpe] = useState(nextPrevious?.rpe?.toString() ?? '');

  useEffect(() => {
    setWeight(nextPrevious?.weight_kg?.toString() ?? '');
    setReps(nextPrevious?.reps?.toString() ?? '');
    setRpe(nextPrevious?.rpe?.toString() ?? '');
  }, [nextPrevious?.id]);

  const columns = template?.type ?? 'weight_reps';
  const showWeight = columns === 'weight_reps' || columns === 'weight_duration' || columns === 'short_distance_weight';
  const showReps = columns === 'weight_reps' || columns === 'reps_only' || columns === 'bodyweight_reps' || columns === 'bodyweight_assisted_reps';

  const submit = () => {
    onCompleteSet(exercise.id, setType, showWeight ? numericValue(weight) : null, showReps ? numericValue(reps) : null, numericValue(rpe));
    setWeight(weight || nextPrevious?.weight_kg?.toString() || '');
    setReps('');
    setRpe('');
    setSetType('normal');
  };

  const applyPrevious = () => {
    setWeight(nextPrevious?.weight_kg?.toString() ?? '');
    setReps(nextPrevious?.reps?.toString() ?? '');
    setRpe(nextPrevious?.rpe?.toString() ?? '');
  };

  return (
    <View style={styles.exerciseCard}>
      <View style={styles.exerciseTop}>
        <View>
          <Text style={styles.exerciseTitle}>{exercise.title}</Text>
          <Text style={styles.exerciseMeta}>
            {template ? `${muscleLabels[template.primary_muscle_group]} · ${exerciseTypeLabels[template.type]}` : 'Custom'}
          </Text>
        </View>
        <Text style={styles.exerciseMenu}>•••</Text>
      </View>

      {exercise.notes ? <Text style={styles.exerciseNote}>{exercise.notes}</Text> : null}

      <View style={styles.tableHeader}>
        <Text style={[styles.tableCell, styles.tableTiny]}>SET</Text>
        <Text style={[styles.tableCell, styles.tablePrevious]}>PREVIOUS</Text>
        {showWeight ? <Text style={styles.tableCell}>KG</Text> : null}
        {showReps ? <Text style={styles.tableCell}>REPS</Text> : null}
        <Text style={styles.tableCell}>RPE</Text>
        <Text style={[styles.tableCell, styles.tableCheck]}>✓</Text>
      </View>

      {completedSets(exercise.sets).map((set, index) => (
        <View key={set.id} style={styles.tableRow}>
          <Pill label={setTypeLabels[set.type]} tone={set.type === 'normal' ? 'neutral' : set.type === 'dropset' ? 'yellow' : 'blue'} />
          <Text style={[styles.tableCell, styles.tablePrevious]}>{previous[index] ? previousSetLabel(previous[index]) : '—'}</Text>
          {showWeight ? <Text style={styles.tableCell}>{set.weight_kg ?? '—'}</Text> : null}
          {showReps ? <Text style={styles.tableCell}>{set.reps ?? '—'}</Text> : null}
          <Text style={styles.tableCell}>{set.rpe ?? '—'}</Text>
          <Pressable style={styles.removeSet} onPress={() => onRemoveSet(exercise.id, set.id)}>
            <Text style={styles.removeSetText}>×</Text>
          </Pressable>
        </View>
      ))}

      <View style={styles.previousBlock}>
        <Text style={styles.previousBlockTitle}>Previous set {completedSets(exercise.sets).length + 1}</Text>
        <Pressable onPress={applyPrevious}>
          <Text style={styles.previousBlockValue}>{nextPrevious ? previousSetLabel(nextPrevious) : 'Sem histórico para este bloco'}</Text>
        </Pressable>
      </View>

      <View style={styles.chipRow}>
        {setTypes.map(type => (
          <Pressable key={type} style={[styles.setTypeChip, setType === type && styles.setTypeChipActive]} onPress={() => setSetType(type)}>
            <Text style={[styles.setTypeChipText, setType === type && styles.setTypeChipTextActive]}>{setTypeLabels[type]}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.inputRow}>
        {showWeight ? (
          <NumberInput label="kg" value={weight} onChange={setWeight} quick={[-20, -10, -5, -2.5, -0.5, 0.5, 2.5, 5, 10, 20]} />
        ) : null}
        {showReps ? <NumberInput label="reps" value={reps} onChange={setReps} quick={[-1, 1]} /> : null}
        <NumberInput label="RPE" value={rpe} onChange={setRpe} quick={[-0.5, 0.5]} />
      </View>

      <Pressable style={styles.logSetButton} onPress={submit}>
        <Text style={styles.logSetText}>Log Set</Text>
      </Pressable>
    </View>
  );
}

function RoutinesScreen({
  data,
  onStartRoutine,
  onCreateRoutine,
  onRenameRoutine,
  onAddExercise,
  onMoveExercise,
}: {
  data: AppData;
  onStartRoutine: (routine: Routine) => void;
  onCreateRoutine: () => void;
  onRenameRoutine: (routineId: string, title: string) => void;
  onAddExercise: (routineId: string) => void;
  onMoveExercise: (routineId: string, exerciseId: string, direction: -1 | 1) => void;
}) {
  return (
    <ScreenScroll>
      <HeroHeader eyebrow="Plan" title="Routines" subtitle="Templates editáveis. Start Routine clona o template para um treino ativo." />
      <PrimaryButton label="Create Routine" onPress={onCreateRoutine} />

      {data.routines.map(routine => (
        <View key={routine.id} style={styles.routineCard}>
          <TextInput
            value={routine.title}
            onChangeText={text => onRenameRoutine(routine.id, text)}
            style={styles.routineTitleInput}
            placeholderTextColor={colors.subtle}
          />
          <Text style={styles.cardSubtitle}>{routine.exercises.length} exercícios</Text>

          <View style={styles.routineActions}>
            <Pressable style={styles.secondaryButton} onPress={() => onStartRoutine(routine)}>
              <Text style={styles.secondaryButtonText}>Start Routine</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => onAddExercise(routine.id)}>
              <Text style={styles.secondaryButtonText}>Add Exercise</Text>
            </Pressable>
          </View>

          {routine.exercises.length === 0 ? (
            <Text style={styles.emptySmall}>Sem exercícios ainda.</Text>
          ) : (
            <View style={styles.exerciseList}>
              {routine.exercises.map((exercise, index) => (
                <View key={exercise.id} style={styles.routineExerciseRow}>
                  <View style={styles.orderBadge}>
                    <Text style={styles.orderBadgeText}>{index + 1}</Text>
                  </View>
                  <View style={styles.routineExerciseBody}>
                    <Text style={styles.routineExerciseTitle}>{exercise.title}</Text>
                    <Text style={styles.routineExerciseMeta}>{exercise.sets.length || 0} sets · rest {exercise.rest_seconds ?? data.settings.default_rest_seconds}s</Text>
                  </View>
                  <View style={styles.moveButtons}>
                    <Pressable onPress={() => onMoveExercise(routine.id, exercise.id, -1)} style={styles.moveButton}>
                      <Text style={styles.moveText}>↑</Text>
                    </Pressable>
                    <Pressable onPress={() => onMoveExercise(routine.id, exercise.id, 1)} style={styles.moveButton}>
                      <Text style={styles.moveText}>↓</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      ))}
    </ScreenScroll>
  );
}

function ExercisesScreen({
  data,
  search,
  muscleFilter,
  onSearch,
  onMuscleFilter,
  onOpenExercise,
}: {
  data: AppData;
  search: string;
  muscleFilter: string;
  onSearch: (value: string) => void;
  onMuscleFilter: (value: string) => void;
  onOpenExercise: (template: ExerciseTemplate) => void;
}) {
  const templates = filterTemplates(data.exercise_templates, search, muscleFilter);
  const muscles = uniqueMuscles(data.exercise_templates);

  return (
    <ScreenScroll>
      <HeroHeader eyebrow="Library" title="Exercises" subtitle="Biblioteca por músculo/equipamento, com histórico e recordes por exercício." />
      <SearchAndFilters
        search={search}
        muscleFilter={muscleFilter}
        muscles={muscles}
        onSearch={onSearch}
        onMuscleFilter={onMuscleFilter}
      />

      <View style={styles.exerciseLibrary}>
        {templates.map(template => {
          const stats = exerciseStats(data, template.id);
          return (
            <Pressable key={template.id} style={styles.libraryRow} onPress={() => onOpenExercise(template)}>
              <View>
                <Text style={styles.libraryTitle}>{template.title}</Text>
                <Text style={styles.libraryMeta}>
                  {muscleLabels[template.primary_muscle_group]} · {equipmentLabels[template.equipment]}
                </Text>
              </View>
              <View style={styles.libraryRight}>
                <Text style={styles.libraryStat}>{stats.sessions}</Text>
                <Text style={styles.libraryMeta}>logs</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </ScreenScroll>
  );
}

function ProfileScreen({
  data,
  lastSavedAt,
  onReset,
  onUpdateSettings,
}: {
  data: AppData;
  lastSavedAt: string | null;
  onReset: () => void;
  onUpdateSettings: (settings: Partial<AppData['settings']>) => void;
}) {
  const workouts = completedWorkouts(data);
  const totalVolume = workouts.reduce((sum, workout) => sum + workoutVolume(workout), 0);
  const totalSets = workouts.reduce((sum, workout) => sum + workoutSetCount(workout), 0);
  const distribution = muscleDistribution(data);
  const maxMuscleSets = Math.max(...distribution.map(([, count]) => count), 1);

  return (
    <ScreenScroll>
      <HeroHeader eyebrow="Profile" title="Progress" subtitle="Análises privadas: volume, frequência, músculos e histórico de treino." />

      <View style={styles.statGrid}>
        <MetricCard label="Workouts" value={String(workouts.length)} />
        <MetricCard label="Sets" value={String(totalSets)} />
        <MetricCard label="Volume" value={`${formatNumber(totalVolume)} kg`} />
        <MetricCard label="Saved" value={lastSavedAt ? formatDateTime(lastSavedAt) : 'Local'} />
      </View>

      <View style={styles.profileCard}>
        <SectionHeader title="Muscle Distribution" action="sets completos" />
        {distribution.length === 0 ? (
          <Text style={styles.emptySmall}>Finalize treinos para popular este gráfico.</Text>
        ) : (
          distribution.map(([muscle, count]) => (
            <View key={muscle} style={styles.muscleRow}>
              <Text style={styles.muscleLabel}>{muscleLabels[muscle]}</Text>
              <View style={styles.muscleBarTrack}>
                <View style={[styles.muscleBarFill, { width: `${Math.max(8, (count / maxMuscleSets) * 100)}%` }]} />
              </View>
              <Text style={styles.muscleCount}>{count}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.profileCard}>
        <SectionHeader title="Settings" action="Hevy-like" />
        <SettingSwitch
          label="Previous values"
          value={data.settings.previous_values_mode === 'same_routine' ? 'Same Routine' : 'Any Workout'}
          onPress={() =>
            onUpdateSettings({
              previous_values_mode: data.settings.previous_values_mode === 'same_routine' ? 'any_workout' : 'same_routine',
            })
          }
        />
        <SettingSwitch
          label="RPE"
          value={data.settings.rpe_enabled ? 'On' : 'Off'}
          onPress={() => onUpdateSettings({ rpe_enabled: !data.settings.rpe_enabled })}
        />
        <SettingSwitch
          label="Unit"
          value={data.settings.unit.toUpperCase()}
          onPress={() => onUpdateSettings({ unit: data.settings.unit === 'kg' ? 'lb' : 'kg' })}
        />
      </View>

      <RecentWorkouts data={data} />

      <Pressable style={styles.dangerButton} onPress={onReset}>
        <Text style={styles.dangerButtonText}>Reset local app data</Text>
      </Pressable>
    </ScreenScroll>
  );
}

function RecentWorkouts({ data }: { data: AppData }) {
  const recent = completedWorkouts(data).slice(0, 6);

  return (
    <View style={styles.profileCard}>
      <SectionHeader title="Recent Workouts" action={`${recent.length} shown`} />
      {recent.length === 0 ? (
        <Text style={styles.emptySmall}>Nenhum treino finalizado ainda.</Text>
      ) : (
        recent.map(workout => (
          <View key={workout.id} style={styles.recentWorkoutRow}>
            <View>
              <Text style={styles.recentWorkoutTitle}>{workout.title}</Text>
              <Text style={styles.recentWorkoutMeta}>{formatDateTime(workout.start_time)} · {formatDuration(workoutDurationSeconds(workout))}</Text>
            </View>
            <View style={styles.recentWorkoutStats}>
              <Text style={styles.recentWorkoutStat}>{workoutSetCount(workout)}</Text>
              <Text style={styles.libraryMeta}>sets</Text>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

function ExercisePickerSheet({
  visible,
  data,
  search,
  muscleFilter,
  onSearch,
  onMuscleFilter,
  onClose,
  onSelect,
}: {
  visible: boolean;
  data: AppData;
  search: string;
  muscleFilter: string;
  onSearch: (value: string) => void;
  onMuscleFilter: (value: string) => void;
  onClose: () => void;
  onSelect: (template: ExerciseTemplate) => void;
}) {
  const templates = filterTemplates(data.exercise_templates, search, muscleFilter);
  const muscles = uniqueMuscles(data.exercise_templates);

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Add Exercise">
      <SearchAndFilters search={search} muscleFilter={muscleFilter} muscles={muscles} onSearch={onSearch} onMuscleFilter={onMuscleFilter} />
      {templates.map(template => (
        <Pressable key={template.id} style={styles.libraryRow} onPress={() => onSelect(template)}>
          <View>
            <Text style={styles.libraryTitle}>{template.title}</Text>
            <Text style={styles.libraryMeta}>{muscleLabels[template.primary_muscle_group]} · {equipmentLabels[template.equipment]}</Text>
          </View>
          <Text style={styles.blueLink}>Add</Text>
        </Pressable>
      ))}
    </BottomSheet>
  );
}

function ExerciseDetailSheet({
  visible,
  data,
  template,
  onClose,
}: {
  visible: boolean;
  data: AppData;
  template: ExerciseTemplate | null;
  onClose: () => void;
}) {
  if (!template) return null;

  const stats = exerciseStats(data, template.id);

  return (
    <BottomSheet visible={visible} onClose={onClose} title={template.title}>
      <Text style={styles.sheetSubtitle}>{muscleLabels[template.primary_muscle_group]} · {equipmentLabels[template.equipment]} · {exerciseTypeLabels[template.type]}</Text>
      <View style={styles.statGrid}>
        <MetricCard label="Sessions" value={String(stats.sessions)} />
        <MetricCard label="Sets" value={String(stats.totalSets)} />
        <MetricCard label="Best set" value={stats.bestSet} />
        <MetricCard label="Est. 1RM" value={stats.oneRepMaxLabel} />
      </View>
      <SectionHeader title="History by block" action="previous values" />
      {stats.history.length === 0 ? (
        <Text style={styles.emptySmall}>Sem histórico para este exercício ainda.</Text>
      ) : (
        stats.history.slice(0, 8).map(entry => (
          <View key={`${entry.workout.id}-${entry.exercise.id}`} style={styles.historyCard}>
            <Text style={styles.historyTitle}>{entry.workout.title}</Text>
            <Text style={styles.historyDate}>{formatDateTime(entry.workout.start_time)}</Text>
            <View style={styles.historySets}>
              {entry.sets.map(set => (
                <Text key={set.id} style={styles.historySetPill}>{set.index}. {previousSetLabel(set)}</Text>
              ))}
            </View>
          </View>
        ))
      )}
    </BottomSheet>
  );
}

function FinishWorkoutSheet({
  visible,
  workout,
  onClose,
  onFinish,
}: {
  visible: boolean;
  workout: Workout | null;
  onClose: () => void;
  onFinish: (title: string, date: string, description: string) => void;
}) {
  const [title, setTitle] = useState(workout?.title ?? '');
  const [date, setDate] = useState(dateInputValue(workout?.start_time));
  const [description, setDescription] = useState(workout?.description ?? '');

  useEffect(() => {
    setTitle(workout?.title ?? '');
    setDate(dateInputValue(workout?.start_time));
    setDescription(workout?.description ?? '');
  }, [workout?.id]);

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Save Workout">
      <Text style={styles.sheetSubtitle}>Edite título, data e observações antes de salvar o log.</Text>
      <LabeledInput label="Title" value={title} onChange={setTitle} />
      <LabeledInput label="Date" value={date} onChange={setDate} placeholder="YYYY-MM-DD" />
      <LabeledInput label="Notes" value={description} onChange={setDescription} multiline />
      <PrimaryButton label="Save Workout" onPress={() => onFinish(title, date, description)} />
    </BottomSheet>
  );
}

function BottomSheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <Pressable style={styles.sheetDismissArea} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>×</Text>
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ScreenScroll({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.screen}>
      {children}
    </ScrollView>
  );
}

function HeroHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <View style={styles.hero}>
      <Text style={styles.kicker}>{eyebrow}</Text>
      <Text style={styles.screenTitle}>{title}</Text>
      <Text style={styles.screenSubtitle}>{subtitle}</Text>
    </View>
  );
}

function SectionHeader({ title, action }: { title: string; action?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? <Text style={styles.sectionAction}>{action}</Text> : null}
    </View>
  );
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.primaryButton} onPress={onPress}>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniStatLabel}>{label}</Text>
      <Text style={styles.miniStatValue}>{value}</Text>
    </View>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function EmptyCard({ title, copy }: { title: string; copy: string }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyCopy}>{copy}</Text>
    </View>
  );
}

function Pill({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'blue' | 'yellow' }) {
  return (
    <View style={[styles.pill, tone === 'blue' && styles.pillBlue, tone === 'yellow' && styles.pillYellow]}>
      <Text style={[styles.pillText, tone === 'blue' && styles.pillTextBlue, tone === 'yellow' && styles.pillTextYellow]}>{label}</Text>
    </View>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  quick,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  quick: number[];
}) {
  const bump = (delta: number) => {
    const next = Math.max(0, (numericValue(value) ?? 0) + delta);
    onChange(String(Number(next.toFixed(2))));
  };

  return (
    <View style={styles.numberInputWrap}>
      <Text style={styles.numberInputLabel}>{label.toUpperCase()}</Text>
      <View style={styles.numberInputBody}>
        <Pressable onPress={() => bump(quick[0])}>
          <Text style={styles.stepper}>−</Text>
        </Pressable>
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={colors.subtle}
          style={styles.numberInput}
        />
        <Pressable onPress={() => bump(quick[quick.length - 1])}>
          <Text style={styles.stepper}>＋</Text>
        </Pressable>
      </View>
      {quick.length > 2 ? (
        <View style={styles.quickRow}>
          {quick.map(delta => (
            <Pressable key={`${label}-${delta}`} style={styles.quickButton} onPress={() => bump(delta)}>
              <Text style={styles.quickText}>{delta > 0 ? `+${delta}` : delta}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <View style={styles.labeledInputWrap}>
      <Text style={styles.labeledInputLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.subtle}
        multiline={multiline}
        style={[styles.labeledInput, multiline && styles.labeledInputMultiline]}
      />
    </View>
  );
}

function SearchAndFilters({
  search,
  muscleFilter,
  muscles,
  onSearch,
  onMuscleFilter,
}: {
  search: string;
  muscleFilter: string;
  muscles: string[];
  onSearch: (value: string) => void;
  onMuscleFilter: (value: string) => void;
}) {
  return (
    <View>
      <TextInput
        value={search}
        onChangeText={onSearch}
        placeholder="Search exercises"
        placeholderTextColor={colors.subtle}
        style={styles.searchInput}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        <FilterChip label="All" active={muscleFilter === 'all'} onPress={() => onMuscleFilter('all')} />
        {muscles.map(muscle => (
          <FilterChip key={muscle} label={muscleLabels[muscle as keyof typeof muscleLabels]} active={muscleFilter === muscle} onPress={() => onMuscleFilter(muscle)} />
        ))}
      </ScrollView>
    </View>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.filterChip, active && styles.filterChipActive]} onPress={onPress}>
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function SettingSwitch({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <Pressable style={styles.settingRow} onPress={onPress}>
      <Text style={styles.settingLabel}>{label}</Text>
      <Text style={styles.settingValue}>{value}</Text>
    </Pressable>
  );
}

const previousSetLabel = (set: TrainingSet) => {
  const parts = [set.weight_kg !== null ? formatKg(set.weight_kg) : null, set.reps !== null ? `${set.reps} reps` : null, set.rpe !== null ? `RPE ${set.rpe}` : null].filter(Boolean);
  return parts.length > 0 ? parts.join(' × ') : '—';
};

const filterTemplates = (templates: ExerciseTemplate[], search: string, muscleFilter: string) => {
  const normalizedSearch = search.trim().toLowerCase();

  return templates.filter(template => {
    const matchesSearch =
      normalizedSearch.length === 0 ||
      template.title.toLowerCase().includes(normalizedSearch) ||
      template.aliases.some(alias => alias.toLowerCase().includes(normalizedSearch));
    const matchesMuscle = muscleFilter === 'all' || template.primary_muscle_group === muscleFilter;

    return matchesSearch && matchesMuscle;
  });
};

const uniqueMuscles = (templates: ExerciseTemplate[]) =>
  [...new Set(templates.map(template => template.primary_muscle_group))].sort((a, b) => muscleLabels[a].localeCompare(muscleLabels[b]));

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  phoneFrame: {
    flex: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    backgroundColor: colors.bg,
  },
  content: {
    flex: 1,
  },
  screen: {
    padding: 18,
    paddingBottom: 122,
    gap: 16,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  loadingLogo: {
    color: colors.blue,
    fontWeight: '900',
    letterSpacing: 5,
  },
  loadingTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  hero: {
    gap: 8,
    paddingTop: Platform.OS === 'web' ? 12 : 4,
  },
  kicker: {
    color: colors.blue,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  screenTitle: {
    color: colors.text,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
  },
  screenSubtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  activeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
  },
  finishButton: {
    backgroundColor: colors.blue,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 999,
  },
  finishText: {
    color: colors.text,
    fontWeight: '900',
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: colors.blue,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.text,
    fontWeight: '900',
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: colors.panel2,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  secondaryButtonText: {
    color: colors.text,
    fontWeight: '800',
  },
  cardGrid: {
    gap: 12,
  },
  routineLaunchCard: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 18,
    gap: 8,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  cardSubtitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  blueLink: {
    color: colors.blue,
    fontWeight: '900',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  sectionTitle: {
    color: colors.text,
    fontWeight: '900',
    fontSize: 18,
  },
  sectionAction: {
    color: colors.subtle,
    fontWeight: '700',
    fontSize: 12,
  },
  statRow: {
    flexDirection: 'row',
    gap: 10,
  },
  miniStat: {
    flex: 1,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 13,
    gap: 4,
  },
  miniStatLabel: {
    color: colors.subtle,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  miniStatValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  exerciseCard: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    padding: 14,
    gap: 13,
  },
  exerciseTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  exerciseTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  exerciseMeta: {
    color: colors.muted,
    fontWeight: '700',
    marginTop: 4,
  },
  exerciseMenu: {
    color: colors.subtle,
    fontSize: 22,
    fontWeight: '900',
  },
  exerciseNote: {
    color: colors.muted,
    backgroundColor: colors.panel2,
    padding: 10,
    borderRadius: 12,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 2,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.panel2,
    borderRadius: 13,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  tableCell: {
    flex: 1,
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  tableTiny: {
    flex: 0.9,
  },
  tablePrevious: {
    flex: 2.3,
    color: colors.muted,
    textAlign: 'left',
  },
  tableCheck: {
    flex: 0.5,
  },
  previousBlock: {
    backgroundColor: colors.blueSoft,
    borderWidth: 1,
    borderColor: '#1D477F',
    padding: 12,
    borderRadius: 14,
    gap: 4,
  },
  previousBlockTitle: {
    color: colors.blue,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  previousBlockValue: {
    color: colors.text,
    fontWeight: '900',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  setTypeChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel2,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  setTypeChipActive: {
    borderColor: colors.blue,
    backgroundColor: colors.blueSoft,
  },
  setTypeChipText: {
    color: colors.muted,
    fontWeight: '900',
  },
  setTypeChipTextActive: {
    color: colors.text,
  },
  inputRow: {
    gap: 10,
  },
  numberInputWrap: {
    backgroundColor: colors.panel2,
    borderRadius: 16,
    padding: 11,
    gap: 10,
  },
  numberInputLabel: {
    color: colors.subtle,
    fontSize: 11,
    fontWeight: '900',
  },
  numberInputBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepper: {
    color: colors.muted,
    fontSize: 24,
    fontWeight: '900',
    paddingHorizontal: 12,
  },
  numberInput: {
    flex: 1,
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
    paddingVertical: 4,
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  quickButton: {
    backgroundColor: colors.panel3,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  quickText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
  },
  logSetButton: {
    backgroundColor: colors.blue,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  logSetText: {
    color: colors.text,
    fontWeight: '900',
  },
  removeSet: {
    flex: 0.5,
    alignItems: 'center',
  },
  removeSetText: {
    color: colors.subtle,
    fontSize: 18,
    fontWeight: '900',
  },
  addExerciseButton: {
    borderWidth: 1,
    borderColor: colors.blue,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.blueSoft,
  },
  addExerciseText: {
    color: colors.text,
    fontWeight: '900',
  },
  emptyCard: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 18,
    gap: 8,
  },
  emptyTitle: {
    color: colors.text,
    fontWeight: '900',
    fontSize: 18,
  },
  emptyCopy: {
    color: colors.muted,
    fontWeight: '600',
    lineHeight: 20,
  },
  routineCard: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    padding: 16,
    gap: 12,
  },
  routineTitleInput: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    paddingVertical: 4,
  },
  routineActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  exerciseList: {
    gap: 8,
  },
  routineExerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.panel2,
    borderRadius: 16,
    padding: 10,
  },
  orderBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.panel3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderBadgeText: {
    color: colors.text,
    fontWeight: '900',
  },
  routineExerciseBody: {
    flex: 1,
  },
  routineExerciseTitle: {
    color: colors.text,
    fontWeight: '900',
  },
  routineExerciseMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  moveButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  moveButton: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: colors.panel3,
  },
  moveText: {
    color: colors.text,
    fontWeight: '900',
  },
  emptySmall: {
    color: colors.muted,
    fontWeight: '700',
    lineHeight: 20,
  },
  searchInput: {
    color: colors.text,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontWeight: '800',
  },
  filterRow: {
    gap: 8,
    paddingTop: 12,
    paddingBottom: 2,
  },
  filterChip: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
  },
  filterChipActive: {
    backgroundColor: colors.blue,
    borderColor: colors.blue,
  },
  filterChipText: {
    color: colors.muted,
    fontWeight: '900',
  },
  filterChipTextActive: {
    color: colors.text,
  },
  exerciseLibrary: {
    gap: 8,
  },
  libraryRow: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 17,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  libraryTitle: {
    color: colors.text,
    fontWeight: '900',
    fontSize: 15,
  },
  libraryMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  libraryRight: {
    alignItems: 'flex-end',
  },
  libraryStat: {
    color: colors.text,
    fontWeight: '900',
    fontSize: 18,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    flexGrow: 1,
    flexBasis: '46%',
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 15,
    gap: 5,
  },
  metricLabel: {
    color: colors.subtle,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  metricValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  profileCard: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    padding: 16,
    gap: 12,
  },
  muscleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  muscleLabel: {
    width: 86,
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  muscleBarTrack: {
    flex: 1,
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.panel3,
    overflow: 'hidden',
  },
  muscleBarFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.blue,
  },
  muscleCount: {
    color: colors.muted,
    width: 24,
    textAlign: 'right',
    fontWeight: '900',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  settingLabel: {
    color: colors.text,
    fontWeight: '900',
  },
  settingValue: {
    color: colors.blue,
    fontWeight: '900',
  },
  recentWorkoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: colors.panel2,
    borderRadius: 15,
    padding: 12,
  },
  recentWorkoutTitle: {
    color: colors.text,
    fontWeight: '900',
  },
  recentWorkoutMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  recentWorkoutStats: {
    alignItems: 'flex-end',
  },
  recentWorkoutStat: {
    color: colors.text,
    fontWeight: '900',
    fontSize: 18,
  },
  dangerButton: {
    borderWidth: 1,
    borderColor: '#552626',
    backgroundColor: '#1D0B0B',
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: 'center',
  },
  dangerButtonText: {
    color: colors.red,
    fontWeight: '900',
  },
  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheetDismissArea: {
    flex: 1,
  },
  sheet: {
    maxHeight: '86%',
    backgroundColor: colors.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    paddingTop: 9,
  },
  sheetHandle: {
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.panel3,
    alignSelf: 'center',
    marginBottom: 10,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  sheetTitle: {
    color: colors.text,
    fontWeight: '900',
    fontSize: 24,
    flex: 1,
  },
  sheetSubtitle: {
    color: colors.muted,
    fontWeight: '700',
    lineHeight: 20,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.panel2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
    marginTop: -2,
  },
  sheetContent: {
    paddingHorizontal: 18,
    paddingBottom: 32,
    gap: 14,
  },
  labeledInputWrap: {
    gap: 8,
  },
  labeledInputLabel: {
    color: colors.subtle,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  labeledInput: {
    color: colors.text,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontWeight: '800',
  },
  labeledInputMultiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  historyCard: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
    gap: 8,
  },
  historyTitle: {
    color: colors.text,
    fontWeight: '900',
  },
  historyDate: {
    color: colors.muted,
    fontWeight: '700',
    fontSize: 12,
  },
  historySets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  historySetPill: {
    color: colors.text,
    backgroundColor: colors.panel2,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    overflow: 'hidden',
    fontSize: 12,
    fontWeight: '800',
  },
  pill: {
    flex: 0.9,
    alignItems: 'center',
    backgroundColor: colors.panel3,
    borderRadius: 999,
    paddingVertical: 6,
  },
  pillBlue: {
    backgroundColor: colors.blueSoft,
  },
  pillYellow: {
    backgroundColor: '#3B300F',
  },
  pillText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
  },
  pillTextBlue: {
    color: colors.blue,
  },
  pillTextYellow: {
    color: colors.yellow,
  },
  tabBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    backgroundColor: '#0A0A0B',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    padding: 8,
    gap: 6,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 8,
    borderRadius: 18,
  },
  tabButtonActive: {
    backgroundColor: colors.panel2,
  },
  tabIcon: {
    color: colors.subtle,
    fontSize: 19,
    fontWeight: '900',
  },
  tabLabel: {
    color: colors.subtle,
    fontSize: 11,
    fontWeight: '900',
  },
  tabTextActive: {
    color: colors.text,
  },
});
