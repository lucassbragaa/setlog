import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type DimensionValue } from 'react-native';

import { CalendarHeatmap } from '../components/CalendarHeatmap';
import { sessionDurationMinutes, setCountForSession, volumeForSession, workoutHeatmap } from '../data/analytics';
import { moveSessionToStartedAt } from '../data/sessionDates';
import { colors, radius, type } from '../theme';
import type { WorkoutSession } from '../types/training';
import { ActionButton, commonStyles, DateEditor, ScreenTitle } from '../ui';

function formatDuration(minutes: number | null) {
  if (!minutes) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (!hours) return mins + 'min';
  return hours + 'h ' + String(mins).padStart(2, '0') + 'min';
}

function setSummary(session: WorkoutSession) {
  return session.exercises.flatMap(exercise => exercise.sets.map(set => set.loadKg + 'x' + set.repetitions + '@' + (set.rir ?? '--'))).join(' - ');
}

export function HistoryScreen({ history, onDelete, onUpdate }: { history: WorkoutSession[]; onDelete: (id: string) => void; onUpdate: (session: WorkoutSession) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const heatmap = useMemo(() => workoutHeatmap(history, 10), [history]);
  const sessions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return [...history]
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .filter(session => {
        if (!needle) return true;
        return session.name.toLowerCase().includes(needle)
          || session.exercises.some(exercise => exercise.exerciseName.toLowerCase().includes(needle));
      });
  }, [history, query]);
  const maxVolume = Math.max(...history.map(volumeForSession), 1);

  return (
    <ScrollView contentContainerStyle={commonStyles.screen} showsVerticalScrollIndicator={false}>
      <ScreenTitle eyebrow="REGISTRO COMPLETO" title="Historico" subtitle={history.length + ' sessoes salvas automaticamente'} />
      <CalendarHeatmap weeks={heatmap} cellSize={18} />
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Buscar treino ou exercicio"
        placeholderTextColor={colors.textDim}
        style={styles.search}
      />
      {history.length === 0 ? <View style={commonStyles.card}><Text style={commonStyles.muted}>Finalize um treino para ve-lo aqui.</Text></View> : null}
      {history.length > 0 && sessions.length === 0 ? <View style={commonStyles.card}><Text style={commonStyles.muted}>Nada encontrado para essa busca.</Text></View> : null}
      {sessions.map(session => {
        const sets = setCountForSession(session);
        const volume = volumeForSession(session);
        const duration = formatDuration(sessionDurationMinutes(session));
        const open = selected === session.id;
        return (
          <View key={session.id} style={commonStyles.card}>
            <Pressable onPress={() => setSelected(open ? null : session.id)}>
              <View style={commonStyles.between}>
                <View style={{ flex: 1 }}>
                  <View style={styles.titleRow}>
                    <Text style={commonStyles.cardTitle}>{session.name}</Text>
                    {session.cycleNumber ? <View style={styles.cycleBadge}><Text style={styles.cycleText}>CICLO {session.cycleNumber}</Text></View> : null}
                    {duration ? <View style={styles.durationBadge}><Text style={styles.durationText}>{duration}</Text></View> : null}
                  </View>
                  <Text style={commonStyles.muted}>{new Date(session.startedAt).toLocaleDateString('pt-BR')} - {session.exercises.length} exercicios</Text>
                </View>
                <Text style={styles.chevron}>{open ? '^' : 'v'}</Text>
              </View>
              <View style={styles.volumeTrack}><View style={[styles.volumeFill, { width: (Math.max(4, (volume / maxVolume) * 100) + '%') as DimensionValue }]} /></View>
              <View style={styles.summary}>
                <Text style={styles.stat}>{sets}<Text style={styles.label}> sets</Text></Text>
                <Text style={styles.stat}>{Math.round(volume).toLocaleString('pt-BR')}<Text style={styles.label}> kg</Text></Text>
              </View>
            </Pressable>
            {open && (
              <View style={styles.details}>
                <DateEditor label="DATA REGISTRADA" value={session.startedAt} onChange={startedAt => onUpdate(moveSessionToStartedAt(session, startedAt))} />
                {session.exercises.map(exercise => (
                  <View key={exercise.id} style={styles.exercise}>
                    <Text style={styles.exerciseName}>{exercise.exerciseName}</Text>
                    <Text style={commonStyles.muted}>{exercise.sets.map(set => set.loadKg + 'x' + set.repetitions + '@' + (set.rir ?? '--')).join(' - ') || 'Sem sets'}</Text>
                    {exercise.notes ? <Text style={styles.notes}>Obs.: {exercise.notes}</Text> : null}
                  </View>
                ))}
                {setSummary(session) ? <Text style={styles.compact}>Resumo: {setSummary(session)}</Text> : null}
                <ActionButton label="Excluir sessao" tone="danger" onPress={() => onDelete(session.id)} />
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  search: { minHeight: 50, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.elevated, color: colors.text, paddingHorizontal: 14, marginTop: 14, fontSize: type.md, fontWeight: '700' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  cycleBadge: { backgroundColor: colors.accentSoft, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: colors.border },
  cycleText: { color: colors.accent, fontSize: type.xs, fontWeight: '900' },
  durationBadge: { backgroundColor: colors.elevated, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: colors.border },
  durationText: { color: colors.muted, fontSize: type.xs, fontWeight: '900' },
  chevron: { color: colors.accent, fontSize: 18, fontWeight: '900' },
  summary: { flexDirection: 'row', gap: 22, marginTop: 12 },
  stat: { color: colors.text, fontWeight: '900', fontSize: type.lg },
  label: { color: colors.muted, fontWeight: '600', fontSize: type.sm },
  volumeTrack: { height: 4, borderRadius: radius.full, backgroundColor: colors.elevated, overflow: 'hidden', marginTop: 14 },
  volumeFill: { height: '100%', backgroundColor: colors.accent, borderRadius: radius.full },
  details: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 14, paddingTop: 8 },
  exercise: { paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border },
  exerciseName: { color: colors.text, fontWeight: '900', fontSize: type.md },
  notes: { color: colors.textDim, fontSize: type.sm, fontStyle: 'italic', marginTop: 4 },
  compact: { color: colors.textDim, fontSize: type.xs, lineHeight: 15, marginTop: 10 },
});
