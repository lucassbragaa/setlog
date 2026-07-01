import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View, type DimensionValue } from 'react-native';

import { CalendarHeatmap } from '../components/CalendarHeatmap';
import { completedSessions, computeStreak, setCountForSession, volumeForSession, weeklyVolumeSummary, workoutHeatmap } from '../data/analytics';
import { completedCodes, currentCycleNumber, MAX_CYCLES, nextProgramCode, PROGRAM_SEQUENCE, totalCycleCompletions } from '../data/cycles';
import { muscleLabel } from '../data/exerciseTaxonomy';
import { muscleSetDistribution } from '../data/hevyAnalytics';
import { loadGitHubToken, pullAppDataFromGitHub, pushAppDataToGitHub, saveGitHubToken } from '../platform/githubSync';
import { colors, radius, type } from '../theme';
import type { AppData, GitHubSyncSettings, WorkoutSession } from '../types/training';
import { ActionButton, commonStyles } from '../ui';

function kg(value: number) {
  return Math.round(value).toLocaleString('pt-BR') + ' kg';
}

function repsForSession(session: WorkoutSession) {
  return session.exercises.flatMap(exercise => exercise.sets).reduce((total, set) => total + set.repetitions, 0);
}

function dateLabel(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
}

export function ProfileScreen({ history, data, onDataChange, onExport, onImport }: {
  history: WorkoutSession[];
  data: AppData;
  onDataChange: (data: AppData) => void;
  onExport: () => void;
  onImport: () => void;
}) {
  const completed = useMemo(() => completedSessions(history), [history]);
  const heatmap = useMemo(() => workoutHeatmap(history, 14), [history]);
  const streak = useMemo(() => computeStreak(history), [history]);
  const weekly = useMemo(() => weeklyVolumeSummary(history, 8), [history]);
  const muscleSummary = useMemo(() => muscleSetDistribution(history, data.exerciseTemplates), [history, data.exerciseTemplates]);
  const currentCycle = currentCycleNumber(history);
  const currentDone = completedCodes(history, currentCycle);
  const totalDone = totalCycleCompletions(history);
  const totalPlanned = MAX_CYCLES * PROGRAM_SEQUENCE.length;
  const overallPercent = Math.round((totalDone / totalPlanned) * 100);
  const totalVolume = completed.reduce((total, session) => total + volumeForSession(session), 0);
  const totalSets = completed.reduce((total, session) => total + setCountForSession(session), 0);
  const totalReps = completed.reduce((total, session) => total + repsForSession(session), 0);
  const maxWeeklyVolume = Math.max(...weekly.map(item => item.totalVolume), 1);
  const recent = completed.slice().reverse().slice(0, 5);
  const [githubToken, setGithubToken] = useState('');
  const [syncStatus, setSyncStatus] = useState(data.settings.githubSync.lastStatus ?? '');
  const sync = data.settings.githubSync;

  useEffect(() => {
    loadGitHubToken().then(setGithubToken).catch(() => setSyncStatus('Nao foi possivel carregar o token local.'));
  }, []);

  function updateGitHubSync(patch: Partial<GitHubSyncSettings>) {
    onDataChange({ ...data, settings: { ...data.settings, githubSync: { ...data.settings.githubSync, ...patch } } });
  }

  async function persistToken(nextToken: string) {
    setGithubToken(nextToken);
    await saveGitHubToken(nextToken);
  }

  async function pushToGitHub() {
    try {
      setSyncStatus('Enviando para GitHub...');
      const result = await pushAppDataToGitHub(data, githubToken);
      if (result.data) onDataChange(result.data);
      setSyncStatus(result.message);
    } catch (error) {
      setSyncStatus(error instanceof Error ? error.message : 'Falha ao enviar para GitHub.');
    }
  }

  async function pullFromGitHub() {
    try {
      setSyncStatus('Baixando do GitHub...');
      const result = await pullAppDataFromGitHub(sync, githubToken);
      if (result.data) onDataChange(result.data);
      setSyncStatus(result.message);
    } catch (error) {
      setSyncStatus(error instanceof Error ? error.message : 'Falha ao baixar do GitHub.');
    }
  }

  return (
    <ScrollView contentContainerStyle={commonStyles.screen} showsVerticalScrollIndicator={false}>
      <View style={styles.profileHeader}>
        <View style={styles.avatar}><Text style={styles.avatarText}>L</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>Lucas</Text>
          <Text style={styles.handle}>Private Setlog profile</Text>
        </View>
      </View>

      <View style={styles.hero}>
        <View>
          <Text style={styles.heroLabel}>CURRENT CYCLE</Text>
          <Text style={styles.heroValue}>Cycle {currentCycle}</Text>
          <Text style={styles.heroSub}>{currentDone.length}/{PROGRAM_SEQUENCE.length} workouts · next {nextProgramCode(history)}</Text>
        </View>
        <View style={styles.progressCircle}><Text style={styles.progressText}>{overallPercent}%</Text></View>
      </View>

      <View style={styles.grid}>
        <Metric label="Workouts" value={String(completed.length)} detail={streak.currentStreak + ' day streak'} />
        <Metric label="Volume" value={kg(totalVolume)} detail="all time" />
        <Metric label="Sets" value={String(totalSets)} detail="working sets" />
        <Metric label="Reps" value={totalReps.toLocaleString('pt-BR')} detail="logged reps" />
      </View>

      <CalendarHeatmap weeks={heatmap} />

      <View style={commonStyles.card}>
        <Text style={commonStyles.cardTitle}>Weekly activity</Text>
        <View style={styles.weekBars}>
          {weekly.map(week => (
            <View key={week.weekStart} style={styles.weekItem}>
              <View style={styles.weekTrack}><View style={[styles.weekFill, { height: Math.max(5, (week.totalVolume / maxWeeklyVolume) * 92) }]} /></View>
              <Text style={styles.weekLabel}>{week.weekLabel}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={commonStyles.card}>
        <Text style={commonStyles.cardTitle}>Muscle distribution</Text>
        {muscleSummary.length === 0 ? <Text style={[commonStyles.muted, { marginTop: 8 }]}>Finalize mais treinos para ver distribuição por músculo.</Text> : null}
        {muscleSummary.slice(0, 8).map(item => (
          <View key={item.muscle} style={styles.muscleRow}>
            <Text style={styles.muscleName}>{muscleLabel(item.muscle)}</Text>
            <View style={styles.muscleTrack}><View style={[styles.muscleFill, { width: (Math.max(4, (item.totalWeightedSets / Math.max(muscleSummary[0]?.totalWeightedSets ?? 1, 1)) * 100) + '%') as DimensionValue }]} /></View>
            <Text style={styles.muscleValue}>{item.totalWeightedSets.toFixed(1)}</Text>
          </View>
        ))}
      </View>

      <View style={commonStyles.card}>
        <Text style={commonStyles.cardTitle}>Recent workouts</Text>
        {recent.length === 0 ? <Text style={[commonStyles.muted, { marginTop: 8 }]}>Finalize um treino para ele aparecer no perfil.</Text> : null}
        {recent.map(session => (
          <View key={session.id} style={styles.recentRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.recentTitle}>{session.name}</Text>
              <Text style={commonStyles.muted}>{dateLabel(session.startedAt)} · {setCountForSession(session)} sets · {kg(volumeForSession(session))}</Text>
            </View>
            {session.cycleNumber ? <View style={styles.cycleBadge}><Text style={styles.cycleBadgeText}>C{session.cycleNumber}</Text></View> : null}
          </View>
        ))}
      </View>

      <View style={commonStyles.card}>
        <Text style={commonStyles.cardTitle}>Data & Sync</Text>
        <Text style={[commonStyles.muted, { marginTop: 6 }]}>Backup completo do Setlog e banco por usuário no GitHub.</Text>
        <ActionButton label="EXPORTAR BACKUP" onPress={onExport} />
        <ActionButton label="RESTAURAR BACKUP" tone="secondary" onPress={onImport} />
        <View style={styles.syncGrid}>
          <TextInput value={sync.owner} onChangeText={owner => updateGitHubSync({ owner })} placeholder="usuario/org" placeholderTextColor={colors.textDim} autoCapitalize="none" style={styles.input} />
          <TextInput value={sync.repo} onChangeText={repo => updateGitHubSync({ repo })} placeholder="repo" placeholderTextColor={colors.textDim} autoCapitalize="none" style={styles.input} />
        </View>
        <View style={styles.syncGrid}>
          <TextInput value={sync.branch} onChangeText={branch => updateGitHubSync({ branch })} placeholder="branch" placeholderTextColor={colors.textDim} autoCapitalize="none" style={styles.input} />
          <TextInput value={sync.path} onChangeText={path => updateGitHubSync({ path })} placeholder="data/setlog.json" placeholderTextColor={colors.textDim} autoCapitalize="none" style={styles.input} />
        </View>
        <TextInput value={githubToken} onChangeText={persistToken} placeholder="GitHub token" placeholderTextColor={colors.textDim} autoCapitalize="none" secureTextEntry style={styles.input} />
        {sync.lastSyncedAt ? <Text style={styles.syncStatus}>Ultimo sync: {new Date(sync.lastSyncedAt).toLocaleString('pt-BR')}</Text> : null}
        {syncStatus ? <Text style={styles.syncStatus}>{syncStatus}</Text> : null}
        <ActionButton label="ENVIAR PARA GITHUB" onPress={pushToGitHub} />
        <ActionButton label="BAIXAR DO GITHUB" tone="secondary" onPress={pullFromGitHub} />
      </View>
    </ScrollView>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricDetail}>{detail}</Text></View>;
}

const styles = StyleSheet.create({
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8, marginBottom: 14 },
  avatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.text, fontSize: 24, fontWeight: '900' },
  name: { color: colors.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.6 },
  handle: { color: colors.muted, fontSize: type.sm, fontWeight: '800', marginTop: 2 },
  hero: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.xl, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroLabel: { color: colors.accent, fontSize: type.xs, fontWeight: '900', letterSpacing: 1 },
  heroValue: { color: colors.text, fontSize: 26, fontWeight: '900', marginTop: 4 },
  heroSub: { color: colors.muted, fontSize: type.sm, fontWeight: '800', marginTop: 4 },
  progressCircle: { width: 58, height: 58, borderRadius: 29, borderWidth: 5, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft },
  progressText: { color: colors.text, fontWeight: '900', fontSize: type.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  metric: { width: '48%', backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: 14, minHeight: 104, justifyContent: 'space-between' },
  metricLabel: { color: colors.muted, fontSize: type.xs, fontWeight: '900', textTransform: 'uppercase' },
  metricValue: { color: colors.text, fontSize: 24, fontWeight: '900', marginTop: 6 },
  metricDetail: { color: colors.textDim, fontSize: type.xs, fontWeight: '800', marginTop: 5 },
  weekBars: { height: 126, flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 16 },
  weekItem: { flex: 1, alignItems: 'center', gap: 8 },
  weekTrack: { height: 96, width: '100%', borderRadius: radius.full, backgroundColor: colors.elevated, overflow: 'hidden', justifyContent: 'flex-end', borderWidth: 1, borderColor: colors.border },
  weekFill: { backgroundColor: colors.accent, borderRadius: radius.full },
  weekLabel: { color: colors.textDim, fontSize: 8, fontWeight: '800' },
  muscleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  muscleName: { color: colors.text, fontSize: type.sm, fontWeight: '900', width: 82 },
  muscleTrack: { flex: 1, height: 7, borderRadius: radius.full, backgroundColor: colors.elevated, overflow: 'hidden' },
  muscleFill: { height: '100%', backgroundColor: colors.accent, borderRadius: radius.full },
  muscleValue: { color: colors.muted, fontSize: type.xs, fontWeight: '900', width: 34, textAlign: 'right' },
  recentRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, marginTop: 12, gap: 10 },
  recentTitle: { color: colors.text, fontSize: type.md, fontWeight: '900' },
  cycleBadge: { backgroundColor: colors.accentSoft, borderColor: colors.accentBorder, borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 9, paddingVertical: 5 },
  cycleBadgeText: { color: colors.accent, fontSize: type.xs, fontWeight: '900' },
  syncGrid: { flexDirection: 'row', gap: 8, marginTop: 10 },
  input: { flex: 1, minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.elevated, color: colors.text, paddingHorizontal: 12, marginTop: 10, fontSize: 12, fontWeight: '700' },
  syncStatus: { color: colors.muted, fontSize: 10, marginTop: 10, lineHeight: 15 },
});
