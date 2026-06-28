import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { createDefaultData, mergeDefaultPrograms, sessionFromProgram } from './src/data/appDefaults';
import { currentCycleNumber, isProgramCode } from './src/data/cycles';
import { nowOnLocalDate } from './src/data/sessionDates';
import { chooseBackupFile, exportBackup } from './src/platform/backup';
import { setupPwa } from './src/platform/pwa';
import { AnalyticsScreen } from './src/screens/AnalyticsScreen';
import { CyclesScreen } from './src/screens/CyclesScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { ProgramsScreen } from './src/screens/ProgramsScreen';
import { WorkoutScreen } from './src/screens/WorkoutScreen';
import { loadAppData, loadLegacySets, saveAppData } from './src/storage/workoutStorage';
import { colors, radius, type as typeScale } from './src/theme';
import type { AppData, ExerciseBlock, ProgramTemplate, WorkoutSession } from './src/types/training';

const tabs = ['Treino', 'Ciclos', 'Histórico', 'Análises', 'Programas'] as const;
type Tab = typeof tabs[number];

function emptyContinuation(session: WorkoutSession, cycleNumber?: number): WorkoutSession {
  const now = Date.now();
  return {
    ...session,
    id: 'session-' + now,
    cycleNumber,
    startedAt: new Date(now).toISOString(),
    endedAt: undefined,
    exercises: session.exercises.map((exercise, index) => ({
      ...exercise,
      id: 'block-' + now + '-' + index,
      sets: [],
    })),
  };
}

function programMatchesSession(session: WorkoutSession, program: ProgramTemplate): boolean {
  return session.programId === program.id
    || session.name === program.name
    || (!session.programId && isProgramCode(session.name) && program.id === 'personalized-' + session.name.toLowerCase());
}

