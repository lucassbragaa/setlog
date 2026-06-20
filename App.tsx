import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { createDefaultData, mergeDefaultPrograms, sessionFromProgram } from './src/data/appDefaults';
import { setupPwa } from './src/platform/pwa';
import { AnalyticsScreen } from './src/screens/AnalyticsScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { ProgramsScreen } from './src/screens/ProgramsScreen';
import { WorkoutScreen } from './src/screens/WorkoutScreen';
import { loadAppData, loadLegacySets, saveAppData } from './src/storage/workoutStorage';
import { colors } from './src/theme';
import type { AppData, ProgramTemplate, WorkoutSession } from './src/types/training';

const tabs = ['Treino', 'Histórico', 'Análises', 'Programas'] as const;
type Tab = typeof tabs[number];

function emptyContinuation(session: WorkoutSession): WorkoutSession {
  const now = Date.now();
  return {
    id: 'session-' + now,
    name: session.name,
    startedAt: new Date(now).toISOString(),
    exercises: session.exercises.map((exercise, index) => ({
      ...exercise,
      id: 'block-' + now + '-' + index,
      sets: [],
    })),
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
    const completed = { ...data.activeSession, endedAt: new Date().toISOString() };
    setData(current => ({
      ...current,
      activeSession: emptyContinuation(current.activeSession),
      history: [completed, ...current.history],
    }));
    setActiveTab('Histórico');
  }

  function startProgram(program: ProgramTemplate) {
    setData(current => ({ ...current, activeSession: sessionFromProgram(program) }));
    setActiveTab('Treino');
  }

  function duplicateProgram(program: ProgramTemplate) {
    const now = Date.now();
    setData(current => ({
      ...current,
      programs: [...current.programs, { ...program, id: 'custom-' + now, name: program.name + ' · cópia' }],
    }));
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
          saveStatus={saveStatus}
          onChange={session => setData(current => ({ ...current, activeSession: session }))}
          onFinish={finishWorkout}
        />
      )}
      {activeTab === 'Histórico' && (
        <HistoryScreen history={data.history} onDelete={id => setData(current => ({ ...current, history: current.history.filter(session => session.id !== id) }))} />
      )}
      {activeTab === 'Análises' && <AnalyticsScreen sessions={[data.activeSession, ...data.history]} />}
      {activeTab === 'Programas' && (
        <ProgramsScreen
          programs={data.programs}
          onStart={startProgram}
          onDuplicate={duplicateProgram}
          onCreate={createProgramFromWorkout}
          onUpdate={program => setData(current => ({ ...current, programs: current.programs.map(item => item.id === program.id ? program : item) }))}
          onDelete={id => setData(current => ({ ...current, programs: current.programs.filter(program => program.id !== id) }))}
        />
      )}
      <View style={styles.tabBar}>
        {tabs.map((tab, index) => (
          <Pressable key={tab} style={styles.tab} onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabIcon, activeTab === tab && styles.active]}>{['●', '▤', '⌁', '◇'][index]}</Text>
            <Text style={[styles.tabText, activeTab === tab && styles.active]}>{tab}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: colors.background },
  tabBar: { position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: 78, backgroundColor: '#0C1014F5', borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', paddingTop: 11, paddingBottom: 15 },
  tab: { flex: 1, alignItems: 'center', gap: 5 },
  tabIcon: { color: colors.muted, fontSize: 17 },
  tabText: { color: colors.muted, fontSize: 10, fontWeight: '600' },
  active: { color: colors.accent },
});
