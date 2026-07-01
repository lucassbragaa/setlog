import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View, type DimensionValue } from 'react-native';

import { completedSessions, computeStreak, lastSessionSetsForExercise, normalizeExerciseKey, sessionDurationMinutes, setCountForSession, volumeForSession, workoutHeatmap } from './src/data/analytics';
import { createDefaultData, defaultPrograms, exerciseLibrary, mergeDefaultPrograms, mergeExerciseTemplates, mergeRoutineFolders, sessionFromProgram } from './src/data/appDefaults';
import { currentCycleNumber, isProgramCode, nextProgramCode } from './src/data/cycles';
import { matchesMuscle, muscleLabel, muscleOrder } from './src/data/exerciseTaxonomy';
import { muscleSetDistribution } from './src/data/hevyAnalytics';
import { nowOnLocalDate } from './src/data/sessionDates';
import { estimated1Rm, setVolumeKg } from './src/data/setMetrics';
import { techniqueLabel, techniqueOptions } from './src/data/techniques';
import { chooseBackupFile, exportBackup } from './src/platform/backup';
import { loadGitHubToken, pullAppDataFromGitHub, pushAppDataToGitHub, saveGitHubToken } from './src/platform/githubSync';
import { setupPwa } from './src/platform/pwa';
import { loadAppData, loadLegacySets, saveAppData } from './src/storage/workoutStorage';
import type { AppData, ExerciseBlock, ExerciseTemplate, LoggedSet, MuscleGroup, ProgramExercise, ProgramTemplate, SetType, WorkoutSession } from './src/types/training';

const palette = {
  bg: '#050608',
  surface: '#11151C',
  card: '#171C25',
  raised: '#202633',
  line: '#2B3342',
  text: '#F7F9FC',
  muted: '#A4ADBA',
  dim: '#687180',
  blue: '#1E88FF',
  blueSoft: '#0B2B52',
  green: '#26D07C',
  red: '#FF5870',
  yellow: '#F5B942',
};

const tabs = ['Home', 'Workout', 'Exercises', 'Profile'] as const;
type Tab = typeof tabs[number];

function kg(value: number) {
  return Math.round(value).toLocaleString('pt-BR') + ' kg';
}

function dateLabel(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
}

function compactSet(set?: LoggedSet) {
  if (!set) return '';
  const segments = set.techniqueDetails?.segmentRepetitions;
  const reps = segments?.length ? segments.join('+') : String(set.repetitions);
  return `${set.loadKg}kg x ${reps}${set.rir !== undefined ? ` @${set.rir}` : ''}`;
}

function blankExercise(item: typeof exerciseLibrary[number]): ProgramExercise {
  return {
    exerciseId: item.id,
    exerciseTemplateId: item.template.id,
    exerciseName: item.name,
    targetSets: 0,
    targetRepRange: [0, 0],
    targetRirRange: [0, 0],
    targetRestSeconds: item.rest,
    setPrescriptions: [],
  };
}

function emptyWorkout(): WorkoutSession {
  const now = Date.now();
  return {
    id: `session-${now}`,
    name: 'Empty Workout',
    startedAt: new Date(now).toISOString(),
    visibility: 'private',
    exercises: [],
  };
}

function clearSessionFromProgram(session: WorkoutSession, cycleNumber?: number): WorkoutSession {
  const now = Date.now();
  return {
    ...session,
    id: `session-${now}`,
    cycleNumber,
    startedAt: new Date(now).toISOString(),
    endedAt: undefined,
    exercises: session.exercises.map((exercise, index) => ({
      ...exercise,
      id: `block-${now}-${index}`,
      sets: [],
    })),
  };
}

function programMatchesSession(session: WorkoutSession, program: ProgramTemplate): boolean {
  return session.programId === program.id || session.name === program.name;
}

function syncActiveSessionWithProgram(session: WorkoutSession, previousProgram: ProgramTemplate | undefined, nextProgram: ProgramTemplate): WorkoutSession {
  if (!previousProgram || !programMatchesSession(session, previousProgram)) return session;
  const now = Date.now();
  const existingByExercise = new Map(session.exercises.map(block => [block.exerciseId, block]));
  return {
    ...session,
    name: nextProgram.name,
    programId: nextProgram.id,
    exercises: nextProgram.exercises.map((exercise, index) => {
      const previousAtIndex = previousProgram.exercises[index];
      const matched = existingByExercise.get(exercise.exerciseId) ?? (previousAtIndex ? existingByExercise.get(previousAtIndex.exerciseId) : undefined);
      return { ...exercise, id: matched?.id ?? `block-${now}-${index}`, sets: matched?.sets ?? [] };
    }),
  };
}

