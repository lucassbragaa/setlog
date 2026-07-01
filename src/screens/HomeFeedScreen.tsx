import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { completedSessions, sessionDurationMinutes, setCountForSession, volumeForSession } from '../data/analytics';
import { nextProgramCode } from '../data/cycles';
import { colors, radius, type } from '../theme';
import type { ProgramTemplate, WorkoutSession } from '../types/training';
import { ActionButton, commonStyles } from '../ui';

function kg(value: number) {
  return Math.round(value).toLocaleString('pt-BR') + ' kg';
}

function dateLabel(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
}

function durationLabel(session: WorkoutSession) {
  const duration = sessionDurationMinutes(session);
  return duration ? duration + ' min' : 'Logged';
}

export function HomeFeedScreen({ history, programs, onStartProgram, onOpenWorkout }: {
  history: WorkoutSession[];
  programs: ProgramTemplate[];
  onStartProgram: (program: ProgramTemplate) => void;
  onOpenWorkout: () => void;
}) {
  const completed = completedSessions(history).slice().reverse();
  const recent = completed.slice(0, 6);
  const nextCode = nextProgramCode(history);
  const nextRoutine = programs.find(program => program.name === nextCode) ?? programs[0];
  const suggested = [nextRoutine, ...programs.filter(program => program.id !== nextRoutine?.id)].filter(Boolean).slice(0, 3) as ProgramTemplate[];

  return (
    <ScrollView contentContainerStyle={commonStyles.screen} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Home</Text>
        <Pressable style={styles.bell}>
          <Text style={styles.bellText}>•</Text>
        </Pressable>
      </View>

      <View style={styles.composeCard}>
        <View style={styles.avatar}><Text style={styles.avatarText}>L</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.composeTitle}>Ready to train?</Text>
          <Text style={styles.composeSub}>Start from your next routine or open a blank workout.</Text>
        </View>
      </View>

      <View style={styles.quickActions}>
        <Pressable style={styles.primaryAction} onPress={() => nextRoutine ? onStartProgram(nextRoutine) : onOpenWorkout()}>
          <Text style={styles.primaryActionLabel}>Start Next Workout</Text>
          <Text style={styles.primaryActionTitle}>{nextRoutine?.name ?? 'Empty Workout'}</Text>
        </Pressable>
        <Pressable style={styles.secondaryAction} onPress={onOpenWorkout}>
          <Text style={styles.secondaryActionText}>Workout</Text>
        </Pressable>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Feed</Text>
        <Text style={styles.sectionMeta}>Private</Text>
      </View>

      {recent.length === 0 ? (
        <View style={styles.emptyFeed}>
          <Text style={styles.emptyTitle}>No workouts yet</Text>
          <Text style={styles.emptyText}>Finish your first session and it will appear here as a training post.</Text>
          <ActionButton label="OPEN WORKOUT LOGGER" onPress={onOpenWorkout} />
        </View>
      ) : null}

      {recent.map(session => (
        <View key={session.id} style={styles.post}>
          <View style={styles.postTop}>
            <View style={styles.avatarSmall}><Text style={styles.avatarSmallText}>L</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.author}>Lucas</Text>
              <Text style={styles.meta}>{dateLabel(session.startedAt)} · {durationLabel(session)}</Text>
            </View>
            {session.cycleNumber ? <View style={styles.cycle}><Text style={styles.cycleText}>C{session.cycleNumber}</Text></View> : null}
          </View>
          <Text style={styles.postTitle}>{session.name}</Text>
          <View style={styles.statsRow}>
            <Stat label="Volume" value={kg(volumeForSession(session))} />
            <Stat label="Sets" value={String(setCountForSession(session))} />
            <Stat label="Exercises" value={String(session.exercises.length)} />
          </View>
          <View style={styles.exerciseList}>
            {session.exercises.slice(0, 4).map(exercise => (
              <View key={exercise.id} style={styles.exerciseLine}>
                <Text style={styles.exerciseName}>{exercise.exerciseName}</Text>
                <Text style={styles.exerciseSets}>{exercise.sets.length} sets</Text>
              </View>
            ))}
            {session.exercises.length > 4 ? <Text style={styles.moreExercises}>+{session.exercises.length - 4} more exercises</Text> : null}
          </View>
          <View style={styles.reactions}>
            <Text style={styles.reaction}>Like</Text>
            <Text style={styles.reaction}>Comment</Text>
            <Text style={styles.reaction}>Share</Text>
          </View>
        </View>
      ))}

      <View style={commonStyles.card}>
        <Text style={commonStyles.cardTitle}>Routines</Text>
        <Text style={[commonStyles.muted, { marginTop: 4 }]}>Quick start your saved program templates.</Text>
        {suggested.map(program => (
          <Pressable key={program.id} style={styles.routineRow} onPress={() => onStartProgram(program)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.routineName}>{program.name}</Text>
              <Text style={styles.routineMeta}>{program.exercises.length} exercises · {program.split ?? 'Custom'}</Text>
            </View>
            <Text style={styles.startText}>Start</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, marginBottom: 14 },
  title: { color: colors.text, fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  bell: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  bellText: { color: colors.accent, fontSize: 26, lineHeight: 26 },
  composeCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 14 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.text, fontSize: 22, fontWeight: '900' },
  composeTitle: { color: colors.text, fontSize: type.lg, fontWeight: '900' },
  composeSub: { color: colors.muted, fontSize: type.sm, fontWeight: '700', marginTop: 3, lineHeight: 18 },
  quickActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  primaryAction: { flex: 1, minHeight: 82, borderRadius: radius.lg, backgroundColor: colors.accent, padding: 14, justifyContent: 'space-between' },
  primaryActionLabel: { color: '#D7EBFF', fontSize: type.xs, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  primaryActionTitle: { color: colors.text, fontSize: 24, fontWeight: '900', letterSpacing: -0.4 },
  secondaryAction: { width: 94, borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  secondaryActionText: { color: colors.text, fontSize: type.sm, fontWeight: '900' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 10 },
  sectionTitle: { color: colors.text, fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  sectionMeta: { color: colors.textDim, fontSize: type.xs, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  emptyFeed: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: 16 },
  emptyTitle: { color: colors.text, fontSize: type.xl, fontWeight: '900' },
  emptyText: { color: colors.muted, fontSize: type.sm, lineHeight: 19, marginTop: 6 },
  post: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: 15, marginBottom: 12 },
  postTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarSmall: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  avatarSmallText: { color: colors.text, fontSize: type.lg, fontWeight: '900' },
  author: { color: colors.text, fontSize: type.md, fontWeight: '900' },
  meta: { color: colors.textDim, fontSize: type.xs, fontWeight: '800', marginTop: 2 },
  cycle: { borderRadius: radius.full, borderWidth: 1, borderColor: colors.accentBorder, backgroundColor: colors.accentSoft, paddingHorizontal: 9, paddingVertical: 5 },
  cycleText: { color: colors.accent, fontSize: type.xs, fontWeight: '900' },
  postTitle: { color: colors.text, fontSize: 22, fontWeight: '900', marginTop: 14, letterSpacing: -0.4 },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  stat: { flex: 1, backgroundColor: colors.elevated, borderRadius: radius.md, padding: 10, borderWidth: 1, borderColor: colors.border },
  statValue: { color: colors.text, fontSize: type.md, fontWeight: '900' },
  statLabel: { color: colors.textDim, fontSize: 8, fontWeight: '900', textTransform: 'uppercase', marginTop: 3 },
  exerciseList: { marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  exerciseLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border },
  exerciseName: { color: colors.text, fontSize: type.sm, fontWeight: '800', flex: 1 },
  exerciseSets: { color: colors.muted, fontSize: type.xs, fontWeight: '900' },
  moreExercises: { color: colors.accent, fontSize: type.xs, fontWeight: '900', marginTop: 10 },
  reactions: { flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, marginTop: 12 },
  reaction: { color: colors.muted, fontSize: type.sm, fontWeight: '900' },
  routineRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 13, marginTop: 13, gap: 10 },
  routineName: { color: colors.text, fontSize: type.md, fontWeight: '900' },
  routineMeta: { color: colors.textDim, fontSize: type.xs, fontWeight: '800', marginTop: 3 },
  startText: { color: colors.accent, fontSize: type.sm, fontWeight: '900' },
});
