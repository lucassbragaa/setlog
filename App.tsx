import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Circle, Line, Path, Rect, Svg } from 'react-native-svg';

import { createDefaultData, mergeDefaultPrograms, sessionFromProgram } from './src/data/appDefaults';
import { currentCycleNumber, isProgramCode } from './src/data/cycles';
import { nowOnLocalDate } from './src/data/sessionDates';
import { chooseBackupFile, exportBackup } from './src/platform/backup';
import { setupPwa } from './src/platform/pwa';
import { AnalyticsScreen } from './src/screens/AnalyticsScreen';
import { CyclesScreen } from './src/screens/CyclesScreen';
import { ExercisesScreen } from './src/screens/ExercisesScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { ProgramsScreen } from './src/screens/ProgramsScreen';
import { WorkoutScreen } from './src/screens/WorkoutScreen';
import { loadAppData, loadLegacySets, saveAppData } from './src/storage/workoutStorage';
import { colors } from './src/theme';
import type { AppData, ExerciseBlock, ProgramTemplate, WorkoutSession } from './src/types/training';

const tabs = ['Treino', 'Rotinas', 'Exercicios', 'Historico', 'Analises', 'Perfil'] as const;
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

function TabIcon({ tab, active }: { tab: Tab; active: boolean }) {
  const color = active ? colors.accent : colors.textDim;
  const common = { stroke: color, strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  if (tab === 'Treino') {
    return <Svg width={22} height={22} viewBox="0 0 24 24"><Line x1="5" y1="12" x2="19" y2="12" {...common} /><Rect x="2.5" y="8" width="3" height="8" rx="1" {...common} /><Rect x="18.5" y="8" width="3" height="8" rx="1" {...common} /><Line x1="8" y1="9" x2="8" y2="15" {...common} /><Line x1="16" y1="9" x2="16" y2="15" {...common} /></Svg>;
  }
  if (tab === 'Perfil') {
    return <Svg width={22} height={22} viewBox="0 0 24 24"><Path d="M17 3l4 4-4 4" {...common} /><Path d="M21 7h-9a7 7 0 0 0-6.7 5" {...common} /><Path d="M7 21l-4-4 4-4" {...common} /><Path d="M3 17h9a7 7 0 0 0 6.7-5" {...common} /></Svg>;
  }
  if (tab === 'Rotinas') {
    return <Svg width={22} height={22} viewBox="0 0 24 24"><Rect x="4" y="5" width="16" height="4" rx="1.5" {...common} /><Rect x="4" y="11" width="16" height="4" rx="1.5" {...common} /><Rect x="4" y="17" width="16" height="2" rx="1" {...common} /></Svg>;
  }
  if (tab === 'Exercicios') {
    return <Svg width={22} height={22} viewBox="0 0 24 24"><Circle cx="7" cy="12" r="3" {...common} /><Circle cx="17" cy="12" r="3" {...common} /><Line x1="10" y1="12" x2="14" y2="12" {...common} /><Line x1="3" y1="9" x2="3" y2="15" {...common} /><Line x1="21" y1="9" x2="21" y2="15" {...common} /></Svg>;
  }
  if (tab === 'Historico') {
    return <Svg width={22} height={22} viewBox="0 0 24 24"><Circle cx="12" cy="12" r="8" {...common} /><Path d="M12 7v5l3 2" {...common} /></Svg>;
  }
  if (tab === 'Analises') {
    return <Svg width={22} height={22} viewBox="0 0 24 24"><Rect x="4" y="13" width="3" height="7" rx="1" fill={color} /><Rect x="10.5" y="9" width="3" height="11" rx="1" fill={color} /><Rect x="17" y="5" width="3" height="15" rx="1" fill={color} /></Svg>;
  }
  return <Svg width={22} height={22} viewBox="0 0 24 24"><Rect x="4" y="4" width="6" height="6" rx="1.5" {...common} /><Rect x="14" y="4" width="6" height="6" rx="1.5" {...common} /><Rect x="4" y="14" width="6" height="6" rx="1.5" {...common} /><Rect x="14" y="14" width="6" height="6" rx="1.5" {...common} /></Svg>;
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
    setActiveTab('Historico');
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
      programs: [...current.programs, { ...program, id: 'custom-' + now, name: program.name + ' - copia', split: undefined, folderId: 'folder-custom', order: current.programs.length + 1 }],
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
        folderId: 'folder-custom',
        order: current.programs.length + 1,
        exercises: [],
      }],
    }));
    setActiveTab('Rotinas');
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
      folderId: 'folder-custom',
      order: data.programs.length + 1,
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
      {activeTab === 'Perfil' && <CyclesScreen history={data.history} data={data} onDataChange={setData} onExport={() => exportBackup(data)} onImport={restoreBackup} />}
      {activeTab === 'Historico' && (
        <HistoryScreen
          history={data.history}
          onUpdate={updated => setData(current => ({ ...current, history: current.history.map(session => session.id === updated.id ? updated : session) }))}
          onDelete={id => setData(current => ({ ...current, history: current.history.filter(session => session.id !== id) }))}
        />
      )}
      {activeTab === 'Analises' && <AnalyticsScreen sessions={data.history} exerciseTemplates={data.exerciseTemplates} />}
      {activeTab === 'Exercicios' && <ExercisesScreen history={data.history} programs={data.programs} exerciseTemplates={data.exerciseTemplates} />}
      {activeTab === 'Rotinas' && (
        <ProgramsScreen
          programs={data.programs}
          folders={data.routineFolders}
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
          onReorder={programs => setData(current => ({ ...current, programs }))}
          onDelete={id => setData(current => ({ ...current, programs: current.programs.filter(program => program.id !== id) }))}
        />
      )}
      <View style={styles.tabBar}>
        {tabs.map(tab => {
          const active = activeTab === tab;
          return (
            <Pressable key={tab} style={styles.tab} onPress={() => setActiveTab(tab)}>
              <TabIcon tab={tab} active={active} />
              <Text style={[styles.tabText, active && styles.active]}>{tab}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: colors.background },
  tabBar: { position: 'absolute', left: 10, right: 10, bottom: 10, minHeight: 74, backgroundColor: '#10141CF5', borderWidth: 1, borderColor: colors.border, borderRadius: 24, flexDirection: 'row', paddingTop: 10, paddingBottom: 10 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5 },
  tabText: { color: colors.textDim, fontSize: 8, fontWeight: '800' },
  active: { color: colors.accent },
});