function AppButton({ label, onPress, tone = 'primary', disabled = false }: { label: string; onPress: () => void; tone?: 'primary' | 'secondary' | 'danger'; disabled?: boolean }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [
      styles.button,
      tone === 'primary' && styles.buttonPrimary,
      tone === 'danger' && styles.buttonDanger,
      disabled && styles.disabled,
      pressed && !disabled && styles.pressed,
    ]}>
      <Text style={[styles.buttonText, tone === 'secondary' && styles.secondaryText, tone === 'danger' && styles.dangerText]}>{label}</Text>
    </Pressable>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function Pill({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={[styles.pill, selected && styles.pillSelected]}>
      <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable onPress={onClose} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

function Stepper({ label, value, step = 1, min = 0, max = 999, suffix = '', onChange }: {
  label: string; value: number; step?: number; min?: number; max?: number; suffix?: string; onChange: (value: number) => void;
}) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepLabel}>{label}</Text>
      <View style={styles.stepRow}>
        <Pressable onPress={() => onChange(Math.max(min, value - step))}><Text style={styles.stepAction}>−</Text></Pressable>
        <Text style={styles.stepValue}>{value}{suffix}</Text>
        <Pressable onPress={() => onChange(Math.min(max, value + step))}><Text style={styles.stepAction}>+</Text></Pressable>
      </View>
    </View>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>('Workout');
  const [data, setData] = useState<AppData>(() => createDefaultData());
  const [ready, setReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'loading' | 'saved' | 'error'>('loading');

  useEffect(() => {
    setupPwa();
    let mounted = true;
    Promise.all([loadAppData(), loadLegacySets()])
      .then(([stored, legacy]) => {
        if (!mounted) return;
        if (stored) {
          setData({
            ...stored,
            programs: mergeDefaultPrograms(stored.programs),
            exerciseTemplates: mergeExerciseTemplates(stored.exerciseTemplates),
            routineFolders: mergeRoutineFolders(stored.routineFolders),
          });
        } else if (legacy?.length) {
          setData(current => ({
            ...current,
            activeSession: {
              ...current.activeSession,
              exercises: current.activeSession.exercises.map((exercise, index) => index === 0 ? { ...exercise, sets: legacy } : exercise),
            },
          }));
        }
      })
      .catch(() => setSaveStatus('error'))
      .finally(() => { if (mounted) setReady(true); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    setSaveStatus('loading');
    saveAppData(data).then(() => setSaveStatus('saved')).catch(() => setSaveStatus('error'));
  }, [data, ready]);

  function startProgram(program: ProgramTemplate) {
    setData(current => ({
      ...current,
      activeSession: sessionFromProgram(program, isProgramCode(program.name) ? currentCycleNumber(current.history) : undefined),
    }));
    setTab('Workout');
  }

  function startEmptyWorkout() {
    setData(current => ({ ...current, activeSession: emptyWorkout() }));
    setTab('Workout');
  }

  function finishWorkout() {
    setData(current => {
      const cycleNumber = isProgramCode(current.activeSession.name)
        ? current.activeSession.cycleNumber ?? currentCycleNumber(current.history)
        : undefined;
      const completed: WorkoutSession = {
        ...current.activeSession,
        cycleNumber,
        endedAt: nowOnLocalDate(current.activeSession.startedAt),
      };
      const history = [completed, ...current.history];
      const nextCycle = isProgramCode(completed.name) ? currentCycleNumber(history) : undefined;
      return { ...current, history, activeSession: clearSessionFromProgram(current.activeSession, nextCycle) };
    });
    setTab('Home');
  }

  async function restoreBackup() {
    const restored = await chooseBackupFile();
    if (restored) {
      setData({
        ...restored,
        programs: mergeDefaultPrograms(restored.programs),
        exerciseTemplates: mergeExerciseTemplates(restored.exerciseTemplates),
        routineFolders: mergeRoutineFolders(restored.routineFolders),
      });
    }
  }

  function createRoutine() {
    const now = Date.now();
    setData(current => ({
      ...current,
      programs: [...current.programs, {
        id: `custom-${now}`,
        name: `Routine ${current.programs.filter(program => program.id.startsWith('custom-')).length + 1}`,
        description: 'Custom routine',
        folderId: 'folder-custom',
        order: current.programs.length + 1,
        exercises: [],
      }],
    }));
  }

  function updateProgram(program: ProgramTemplate) {
    setData(current => {
      const previousProgram = current.programs.find(item => item.id === program.id);
      return {
        ...current,
        programs: current.programs.map(item => item.id === program.id ? program : item),
        activeSession: syncActiveSessionWithProgram(current.activeSession, previousProgram, program),
      };
    });
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      {tab === 'Home' && <HomeScreen history={data.history} programs={data.programs} onStart={startProgram} onOpenWorkout={() => setTab('Workout')} />}
      {tab === 'Workout' && (
        <WorkoutScreen
          data={data}
          saveStatus={saveStatus}
          onChange={activeSession => setData(current => ({ ...current, activeSession }))}
          onFinish={finishWorkout}
          onStartProgram={startProgram}
          onStartEmpty={startEmptyWorkout}
          onCreateRoutine={createRoutine}
          onUpdateProgram={updateProgram}
          onDeleteProgram={id => setData(current => ({ ...current, programs: current.programs.filter(program => program.id !== id) }))}
        />
      )}
      {tab === 'Exercises' && <ExercisesScreen templates={data.exerciseTemplates} history={data.history} />}
      {tab === 'Profile' && <ProfileScreen data={data} onDataChange={setData} onExport={() => exportBackup(data)} onImport={restoreBackup} />}
      <View style={styles.tabbar}>
        {tabs.map(item => (
          <Pressable key={item} onPress={() => setTab(item)} style={styles.tabItem}>
            <Text style={[styles.tabIcon, tab === item && styles.activeTab]}>{item === 'Home' ? '⌂' : item === 'Workout' ? '≡' : item === 'Exercises' ? '◉' : '♙'}</Text>
            <Text style={[styles.tabText, tab === item && styles.activeTab]}>{item}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

function HomeScreen({ history, programs, onStart, onOpenWorkout }: {
  history: WorkoutSession[]; programs: ProgramTemplate[]; onStart: (program: ProgramTemplate) => void; onOpenWorkout: () => void;
}) {
  const recent = completedSessions(history).slice().reverse().slice(0, 8);
  const nextRoutine = programs.find(program => program.name === nextProgramCode(history)) ?? programs[0];

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.top}>
        <Text style={styles.largeTitle}>Home</Text>
        <View style={styles.avatar}><Text style={styles.avatarText}>L</Text></View>
      </View>
      <Card style={styles.hero}>
        <Text style={styles.overline}>NEXT WORKOUT</Text>
        <Text style={styles.heroTitle}>{nextRoutine?.name ?? 'Empty Workout'}</Text>
        <Text style={styles.muted}>{nextRoutine ? `${nextRoutine.exercises.length} exercises · ${nextRoutine.split ?? 'Custom'}` : 'Start logging freely.'}</Text>
        <View style={styles.inlineButtons}>
          <AppButton label="Start" onPress={() => nextRoutine ? onStart(nextRoutine) : onOpenWorkout()} />
          <AppButton label="Open Logger" tone="secondary" onPress={onOpenWorkout} />
        </View>
      </Card>
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Feed</Text>
        <Text style={styles.sectionMeta}>Private</Text>
      </View>
      {recent.length === 0 ? <Card><Text style={styles.cardTitle}>No workouts yet</Text><Text style={styles.muted}>Finish a workout and it appears here.</Text></Card> : null}
      {recent.map(session => (
        <Card key={session.id}>
          <View style={styles.feedHead}>
            <View style={styles.avatarSmall}><Text style={styles.avatarSmallText}>L</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Lucas</Text>
              <Text style={styles.dim}>{dateLabel(session.startedAt)} · {sessionDurationMinutes(session) ?? 0} min</Text>
            </View>
            {session.cycleNumber ? <Pill label={`C${session.cycleNumber}`} selected /> : null}
          </View>
          <Text style={styles.workoutName}>{session.name}</Text>
          <View style={styles.metricRow}>
            <Metric label="Volume" value={kg(volumeForSession(session))} />
            <Metric label="Sets" value={String(setCountForSession(session))} />
            <Metric label="Exercises" value={String(session.exercises.length)} />
          </View>
          {session.exercises.slice(0, 4).map(exercise => (
            <View key={exercise.id} style={styles.listLine}>
              <Text style={styles.listText}>{exercise.exerciseName}</Text>
              <Text style={styles.dim}>{exercise.sets.length} sets</Text>
            </View>
          ))}
          <View style={styles.reactions}><Text style={styles.reaction}>Like</Text><Text style={styles.reaction}>Comment</Text><Text style={styles.reaction}>Share</Text></View>
        </Card>
      ))}
    </ScrollView>
  );
}

function WorkoutScreen({ data, saveStatus, onChange, onFinish, onStartProgram, onStartEmpty, onCreateRoutine, onUpdateProgram, onDeleteProgram }: {
  data: AppData;
  saveStatus: 'loading' | 'saved' | 'error';
  onChange: (session: WorkoutSession) => void;
  onFinish: () => void;
  onStartProgram: (program: ProgramTemplate) => void;
  onStartEmpty: () => void;
  onCreateRoutine: () => void;
  onUpdateProgram: (program: ProgramTemplate) => void;
  onDeleteProgram: (id: string) => void;
}) {
  const [mode, setMode] = useState<'Log' | 'Routines'>('Log');
  const [editingProgram, setEditingProgram] = useState<ProgramTemplate | null>(null);
  const session = data.activeSession;
  const totalSets = session.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);

  return (
    <>
      <ScrollView contentContainerStyle={styles.screen}>
        <View style={styles.top}>
          <Text style={styles.largeTitle}>Workout</Text>
          <Text style={[styles.save, saveStatus === 'error' && { color: palette.red }]}>{saveStatus === 'saved' ? 'Saved' : saveStatus === 'loading' ? 'Saving…' : 'Save error'}</Text>
        </View>
        <View style={styles.segment}>
          {(['Log', 'Routines'] as const).map(item => <Pressable key={item} onPress={() => setMode(item)} style={[styles.segmentItem, mode === item && styles.segmentActive]}><Text style={[styles.segmentText, mode === item && styles.segmentTextActive]}>{item}</Text></Pressable>)}
        </View>

        {mode === 'Routines' ? (
          <>
            <AppButton label="+ New Routine" onPress={onCreateRoutine} />
            {data.programs.map(program => (
              <Card key={program.id}>
                <View style={styles.routineTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.workoutName}>{program.name}</Text>
                    <Text style={styles.muted}>{program.exercises.length} exercises · {program.split ?? 'Custom'}</Text>
                  </View>
                  {program.split ? <Pill label={program.split} selected /> : null}
                </View>
                {program.exercises.slice(0, 6).map((exercise, index) => <Text key={`${exercise.exerciseId}-${index}`} style={styles.routineExercise}>{index + 1}. {exercise.exerciseName}</Text>)}
                <View style={styles.inlineButtons}>
                  <AppButton label="Start Routine" onPress={() => onStartProgram(program)} />
                  <AppButton label="Edit" tone="secondary" onPress={() => setEditingProgram(program)} />
                  {program.id.startsWith('custom-') ? <AppButton label="Delete" tone="danger" onPress={() => onDeleteProgram(program.id)} /> : null}
                </View>
              </Card>
            ))}
          </>
        ) : (
          <>
            <Card style={styles.liveCard}>
              <Text style={styles.overline}>ACTIVE WORKOUT</Text>
              <Text style={styles.heroTitle}>{session.name}</Text>
              <Text style={styles.muted}>{session.exercises.length} exercises · {totalSets} logged sets · {kg(volumeForSession(session))}</Text>
              <View style={styles.inlineButtons}>
                <AppButton label="Start Empty Workout" tone="secondary" onPress={onStartEmpty} />
                <AppButton label="Finish" tone="danger" disabled={totalSets === 0} onPress={onFinish} />
              </View>
            </Card>
            {session.exercises.length === 0 ? <ExercisePicker onPick={exercise => onChange({ ...session, exercises: [{ ...blankExercise(exercise), id: `block-${Date.now()}`, sets: [] }] })} /> : null}
            {session.exercises.map((block, index) => (
              <ExerciseLogger
                key={block.id}
                block={block}
                index={index}
                history={data.history}
                sessionStartedAt={session.startedAt}
                onChange={next => onChange({ ...session, exercises: session.exercises.map(item => item.id === block.id ? next : item) })}
                onRemove={() => onChange({ ...session, exercises: session.exercises.filter(item => item.id !== block.id) })}
              />
            ))}
            <ExercisePicker onPick={exercise => onChange({ ...session, exercises: [...session.exercises, { ...blankExercise(exercise), id: `block-${Date.now()}`, sets: [] }] })} compact />
          </>
        )}
      </ScrollView>
      <RoutineEditor program={editingProgram} onClose={() => setEditingProgram(null)} onUpdate={program => { onUpdateProgram(program); setEditingProgram(program); }} />
    </>
  );
}

function ExerciseLogger({ block, index, history, sessionStartedAt, onChange, onRemove }: {
  block: ExerciseBlock; index: number; history: WorkoutSession[]; sessionStartedAt: string; onChange: (block: ExerciseBlock) => void; onRemove: () => void;
}) {
  const previousSets = useMemo(() => lastSessionSetsForExercise(history, normalizeExerciseKey(block)), [block, history]);
  const last = block.sets[block.sets.length - 1];
  const previousNext = previousSets[block.sets.length];
  const [weight, setWeight] = useState(last?.loadKg ?? previousNext?.loadKg ?? 0);
  const [reps, setReps] = useState(last?.repetitions ?? previousNext?.repetitions ?? 0);
  const [rir, setRir] = useState(last?.rir ?? previousNext?.rir ?? 0);
  const [type, setType] = useState<SetType>('working');

  function addSet() {
    const set: LoggedSet = {
      id: `set-${Date.now()}-${block.id}`,
      order: block.sets.length + 1,
      type,
      loadKg: weight,
      repetitions: reps,
      rir,
      completedAt: nowOnLocalDate(sessionStartedAt),
      techniqueDetails: { segmentRepetitions: [reps] },
    };
    onChange({ ...block, sets: [...block.sets, set] });
  }

  return (
    <Card>
      <View style={styles.exerciseHead}>
        <View style={styles.exerciseNumber}><Text style={styles.exerciseNumberText}>{index + 1}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.exerciseTitle}>{block.exerciseName}</Text>
          <Text style={styles.dim}>{block.sets.length} sets · previous {compactSet(previousNext) || 'blank'}</Text>
        </View>
        <Pressable onPress={onRemove}><Text style={styles.remove}>×</Text></Pressable>
      </View>
      <View style={styles.table}>
        <View style={styles.tableRowHead}><Text style={styles.th}>SET</Text><Text style={styles.thWide}>PREVIOUS</Text><Text style={styles.th}>KG</Text><Text style={styles.th}>REPS</Text><Text style={styles.th}>RIR</Text></View>
        {block.sets.map(set => (
          <View key={set.id} style={styles.tableRow}>
            <Text style={styles.td}>{set.order}</Text>
            <Text style={styles.tdWide}>{compactSet(previousSets[set.order - 1])}</Text>
            <Text style={styles.td}>{set.loadKg}</Text>
            <Text style={styles.td}>{set.repetitions}</Text>
            <Text style={styles.td}>{set.rir ?? '-'}</Text>
          </View>
        ))}
      </View>
      <View style={styles.loggerBox}>
        <Text style={styles.overline}>ADD SET {block.sets.length + 1}</Text>
        <View style={styles.stepGrid}>
          <Stepper label="kg" value={weight} step={0.5} suffix="kg" onChange={setWeight} />
          <Stepper label="reps" value={reps} max={100} onChange={setReps} />
          <Stepper label="RIR" value={rir} max={10} onChange={setRir} />
        </View>
        <View style={styles.quickWeightGrid}>
          {[-20, -10, -5, -2.5, 2.5, 5, 10, 20].map(value => <Pressable key={value} style={styles.weightChip} onPress={() => setWeight(current => Math.max(0, current + value))}><Text style={styles.weightChipText}>{value > 0 ? '+' : ''}{String(value).replace('.', ',')}</Text></Pressable>)}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
          {techniqueOptions.map(option => <Pill key={option.value} label={option.label} selected={type === option.value} onPress={() => setType(option.value)} />)}
        </ScrollView>
        <AppButton label="✓ Complete Set" onPress={addSet} />
      </View>
    </Card>
  );
}

function ExercisePicker({ onPick, compact = false }: { onPick: (exercise: typeof exerciseLibrary[number]) => void; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => exerciseLibrary.filter(item => item.name.toLowerCase().includes(query.toLowerCase())).slice(0, 80), [query]);
  return (
    <>
      <AppButton label={compact ? '+ Add Exercise' : 'Add the first exercise'} tone="secondary" onPress={() => setOpen(true)} />
      <Sheet visible={open} title="Add Exercise" onClose={() => setOpen(false)}>
        <TextInput value={query} onChangeText={setQuery} placeholder="Search exercises" placeholderTextColor={palette.dim} style={styles.input} />
        <ScrollView>
          {filtered.map(item => (
            <Pressable key={item.id} style={styles.pickRow} onPress={() => { onPick(item); setOpen(false); }}>
              <Text style={styles.pickTitle}>{item.name}</Text>
              <Text style={styles.dim}>{muscleLabel(item.template.primaryMuscles[0])} · {item.template.equipment}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </Sheet>
    </>
  );
}

function RoutineEditor({ program, onClose, onUpdate }: { program: ProgramTemplate | null; onClose: () => void; onUpdate: (program: ProgramTemplate) => void }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => exerciseLibrary.filter(item => item.name.toLowerCase().includes(query.toLowerCase())).slice(0, 50), [query]);
  if (!program) return null;
  const activeProgram = program;

  function move(from: number, to: number) {
    if (to < 0 || to >= activeProgram.exercises.length) return;
    const exercises = [...activeProgram.exercises];
    const [item] = exercises.splice(from, 1);
    exercises.splice(to, 0, item);
    onUpdate({ ...activeProgram, exercises });
  }

  return (
    <Sheet visible={Boolean(activeProgram)} title={`Edit ${activeProgram.name}`} onClose={onClose}>
      <ScrollView>
        <Text style={styles.field}>Name</Text>
        <TextInput value={activeProgram.name} onChangeText={name => onUpdate({ ...activeProgram, name })} style={styles.input} />
        <Text style={styles.field}>Description</Text>
        <TextInput value={activeProgram.description} onChangeText={description => onUpdate({ ...activeProgram, description })} style={styles.input} />
        {activeProgram.exercises.map((exercise, index) => (
          <View key={`${exercise.exerciseId}-${index}`} style={styles.editorRow}>
            <Text style={styles.listText}>{index + 1}. {exercise.exerciseName}</Text>
            <View style={styles.editorActions}>
              <Pressable onPress={() => move(index, index - 1)}><Text style={styles.editorAction}>↑</Text></Pressable>
              <Pressable onPress={() => move(index, index + 1)}><Text style={styles.editorAction}>↓</Text></Pressable>
              <Pressable onPress={() => onUpdate({ ...activeProgram, exercises: activeProgram.exercises.filter((_, itemIndex) => itemIndex !== index) })}><Text style={[styles.editorAction, { color: palette.red }]}>×</Text></Pressable>
            </View>
          </View>
        ))}
        <Text style={styles.field}>Add exercise</Text>
        <TextInput value={query} onChangeText={setQuery} placeholder="Search library" placeholderTextColor={palette.dim} style={styles.input} />
        {filtered.map(item => (
          <Pressable key={item.id} style={styles.pickRow} onPress={() => onUpdate({ ...activeProgram, exercises: [...activeProgram.exercises, blankExercise(item)] })}>
            <Text style={styles.pickTitle}>{item.name}</Text>
            <Text style={styles.dim}>{muscleLabel(item.template.primaryMuscles[0])} · {item.template.equipment}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </Sheet>
  );
}

function ExercisesScreen({ templates, history }: { templates: ExerciseTemplate[]; history: WorkoutSession[] }) {
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | 'all'>('all');
  const [selected, setSelected] = useState<ExerciseTemplate | null>(null);
  const filtered = useMemo(() => templates.filter(item => {
    const text = `${item.name} ${item.equipment} ${item.aliases?.join(' ') ?? ''}`.toLowerCase();
    return text.includes(query.toLowerCase()) && matchesMuscle(item, muscle);
  }), [muscle, query, templates]);
  const groups = muscleOrder.map(group => ({ group, items: filtered.filter(item => item.primaryMuscles[0] === group) })).filter(group => group.items.length);

  return (
    <>
      <ScrollView contentContainerStyle={styles.screen}>
        <Text style={styles.largeTitle}>Exercises</Text>
        <TextInput value={query} onChangeText={setQuery} placeholder="Search exercise library" placeholderTextColor={palette.dim} style={styles.input} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
          <Pill label="All" selected={muscle === 'all'} onPress={() => setMuscle('all')} />
          {muscleOrder.map(item => <Pill key={item} label={muscleLabel(item)} selected={muscle === item} onPress={() => setMuscle(item)} />)}
        </ScrollView>
        {groups.map(group => (
          <View key={group.group}>
            <Text style={styles.sectionTitle}>{muscleLabel(group.group)}</Text>
            {group.items.map(item => (
              <Pressable key={item.id} style={styles.exerciseLibraryRow} onPress={() => setSelected(item)}>
                <Text style={styles.pickTitle}>{item.name}</Text>
                <Text style={styles.dim}>{item.equipment} · {item.kind}</Text>
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>
      <ExerciseDetail exercise={selected} history={history} onClose={() => setSelected(null)} />
    </>
  );
}

function ExerciseDetail({ exercise, history, onClose }: { exercise: ExerciseTemplate | null; history: WorkoutSession[]; onClose: () => void }) {
  const key = exercise?.id ?? '';
  const sets = useMemo(() => completedSessions(history).flatMap(session => session.exercises.filter(block => normalizeExerciseKey(block) === key).flatMap(block => block.sets)), [history, key]);
  const bestWeight = sets.reduce((best, set) => Math.max(best, set.loadKg), 0);
  const bestE1rm = sets.reduce((best, set) => Math.max(best, estimated1Rm(set)), 0);
  const bestVolume = sets.reduce((best, set) => Math.max(best, setVolumeKg(set)), 0);
  const bestReps = sets.reduce((best, set) => Math.max(best, set.repetitions), 0);

  return (
    <Sheet visible={Boolean(exercise)} title={exercise?.name ?? 'Exercise'} onClose={onClose}>
      <ScrollView>
        <View style={styles.metricRow}>
          <Metric label="Heaviest" value={kg(bestWeight)} />
          <Metric label="1RM" value={kg(bestE1rm)} />
        </View>
        <View style={styles.metricRow}>
          <Metric label="Best Volume" value={kg(bestVolume)} />
          <Metric label="Most Reps" value={String(bestReps)} />
        </View>
        <Text style={styles.sectionTitle}>History</Text>
        {sets.slice().reverse().slice(0, 20).map(set => <Text key={set.id} style={styles.historyLine}>{dateLabel(set.completedAt)} · {compactSet(set)} · {techniqueLabel(set.type)}</Text>)}
      </ScrollView>
    </Sheet>
  );
}

function ProfileScreen({ data, onDataChange, onExport, onImport }: { data: AppData; onDataChange: (data: AppData) => void; onExport: () => void; onImport: () => void }) {
  const completed = completedSessions(data.history);
  const streak = computeStreak(data.history);
  const heatmap = workoutHeatmap(data.history, 10).flat();
  const muscles = muscleSetDistribution(data.history, data.exerciseTemplates).slice(0, 10);
  const maxMuscle = Math.max(...muscles.map(item => item.totalWeightedSets), 1);
  const [token, setToken] = useState('');
  const [syncStatus, setSyncStatus] = useState(data.settings.githubSync.lastStatus ?? '');
  const sync = data.settings.githubSync;

  useEffect(() => { loadGitHubToken().then(setToken).catch(() => undefined); }, []);

  function updateSync(patch: Partial<typeof sync>) {
    onDataChange({ ...data, settings: { ...data.settings, githubSync: { ...sync, ...patch } } });
  }

  async function push() {
    try {
      setSyncStatus('Pushing to GitHub…');
      const result = await pushAppDataToGitHub(data, token);
      if (result.data) onDataChange(result.data);
      setSyncStatus(result.message);
    } catch (error) {
      setSyncStatus(error instanceof Error ? error.message : 'GitHub push failed.');
    }
  }

  async function pull() {
    try {
      setSyncStatus('Pulling from GitHub…');
      const result = await pullAppDataFromGitHub(sync, token);
      if (result.data) onDataChange(result.data);
      setSyncStatus(result.message);
    } catch (error) {
      setSyncStatus(error instanceof Error ? error.message : 'GitHub pull failed.');
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.profileHead}>
        <View style={styles.profileAvatar}><Text style={styles.profileAvatarText}>L</Text></View>
        <View>
          <Text style={styles.largeTitle}>Lucas</Text>
          <Text style={styles.muted}>Private workout profile</Text>
        </View>
      </View>
      <View style={styles.metricRow}>
        <Metric label="Workouts" value={String(completed.length)} />
        <Metric label="Streak" value={String(streak.currentStreak)} />
      </View>
      <View style={styles.metricRow}>
        <Metric label="Volume" value={kg(completed.reduce((total, session) => total + volumeForSession(session), 0))} />
        <Metric label="Sets" value={String(completed.reduce((total, session) => total + setCountForSession(session), 0))} />
      </View>
      <Card>
        <Text style={styles.cardTitle}>Calendar</Text>
        <View style={styles.heatmap}>
          {heatmap.map(day => <View key={day.date} style={[styles.dayDot, day.hasWorkout && styles.dayDotActive, day.sessionCount > 1 && styles.dayDotStrong]} />)}
        </View>
      </Card>
      <Card>
        <Text style={styles.cardTitle}>Muscle Distribution</Text>
        {muscles.map(item => (
          <View key={item.muscle} style={styles.muscleRow}>
            <Text style={styles.muscleName}>{muscleLabel(item.muscle)}</Text>
            <View style={styles.barTrack}><View style={[styles.barFill, { width: `${Math.max(4, (item.totalWeightedSets / maxMuscle) * 100)}%` as DimensionValue }]} /></View>
            <Text style={styles.dim}>{item.totalWeightedSets.toFixed(1)}</Text>
          </View>
        ))}
      </Card>
      <Card>
        <Text style={styles.cardTitle}>Data & Sync</Text>
        <Text style={styles.muted}>Local data stays on this device. Use GitHub sync as your cloud backup.</Text>
        <View style={styles.inlineButtons}>
          <AppButton label="Export" tone="secondary" onPress={onExport} />
          <AppButton label="Import" tone="secondary" onPress={onImport} />
        </View>
        <View style={styles.syncGrid}>
          <TextInput value={sync.owner} onChangeText={owner => updateSync({ owner })} placeholder="owner" placeholderTextColor={palette.dim} autoCapitalize="none" style={styles.input} />
          <TextInput value={sync.repo} onChangeText={repo => updateSync({ repo })} placeholder="repo" placeholderTextColor={palette.dim} autoCapitalize="none" style={styles.input} />
        </View>
        <TextInput value={sync.path} onChangeText={path => updateSync({ path })} placeholder="data/setlog.json" placeholderTextColor={palette.dim} autoCapitalize="none" style={styles.input} />
        <TextInput value={token} onChangeText={value => { setToken(value); saveGitHubToken(value); }} placeholder="GitHub token" placeholderTextColor={palette.dim} secureTextEntry autoCapitalize="none" style={styles.input} />
        {syncStatus ? <Text style={styles.muted}>{syncStatus}</Text> : null}
        <View style={styles.inlineButtons}>
          <AppButton label="Push" onPress={push} />
          <AppButton label="Pull" tone="secondary" onPress={pull} />
        </View>
      </Card>
    </ScrollView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  screen: { padding: 16, paddingTop: 18, paddingBottom: 112, backgroundColor: palette.bg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  largeTitle: { color: palette.text, fontSize: 36, fontWeight: '900', letterSpacing: -1.2 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: palette.blue, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: palette.text, fontSize: 18, fontWeight: '900' },
  card: { backgroundColor: palette.card, borderColor: palette.line, borderWidth: 1, borderRadius: 18, padding: 15, marginBottom: 12 },
  hero: { minHeight: 158, justifyContent: 'space-between' },
  liveCard: { borderColor: palette.blue },
  overline: { color: palette.blue, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  heroTitle: { color: palette.text, fontSize: 31, fontWeight: '900', letterSpacing: -0.8, marginTop: 4 },
  muted: { color: palette.muted, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  dim: { color: palette.dim, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  cardTitle: { color: palette.text, fontSize: 16, fontWeight: '900' },
  workoutName: { color: palette.text, fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  inlineButtons: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 12 },
  button: { borderRadius: 12, minHeight: 44, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.raised, borderWidth: 1, borderColor: palette.line, flexGrow: 1 },
  buttonPrimary: { backgroundColor: palette.blue, borderColor: palette.blue },
  buttonDanger: { backgroundColor: '#32131B', borderColor: '#6D2A39' },
  buttonText: { color: palette.text, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  secondaryText: { color: palette.text },
  dangerText: { color: palette.red },
  disabled: { opacity: 0.38 },
  pressed: { opacity: 0.7 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, marginBottom: 10 },
  sectionTitle: { color: palette.text, fontSize: 20, fontWeight: '900', marginTop: 14, marginBottom: 8 },
  sectionMeta: { color: palette.dim, fontSize: 10, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  feedHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarSmall: { width: 34, height: 34, borderRadius: 17, backgroundColor: palette.blue, alignItems: 'center', justifyContent: 'center' },
  avatarSmallText: { color: palette.text, fontWeight: '900' },
  metricRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  metric: { flex: 1, backgroundColor: palette.raised, borderWidth: 1, borderColor: palette.line, borderRadius: 14, padding: 12 },
  metricValue: { color: palette.text, fontSize: 20, fontWeight: '900' },
  metricLabel: { color: palette.dim, fontSize: 9, fontWeight: '900', textTransform: 'uppercase', marginTop: 4 },
  listLine: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 10, marginTop: 10, gap: 10 },
  listText: { color: palette.text, fontSize: 13, fontWeight: '800', flex: 1 },
  reactions: { flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: palette.line, marginTop: 13, paddingTop: 12 },
  reaction: { color: palette.muted, fontSize: 12, fontWeight: '900' },
  save: { color: palette.green, fontSize: 11, fontWeight: '900' },
  segment: { flexDirection: 'row', backgroundColor: palette.surface, borderRadius: 14, padding: 4, marginBottom: 12, borderWidth: 1, borderColor: palette.line },
  segmentItem: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  segmentActive: { backgroundColor: palette.blue },
  segmentText: { color: palette.muted, fontSize: 12, fontWeight: '900' },
  segmentTextActive: { color: palette.text },
  routineTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  routineExercise: { color: palette.muted, fontSize: 12, fontWeight: '700', marginTop: 7 },
  pill: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8, backgroundColor: palette.raised, borderWidth: 1, borderColor: palette.line, marginRight: 7 },
  pillSelected: { backgroundColor: palette.blueSoft, borderColor: palette.blue },
  pillText: { color: palette.muted, fontSize: 11, fontWeight: '900' },
  pillTextSelected: { color: palette.text },
  exerciseHead: { flexDirection: 'row', gap: 11, alignItems: 'center' },
  exerciseNumber: { width: 34, height: 34, borderRadius: 10, backgroundColor: palette.blueSoft, alignItems: 'center', justifyContent: 'center' },
  exerciseNumberText: { color: palette.blue, fontWeight: '900' },
  exerciseTitle: { color: palette.text, fontSize: 18, fontWeight: '900' },
  remove: { color: palette.dim, fontSize: 26, fontWeight: '800', padding: 4 },
  table: { borderWidth: 1, borderColor: palette.line, borderRadius: 12, overflow: 'hidden', marginTop: 13 },
  tableRowHead: { flexDirection: 'row', backgroundColor: palette.raised, paddingVertical: 8 },
  tableRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: palette.line, minHeight: 40, alignItems: 'center' },
  th: { flex: 0.8, color: palette.dim, fontSize: 9, fontWeight: '900', textAlign: 'center' },
  thWide: { flex: 1.6, color: palette.dim, fontSize: 9, fontWeight: '900', textAlign: 'center' },
  td: { flex: 0.8, color: palette.text, fontSize: 12, fontWeight: '800', textAlign: 'center' },
  tdWide: { flex: 1.6, color: palette.muted, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  loggerBox: { backgroundColor: palette.surface, borderRadius: 14, padding: 12, marginTop: 12, borderWidth: 1, borderColor: palette.line },
  stepGrid: { flexDirection: 'row', gap: 8, marginTop: 10 },
  stepper: { flex: 1, backgroundColor: palette.raised, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: palette.line },
  stepLabel: { color: palette.dim, fontSize: 9, fontWeight: '900', textAlign: 'center', textTransform: 'uppercase' },
  stepRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  stepAction: { color: palette.blue, fontSize: 24, fontWeight: '900', paddingHorizontal: 4 },
  stepValue: { color: palette.text, fontSize: 15, fontWeight: '900' },
  quickWeightGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  weightChip: { width: '23.5%', backgroundColor: palette.raised, borderWidth: 1, borderColor: palette.line, borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  weightChipText: { color: palette.blue, fontSize: 11, fontWeight: '900' },
  chipScroll: { paddingVertical: 10, paddingRight: 24 },
  input: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, color: palette.text, paddingHorizontal: 12, marginTop: 8, fontSize: 13, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: '#000000CC', justifyContent: 'flex-end' },
  sheet: { maxHeight: '86%', backgroundColor: palette.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, borderColor: palette.line, borderWidth: 1 },
  handle: { width: 42, height: 4, borderRadius: 2, backgroundColor: palette.line, alignSelf: 'center', marginBottom: 13 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sheetTitle: { color: palette.text, fontSize: 24, fontWeight: '900' },
  close: { width: 34, height: 34, borderRadius: 17, backgroundColor: palette.raised, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: palette.muted, fontSize: 22, fontWeight: '900' },
  pickRow: { paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: palette.line },
  pickTitle: { color: palette.text, fontSize: 14, fontWeight: '900' },
  field: { color: palette.blue, fontSize: 10, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase', marginTop: 12 },
  editorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: palette.line },
  editorActions: { flexDirection: 'row', gap: 16 },
  editorAction: { color: palette.blue, fontSize: 20, fontWeight: '900' },
  exerciseLibraryRow: { backgroundColor: palette.card, borderColor: palette.line, borderWidth: 1, borderRadius: 14, padding: 13, marginBottom: 8 },
  historyLine: { color: palette.muted, fontSize: 12, fontWeight: '700', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: palette.line },
  profileHead: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 10 },
  profileAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: palette.blue, alignItems: 'center', justifyContent: 'center' },
  profileAvatarText: { color: palette.text, fontSize: 28, fontWeight: '900' },
  heatmap: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 12 },
  dayDot: { width: 13, height: 13, borderRadius: 4, backgroundColor: palette.raised, borderWidth: 1, borderColor: palette.line },
  dayDotActive: { backgroundColor: palette.blueSoft, borderColor: palette.blue },
  dayDotStrong: { backgroundColor: palette.blue },
  muscleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  muscleName: { color: palette.text, fontSize: 12, fontWeight: '900', width: 86 },
  barTrack: { flex: 1, height: 8, borderRadius: 999, backgroundColor: palette.raised, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: palette.blue, borderRadius: 999 },
  syncGrid: { flexDirection: 'row', gap: 8 },
  tabbar: { position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: 84, backgroundColor: '#080A0EFA', borderTopWidth: 1, borderTopColor: palette.line, flexDirection: 'row', paddingTop: 8, paddingBottom: 14 },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  tabIcon: { color: palette.dim, fontSize: 21, fontWeight: '900' },
  tabText: { color: palette.dim, fontSize: 10, fontWeight: '900' },
  activeTab: { color: palette.blue },
});
