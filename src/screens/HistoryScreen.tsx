import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { CalendarHeatmap } from '../components/CalendarHeatmap';
import { computeStreak, sessionDurationMinutes, workoutHeatmap } from '../data/analytics';
import { moveSessionToStartedAt } from '../data/sessionDates';
import { setVolumeKg } from '../data/setMetrics';
import { colors } from '../theme';
import type { WorkoutSession } from '../types/training';
import { ActionButton, commonStyles, DateEditor, ScreenTitle } from '../ui';

function sessionStats(session: WorkoutSession) {
  const sets = session.exercises.flatMap(exercise => exercise.sets);
  return { sets: sets.length, volume: sets.reduce((total, set) => total + setVolumeKg(set), 0) };
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export function HistoryScreen({ history, onDelete, onUpdate }: {
  history: WorkoutSession[];
  onDelete: (id: string) => void;
  onUpdate: (session: WorkoutSession) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const heatmapData = useMemo(() => workoutHeatmap(history, 10), [history]);
  const streak = useMemo(() => computeStreak(history), [history]);

  const sessions = useMemo(() => {
    const sorted = [...history].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    if (!search.trim()) return sorted;
    const q = search.trim().toLowerCase();
    return sorted.filter(session =>
      session.name.toLowerCase().includes(q) ||
      session.exercises.some(ex => ex.exerciseName.toLowerCase().includes(q))
    );
  }, [history, search]);

  const maxVolume = useMemo(() => Math.max(...history.map(s => sessionStats(s).volume), 1), [history]);

  return (
    <ScrollView contentContainerStyle={commonStyles.screen}>
      <ScreenTitle eyebrow="REGISTRO COMPLETO" title="Histórico" subtitle={history.length + ' sessões salvas automaticamente'} />

      {history.length > 0 && (
        <View style={commonStyles.card}>
          <Text style={commonStyles.cardTitle}>Frequência · 10 semanas</Text>
          <View style={{ marginTop: 12 }}>
            <CalendarHeatmap data={heatmapData} cellSize={18} streak={streak.currentStreak} />
          </View>
        </View>
      )}

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar treino ou exercício…"
          placeholderTextColor={colors.textDim}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} style={styles.clearBtn}>
            <Text style={styles.clearText}>✕</Text>
          </Pressable>
        )}
      </View>

      {sessions.length === 0 ? (
        <View style={commonStyles.card}>
          <Text style={commonStyles.muted}>{history.length === 0 ? 'Finalize um treino para vê-lo aqui.' : 'Nenhum resultado para "' + search + '".'}</Text>
        </View>
      ) : sessions.map(session => {
        const summary = sessionStats(session);
        const open = selected === session.id;
        const duration = sessionDurationMinutes(session);
        const volumePct = Math.max(3, (summary.volume / maxVolume) * 100);

        return (
          <View key={session.id} style={commonStyles.card}>
            <Pressable onPress={() => setSelected(open ? null : session.id)}>
              <View style={commonStyles.between}>
                <View style={{ flex: 1 }}>
                  <View style={styles.titleRow}>
                    <Text style={commonStyles.cardTitle}>{session.name}</Text>
                    {session.cycleNumber ? (
                      <View style={styles.cycleBadge}><Text style={styles.cycleText}>CICLO {session.cycleNumber}</Text></View>
                    ) : null}
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={commonStyles.muted}>{new Date(session.startedAt).toLocaleDateString('pt-BR')} · {session.exercises.length} exercícios</Text>
                    {duration !== null && (
                      <View style={styles.durationBadge}>
                        <Text style={styles.durationText}>{formatDuration(duration)}</Text>
                      </View>
                    )}
                  </View>
                </View>
                <Text style={styles.chevron}>{open ? '⌃' : '⌄'}</Text>
              </View>

              <View style={styles.statsRow}>
                <Text style={styles.stat}>{summary.sets}<Text style={styles.statLabel}> sets</Text></Text>
                <Text style={styles.stat}>{summary.volume.toLocaleString('pt-BR')}<Text style={styles.statLabel}> kg</Text></Text>
              </View>

              <View style={styles.volumeBar}>
                <View style={[styles.volumeFill, { width: `${volumePct}%` as `${number}%` }]} />
              </View>
            </Pressable>

            {open && (
              <View style={styles.details}>
                <DateEditor
                  label="DATA REGISTRADA"
                  value={session.startedAt}
                  onChange={startedAt => onUpdate(moveSessionToStartedAt(session, startedAt))}
                />
                {session.exercises.map(exercise => (
                  <View key={exercise.id} style={styles.exercise}>
                    <Text style={styles.exerciseName}>{exercise.exerciseName}</Text>
                    <Text style={commonStyles.muted}>
                      {exercise.sets.map(set => set.loadKg + '×' + set.repetitions + (set.rir !== undefined ? '@' + set.rir : '')).join(' · ') || 'Sem sets'}
                    </Text>
                    {exercise.notes ? <Text style={styles.notes}>Obs.: {exercise.notes}</Text> : null}
                  </View>
                ))}
                <ActionButton label="Excluir sessão" tone="danger" onPress={() => onDelete(session.id)} />
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, marginTop: 4, marginBottom: 2 },
  searchInput: { flex: 1, color: colors.text, fontSize: 13, paddingVertical: 10 },
  clearBtn: { padding: 6 },
  clearText: { color: colors.muted, fontSize: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cycleBadge: { backgroundColor: colors.accentSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  cycleText: { color: colors.accent, fontSize: 8, fontWeight: '800' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' },
  durationBadge: { backgroundColor: colors.elevated, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  durationText: { color: colors.muted, fontSize: 9, fontWeight: '700' },
  chevron: { color: colors.accent, fontSize: 20 },
  statsRow: { flexDirection: 'row', gap: 22, marginTop: 10 },
  stat: { color: colors.text, fontWeight: '800', fontSize: 16 },
  statLabel: { color: colors.muted, fontWeight: '500', fontSize: 10 },
  volumeBar: { height: 3, backgroundColor: colors.elevated, borderRadius: 2, marginTop: 10, overflow: 'hidden' },
  volumeFill: { height: '100%', backgroundColor: colors.accentBorder, borderRadius: 2 },
  details: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 13, paddingTop: 8 },
  exercise: { paddingVertical: 8 },
  exerciseName: { color: colors.text, fontWeight: '700', fontSize: 13 },
  notes: { color: colors.textDim, fontSize: 10, fontStyle: 'italic', marginTop: 3 },
});
