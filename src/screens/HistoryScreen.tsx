import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';
import type { WorkoutSession } from '../types/training';
import { ActionButton, commonStyles, ScreenTitle } from '../ui';

function stats(session: WorkoutSession) {
  const sets = session.exercises.flatMap(exercise => exercise.sets);
  return { sets: sets.length, volume: sets.reduce((total, set) => total + set.loadKg * set.repetitions, 0) };
}

export function HistoryScreen({ history, onDelete }: { history: WorkoutSession[]; onDelete: (id: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <ScrollView contentContainerStyle={commonStyles.screen}>
      <ScreenTitle eyebrow="REGISTRO COMPLETO" title="Histórico" subtitle={history.length + ' sessões salvas automaticamente'} />
      {history.length === 0 ? <View style={commonStyles.card}><Text style={commonStyles.muted}>Finalize um treino para vê-lo aqui.</Text></View> : history.map(session => {
        const summary = stats(session);
        const open = selected === session.id;
        return (
          <Pressable key={session.id} style={commonStyles.card} onPress={() => setSelected(open ? null : session.id)}>
            <View style={commonStyles.between}>
              <View style={{ flex: 1 }}>
                <View style={styles.titleRow}>
                  <Text style={commonStyles.cardTitle}>{session.name}</Text>
                  {session.cycleNumber ? <View style={styles.cycleBadge}><Text style={styles.cycleText}>CICLO {session.cycleNumber}</Text></View> : null}
                </View>
                <Text style={commonStyles.muted}>{new Date(session.startedAt).toLocaleDateString('pt-BR')} · {session.exercises.length} exercícios</Text>
              </View>
              <Text style={styles.chevron}>{open ? '⌃' : '⌄'}</Text>
            </View>
            <View style={styles.summary}><Text style={styles.stat}>{summary.sets}<Text style={styles.label}> sets</Text></Text><Text style={styles.stat}>{summary.volume.toLocaleString('pt-BR')}<Text style={styles.label}> kg</Text></Text></View>
            {open && (
              <View style={styles.details}>
                {session.exercises.map(exercise => (
                  <View key={exercise.id} style={styles.exercise}>
                    <Text style={styles.exerciseName}>{exercise.exerciseName}</Text>
                    <Text style={commonStyles.muted}>{exercise.sets.map(set => set.loadKg + '×' + set.repetitions + '@' + (set.rir ?? '—')).join(' · ') || 'Sem sets'}</Text>
                    {exercise.notes ? <Text style={styles.notes}>Obs.: {exercise.notes}</Text> : null}
                  </View>
                ))}
                <ActionButton label="Excluir sessão" tone="danger" onPress={() => onDelete(session.id)} />
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cycleBadge: { backgroundColor: colors.accentSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  cycleText: { color: colors.accent, fontSize: 8, fontWeight: '800' },
  chevron: { color: colors.accent, fontSize: 20 },
  summary: { flexDirection: 'row', gap: 22, marginTop: 13 },
  stat: { color: colors.text, fontWeight: '800', fontSize: 16 },
  label: { color: colors.muted, fontWeight: '500', fontSize: 10 },
  details: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 13, paddingTop: 8 },
  exercise: { paddingVertical: 8 },
  exerciseName: { color: colors.text, fontWeight: '700', fontSize: 13 },
  notes: { color: colors.textDim, fontSize: 10, fontStyle: 'italic', marginTop: 3 },
});
