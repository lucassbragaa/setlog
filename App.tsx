import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { demoSession } from './src/data/demoSession';
import { setupPwa } from './src/platform/pwa';
import { loadActiveSets, saveActiveSets } from './src/storage/workoutStorage';
import { colors } from './src/theme';
import type { LoggedSet, SetType } from './src/types/training';

const tabs = ['Treino', 'Histórico', 'Análises', 'Programas'] as const;
type Tab = (typeof tabs)[number];

function formatTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainder = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
}

function Stepper({ label, value, suffix, step, onChange }: {
  label: string;
  value: number;
  suffix?: string;
  step: number;
  onChange: (next: number) => void;
}) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.mutedLabel}>{label}</Text>
      <View style={styles.stepperRow}>
        <Pressable style={styles.stepButton} onPress={() => onChange(Math.max(0, value - step))}>
          <Text style={styles.stepButtonText}>−</Text>
        </Pressable>
        <Text style={styles.stepValue}>{value}{suffix}</Text>
        <Pressable style={styles.stepButton} onPress={() => onChange(value + step)}>
          <Text style={styles.stepButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function WorkoutScreen() {
  const [sets, setSets] = useState<LoggedSet[]>(demoSession.exercises[0].sets);
  const [storageReady, setStorageReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'loading' | 'saved' | 'error'>('loading');
  const [weight, setWeight] = useState(100);
  const [reps, setReps] = useState(8);
  const [rir, setRir] = useState(2);
  const [setType, setSetType] = useState<SetType>('working');
  const [restSeconds, setRestSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);

  useEffect(() => {
    let active = true;

    loadActiveSets()
      .then(storedSets => {
        if (active && storedSets) setSets(storedSets);
      })
      .catch(() => {
        if (active) setSaveStatus('error');
      })
      .finally(() => {
        if (active) setStorageReady(true);
      });

    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!storageReady) return;

    setSaveStatus('loading');
    saveActiveSets(sets)
      .then(() => setSaveStatus('saved'))
      .catch(() => setSaveStatus('error'));
  }, [sets, storageReady]);

  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => setRestSeconds(current => current + 1), 1000);
    return () => clearInterval(interval);
  }, [timerRunning]);

  const volume = useMemo(
    () => sets.reduce((total, set) => total + set.loadKg * set.repetitions, 0),
    [sets],
  );

  function logSet() {
    setSets(current => [
      ...current,
      {
        id: `set-${Date.now()}`,
        order: current.length + 1,
        type: setType,
        loadKg: weight,
        repetitions: reps,
        rir,
        completedAt: new Date().toISOString(),
        rangeOfMotion: 'full',
        techniqueQuality: 4,
      },
    ]);
    setRestSeconds(0);
    setTimerRunning(true);
  }

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.eyebrow}>SESSÃO EM ANDAMENTO</Text>
          <Text style={styles.title}>{demoSession.name}</Text>
          <Text style={styles.subtitle}>Peito · Tríceps · Deltoide anterior</Text>
        </View>
        <View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveText}>LIVE</Text></View>
      </View>
      <Text style={[styles.storageStatus, saveStatus === 'error' && styles.storageError]}>
        {saveStatus === 'saved' ? '● Salvo neste dispositivo' : saveStatus === 'error' ? 'Não foi possível salvar' : 'Salvando…'}
      </Text>

      <View style={styles.metricsRow}>
        <View><Text style={styles.metricValue}>{sets.length}</Text><Text style={styles.metricLabel}>sets</Text></View>
        <View><Text style={styles.metricValue}>{volume.toLocaleString('pt-BR')}</Text><Text style={styles.metricLabel}>kg volume</Text></View>
        <View><Text style={styles.metricValue}>{formatTimer(restSeconds)}</Text><Text style={styles.metricLabel}>descanso</Text></View>
      </View>

      {timerRunning && (
        <Pressable style={styles.timerBanner} onPress={() => setTimerRunning(false)}>
          <View>
            <Text style={styles.timerLabel}>DESCANSO ATIVO</Text>
            <Text style={styles.timerValue}>{formatTimer(restSeconds)} <Text style={styles.timerTarget}>/ 03:00</Text></Text>
          </View>
          <Text style={styles.timerAction}>Pausar</Text>
        </Pressable>
      )}

      <View style={styles.exerciseCard}>
        <View style={styles.exerciseHeader}>
          <View style={styles.exerciseNumber}><Text style={styles.exerciseNumberText}>01</Text></View>
          <View style={styles.exerciseHeading}>
            <Text style={styles.exerciseName}>{demoSession.exercises[0].exerciseName}</Text>
            <Text style={styles.prescription}>4 × 6–8 · 1–2 RIR · descanso 3:00</Text>
          </View>
          <Text style={styles.more}>•••</Text>
        </View>

        <View style={styles.previousBox}>
          <Text style={styles.previousLabel}>ÚLTIMA SESSÃO</Text>
          <Text style={styles.previousValue}>100 kg × 8 @ 2 RIR</Text>
          <Text style={styles.previousDelta}>+1 rep no mesmo esforço</Text>
        </View>

        <View style={styles.setTableHeader}>
          <Text style={[styles.columnLabel, styles.setColumn]}>SET</Text>
          <Text style={styles.columnLabel}>CARGA</Text>
          <Text style={styles.columnLabel}>REPS</Text>
          <Text style={styles.columnLabel}>RIR</Text>
          <Text style={styles.columnLabel}>STATUS</Text>
        </View>
        {sets.map(set => (
          <View style={styles.setRow} key={set.id}>
            <Text style={[styles.setCell, styles.setColumn]}>{set.order}</Text>
            <Text style={styles.setCell}>{set.loadKg} kg</Text>
            <Text style={styles.setCell}>{set.repetitions}</Text>
            <Text style={styles.setCell}>{set.rir}</Text>
            <View style={styles.check}><Text style={styles.checkText}>✓</Text></View>
          </View>
        ))}

        <View style={styles.divider} />
        <Text style={styles.nextSetLabel}>PRÓXIMO SET · {setType === 'working' ? 'TRABALHO' : 'AQUECIMENTO'}</Text>
        <View style={styles.steppersRow}>
          <Stepper label="CARGA" value={weight} suffix=" kg" step={2.5} onChange={setWeight} />
          <Stepper label="REPS" value={reps} step={1} onChange={setReps} />
          <Stepper label="RIR" value={rir} step={1} onChange={setRir} />
        </View>

        <View style={styles.chipRow}>
          <Pressable
            style={[styles.chip, setType === 'working' && styles.chipSelected]}
            onPress={() => setSetType('working')}
          ><Text style={[styles.chipText, setType === 'working' && styles.chipTextSelected]}>Trabalho</Text></Pressable>
          <Pressable
            style={[styles.chip, setType === 'warmup' && styles.chipSelected]}
            onPress={() => setSetType('warmup')}
          ><Text style={[styles.chipText, setType === 'warmup' && styles.chipTextSelected]}>Aquecimento</Text></Pressable>
          <Pressable style={styles.chip}><Text style={styles.chipText}>+ Detalhes</Text></Pressable>
        </View>

        <Pressable style={styles.logButton} onPress={logSet}>
          <Text style={styles.logButtonText}>REGISTRAR SET {sets.length + 1}</Text>
          <Text style={styles.logButtonHint}>Inicia o descanso automaticamente</Text>
        </Pressable>
      </View>

      <Pressable style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>+ ADICIONAR EXERCÍCIO</Text></Pressable>
      <Pressable style={styles.finishButton}><Text style={styles.finishButtonText}>Finalizar treino</Text></Pressable>
    </ScrollView>
  );
}