function syncActiveSessionWithProgram(
  session: WorkoutSession,
  previousProgram: ProgramTemplate | undefined,
  nextProgram: ProgramTemplate,
): WorkoutSession {
  if (!previousProgram || !programMatchesSession(session, previousProgram)) return session;
  const usedBlockIds = new Set<string>();
  const blocksByExerciseId = new Map(session.exercises.map(block => [block.exerciseId, block]));
  const now = Date.now();

  const exercises = nextProgram.exercises.map((exercise, index): ExerciseBlock => {
    const previousExerciseAtIndex = previousProgram.exercises[index];
    const matched = blocksByExerciseId.get(exercise.exerciseId)
      ?? (previousExerciseAtIndex ? blocksByExerciseId.get(previousExerciseAtIndex.exerciseId) : undefined);
    if (matched) usedBlockIds.add(matched.id);
    return {
      ...exercise,
      id: matched?.id ?? 'block-' + now + '-' + index,
      sets: matched?.sets ?? [],
    };
  });

  const unsyncedLoggedBlocks = session.exercises.filter(block => !usedBlockIds.has(block.id) && block.sets.length > 0);
  return {
    ...session,
    name: nextProgram.name,
    programId: nextProgram.id,
    exercises: [...exercises, ...unsyncedLoggedBlocks],
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('Treino');
  const [data, setData] = useState<AppData>(() => createDefaultData());
  const [ready, setReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'loading' | 'saved' | 'error'>('loading');

  useEffect(() => {
    setupPwa();
    let active = true;
    Promise.all([loadAppData(), loadLegacySets()])
      .then(([stored, legacy]) => {
        if (!active) return;
        if (stored) {
          setData({ ...stored, programs: mergeDefaultPrograms(stored.programs) });
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
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    setSaveStatus('loading');
    saveAppData(data).then(() => setSaveStatus('saved')).catch(() => setSaveStatus('error'));
  }, [data, ready]);

  function finishWorkout() {
    setData(current => {
      const cycleNumber = isProgramCode(current.activeSession.name)
        ? current.activeSession.cycleNumber ?? currentCycleNumber(current.history)
        : undefined;
      const completed: WorkoutSession = {
        ...current.activeSession,
        cycleNumber,
        programId: current.activeSession.programId ?? (isProgramCode(current.activeSession.name) ? 'personalized-' + current.activeSession.name.toLowerCase() : undefined),
        endedAt: nowOnLocalDate(current.activeSession.startedAt),
      };
      const history = [completed, ...current.history];
      const nextCycle = isProgramCode(completed.name) ? currentCycleNumber(history) : undefined;
      return {
        ...current,
        activeSession: emptyContinuation(current.activeSession, nextCycle),
        history,
      };
    });
    setActiveTab('Histórico');
  }

  function startProgram(program: ProgramTemplate) {
    setData(current => ({
      ...current,
      activeSession: sessionFromProgram(program, isProgramCode(program.name) ? currentCycleNumber(current.history) : undefined),
    }));
    setActiveTab('Treino');
  }

  function duplicateProgram(program: ProgramTemplate) {
    const now = Date.now();
    setData(current => ({
      ...current,
      programs: [...current.programs, { ...program, id: 'custom-' + now, name: program.name + ' · cópia', split: undefined }],
    }));
  }

  function createBlankProgram() {
    const now = Date.now();
    setData(current => ({
      ...current,
      programs: [...current.programs, {
        id: 'custom-' + now,
        name: 'Novo treino ' + (current.programs.filter(item => item.id.startsWith('custom-')).length + 1),
        description: 'Treino criado manualmente',
        exercises: [],
      }],
    }));
    setActiveTab('Programas');
  }

  async function restoreBackup() {
    const restored = await chooseBackupFile();
    if (restored) setData({ ...restored, programs: mergeDefaultPrograms(restored.programs) });
  }

  function createProgramFromWorkout() {
    const now = Date.now();
    const program: ProgramTemplate = {
      id: 'custom-' + now,
      name: 'Meu programa ' + (data.programs.filter(item => item.id.startsWith('custom-')).length + 1),
      description: 'Criado a partir do treino atual',
      exercises: data.activeSession.exercises.map(({ exerciseId, exerciseName, targetSets, targetRepRange, targetRirRange, targetRestSeconds, setPrescriptions, notes }) => ({
        exerciseId, exerciseName, targetSets, targetRepRange, targetRirRange, targetRestSeconds, setPrescriptions, notes,
      })),
    };
    setData(current => ({ ...current, programs: [...current.programs, program] }));
  }

  return (
    <SafeAreaView style={styles.app}>
      <StatusBar style="light" />
      {activeTab === 'Treino' && (
        <WorkoutScreen
          session={data.activeSession}
          programs={data.programs}
          history={data.history}
          saveStatus={saveStatus}
          onChange={session => setData(current => ({ ...current, activeSession: session }))}
          onFinish={finishWorkout}
          onSelectProgram={startProgram}
        />
      )}
      {activeTab === 'Ciclos' && <CyclesScreen history={data.history} onExport={() => exportBackup(data)} onImport={restoreBackup} />}
      {activeTab === 'Histórico' && (
        <HistoryScreen
          history={data.history}
          onUpdate={updated => setData(current => ({ ...current, history: current.history.map(session => session.id === updated.id ? updated : session) }))}
          onDelete={id => setData(current => ({ ...current, history: current.history.filter(session => session.id !== id) }))}
        />
      )}
      {activeTab === 'Análises' && <AnalyticsScreen sessions={data.history} />}
      {activeTab === 'Programas' && (
        <ProgramsScreen
          programs={data.programs}
          onStart={startProgram}
          onDuplicate={duplicateProgram}
          onCreate={createProgramFromWorkout}
          onCreateBlank={createBlankProgram}
          onUpdate={program => setData(current => {
            const previousProgram = current.programs.find(item => item.id === program.id);
            return {
              ...current,
              programs: current.programs.map(item => item.id === program.id ? program : item),
              activeSession: syncActiveSessionWithProgram(current.activeSession, previousProgram, program),
            };
          })}
          onDelete={id => setData(current => ({ ...current, programs: current.programs.filter(program => program.id !== id) }))}
        />
      )}
      <View style={styles.tabBar}>
        {tabs.map((tab, index) => {
          const isActive = activeTab === tab;
          const icons = ['⊕', '↻', '≡', '▲', '◈'];
          return (
            <Pressable key={tab} style={styles.tab} onPress={() => setActiveTab(tab)}>
              <View style={[styles.tabIconWrap, isActive && styles.tabIconWrapActive]}>
                <Text style={[styles.tabIcon, isActive && styles.tabIconActive]}>{icons[index]}</Text>
              </View>
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: colors.background },
  tabBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    minHeight: 80,
    backgroundColor: colors.card,
    borderTopWidth: 1, borderTopColor: colors.border,
    flexDirection: 'row',
    paddingTop: 10, paddingBottom: 18,
  },
  tab: { flex: 1, alignItems: 'center', gap: 4 },
  tabIconWrap: { width: 36, height: 28, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  tabIconWrapActive: { backgroundColor: colors.accentSoft },
  tabIcon: { color: colors.muted, fontSize: 15 },
  tabIconActive: { color: colors.accent },
  tabText: { color: colors.textDim, fontSize: 8, fontWeight: '600' },
  tabTextActive: { color: colors.accent, fontWeight: '700' },
});