function PlaceholderScreen({ tab }: { tab: Exclude<Tab, 'Treino'> }) {
  const descriptions = {
    Histórico: 'Sessões, exercícios e sets pesquisáveis.',
    Análises: 'Volume, e1RM, RIR e tendências de performance.',
    Programas: 'Templates, ciclos e regras de progressão.',
  };
  return (
    <View style={styles.placeholder}>
      <Text style={styles.eyebrow}>SETLOG</Text>
      <Text style={styles.title}>{tab}</Text>
      <Text style={styles.placeholderText}>{descriptions[tab]}</Text>
      <Text style={styles.placeholderSoon}>Estrutura preparada para a próxima etapa.</Text>
    </View>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('Treino');

  useEffect(() => {
    setupPwa();
  }, []);

  return (
    <SafeAreaView style={styles.app}>
      <StatusBar style="light" />
      {activeTab === 'Treino' ? <WorkoutScreen /> : <PlaceholderScreen tab={activeTab} />}
      <View style={styles.tabBar}>
        {tabs.map((tab, index) => (
          <Pressable key={tab} style={styles.tab} onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabIcon, activeTab === tab && styles.tabActive]}>{['●', '▤', '⌁', '◇'][index]}</Text>
            <Text style={[styles.tabText, activeTab === tab && styles.tabActive]}>{tab}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingTop: 22, paddingBottom: 132 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  eyebrow: { color: colors.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 7 },
  title: { color: colors.text, fontSize: 29, lineHeight: 34, fontWeight: '800', letterSpacing: -0.7 },
  subtitle: { color: colors.muted, fontSize: 14, marginTop: 5 },
  storageStatus: { color: colors.success, fontSize: 10, marginTop: 12 },
  storageError: { color: colors.danger },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 20 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.danger },
  liveText: { color: colors.text, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  metricsRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, paddingVertical: 18, marginTop: 24, paddingHorizontal: 8 },
  metricValue: { color: colors.text, fontSize: 19, fontWeight: '700', textAlign: 'center' },
  metricLabel: { color: colors.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 3, textAlign: 'center' },
  timerBanner: { backgroundColor: colors.accentSoft, borderColor: colors.accentBorder, borderWidth: 1, padding: 15, borderRadius: 12, marginTop: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timerLabel: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  timerValue: { color: colors.text, fontSize: 21, fontWeight: '800', marginTop: 3 },
  timerTarget: { color: colors.muted, fontSize: 14, fontWeight: '500' },
  timerAction: { color: colors.accent, fontWeight: '700' },
  exerciseCard: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 16, marginTop: 17, padding: 16 },
  exerciseHeader: { flexDirection: 'row', alignItems: 'center' },
  exerciseNumber: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  exerciseNumberText: { color: colors.accent, fontWeight: '800', fontSize: 12 },
  exerciseHeading: { flex: 1, marginLeft: 11 },
  exerciseName: { color: colors.text, fontWeight: '800', fontSize: 17 },
  prescription: { color: colors.muted, fontSize: 11, marginTop: 3 },
  more: { color: colors.muted, letterSpacing: 2 },
  previousBox: { backgroundColor: colors.elevated, padding: 12, borderRadius: 10, marginTop: 16 },
  previousLabel: { color: colors.muted, fontSize: 9, letterSpacing: 1.1, fontWeight: '700' },
  previousValue: { color: colors.text, fontSize: 13, fontWeight: '700', marginTop: 4 },
  previousDelta: { color: colors.success, fontSize: 11, marginTop: 3 },
  setTableHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 18, paddingBottom: 7 },
  columnLabel: { flex: 1, color: colors.muted, fontSize: 9, fontWeight: '700', textAlign: 'center', letterSpacing: 0.7 },
  setColumn: { flex: 0.55, textAlign: 'left' },
  setRow: { flexDirection: 'row', alignItems: 'center', minHeight: 39, borderTopWidth: 1, borderTopColor: colors.border },
  setCell: { flex: 1, color: colors.text, fontSize: 13, textAlign: 'center', fontWeight: '600' },
  check: { flex: 1, alignItems: 'center' },
  checkText: { width: 21, height: 21, lineHeight: 20, textAlign: 'center', borderRadius: 11, overflow: 'hidden', color: colors.background, backgroundColor: colors.success, fontWeight: '900', fontSize: 12 },
  divider: { height: 1, backgroundColor: colors.border, marginTop: 4, marginBottom: 16 },
  nextSetLabel: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  steppersRow: { flexDirection: 'row', gap: 8, marginTop: 11 },
  stepper: { flex: 1, backgroundColor: colors.elevated, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 6 },
  mutedLabel: { color: colors.muted, fontSize: 8, fontWeight: '700', letterSpacing: 0.8, textAlign: 'center' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 7 },
  stepButton: { width: 23, height: 25, alignItems: 'center', justifyContent: 'center' },
  stepButtonText: { color: colors.muted, fontSize: 20, lineHeight: 21 },
  stepValue: { color: colors.text, fontSize: 14, fontWeight: '800' },
  chipRow: { flexDirection: 'row', gap: 7, marginTop: 12, flexWrap: 'wrap' },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 11, paddingVertical: 7 },
  chipSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  chipText: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  chipTextSelected: { color: colors.accent },
  logButton: { backgroundColor: colors.accent, borderRadius: 11, alignItems: 'center', paddingVertical: 13, marginTop: 14 },
  logButtonText: { color: colors.background, fontSize: 13, fontWeight: '900', letterSpacing: 0.7 },
  logButtonHint: { color: '#17382A', fontSize: 9, marginTop: 2 },
  secondaryButton: { borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 13 },
  secondaryButtonText: { color: colors.text, fontSize: 12, fontWeight: '800', letterSpacing: 0.6 },
  finishButton: { alignItems: 'center', padding: 16, marginTop: 5 },
  finishButtonText: { color: colors.danger, fontSize: 13, fontWeight: '700' },
  tabBar: { position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: 78, backgroundColor: '#0C1014F5', borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', paddingTop: 11, paddingBottom: 15 },
  tab: { flex: 1, alignItems: 'center', gap: 5 },
  tabIcon: { color: colors.muted, fontSize: 17 },
  tabText: { color: colors.muted, fontSize: 10, fontWeight: '600' },
  tabActive: { color: colors.accent },
  placeholder: { flex: 1, padding: 24, justifyContent: 'center' },
  placeholderText: { color: colors.muted, fontSize: 16, lineHeight: 24, marginTop: 10 },
  placeholderSoon: { color: colors.textDim, fontSize: 12, marginTop: 24 },
});
