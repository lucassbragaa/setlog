import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { computePRs, completedSessions, normalizeExerciseKey } from '../data/analytics';
import { matchesMuscle, muscleLabel, muscleOrder, primaryMuscle } from '../data/exerciseTaxonomy';
import { estimated1Rm, setVolumeKg } from '../data/setMetrics';
import { colors, radius, type } from '../theme';
import type { ExerciseBlock, ExerciseTemplate, LoggedSet, MuscleGroup, ProgramTemplate, WorkoutSession } from '../types/training';
import { Chip, commonStyles, ModalShell, ScreenTitle } from '../ui';

type ExerciseIndexItem = {
  key: string;
  name: string;
  template?: ExerciseTemplate;
  routineCount: number;
  logCount: number;
  setCount: number;
  totalVolume: number;
  lastSet?: LoggedSet;
  lastSession?: WorkoutSession;
};

function workingSets(exercise: ExerciseBlock) {
  return exercise.sets.filter(set => set.type !== 'warmup' && set.type !== 'approach');
}

function setSegments(set: LoggedSet): number[] {
  return set.techniqueDetails?.segmentRepetitions?.length ? set.techniqueDetails.segmentRepetitions : [set.repetitions];
}

function formatSet(set?: LoggedSet) {
  if (!set) return '--';
  const segments = setSegments(set);
  const reps = segments.length > 1 ? segments.join('+') + ' (' + set.repetitions + ')' : String(set.repetitions);
  return set.loadKg + 'kg x ' + reps + (set.rir !== undefined ? ' @' + set.rir : '');
}

function formatDate(iso?: string) {
  return iso ? new Date(iso).toLocaleDateString('pt-BR') : '--';
}

function kg(value: number) {
  return Math.round(value).toLocaleString('pt-BR') + ' kg';
}

function muscles(template?: ExerciseTemplate) {
  if (!template) return 'Sem mapeamento muscular';
  return [...template.primaryMuscles, ...(template.secondaryMuscles ?? [])].map(muscleLabel).join(' / ');
}

function buildExerciseIndex(history: WorkoutSession[], programs: ProgramTemplate[], templates: ExerciseTemplate[]): ExerciseIndexItem[] {
  const map = new Map<string, ExerciseIndexItem>();
  const templateByKey = new Map(templates.map(template => [template.id, template]));

  templates.forEach(template => {
    map.set(template.id, {
      key: template.id,
      name: template.name,
      template,
      routineCount: 0,
      logCount: 0,
      setCount: 0,
      totalVolume: 0,
    });
  });

  programs.forEach(program => {
    const seenInRoutine = new Set<string>();
    program.exercises.forEach(exercise => {
      const key = normalizeExerciseKey(exercise);
      const current = map.get(key) ?? {
        key,
        name: exercise.exerciseName,
        template: templateByKey.get(exercise.exerciseTemplateId ?? exercise.exerciseId),
        routineCount: 0,
        logCount: 0,
        setCount: 0,
        totalVolume: 0,
      };
      if (!seenInRoutine.has(key)) current.routineCount += 1;
      seenInRoutine.add(key);
      current.name = current.name || exercise.exerciseName;
      map.set(key, current);
    });
  });

  completedSessions(history).forEach(session => {
    session.exercises.forEach(exercise => {
      const key = normalizeExerciseKey(exercise);
      const sets = workingSets(exercise);
      const current = map.get(key) ?? {
        key,
        name: exercise.exerciseName,
        template: templateByKey.get(exercise.exerciseTemplateId ?? exercise.exerciseId),
        routineCount: 0,
        logCount: 0,
        setCount: 0,
        totalVolume: 0,
      };
      current.name = exercise.exerciseName || current.name;
      current.logCount += sets.length ? 1 : 0;
      current.setCount += sets.length;
      current.totalVolume += sets.reduce((total, set) => total + setVolumeKg(set), 0);
      if (sets.length) {
        current.lastSet = sets[sets.length - 1];
        current.lastSession = session;
      }
      map.set(key, current);
    });
  });

  return Array.from(map.values()).sort((a, b) => b.logCount - a.logCount || b.routineCount - a.routineCount || a.name.localeCompare(b.name, 'pt-BR'));
}

export function ExercisesScreen({ history, programs, exerciseTemplates }: {
  history: WorkoutSession[];
  programs: ProgramTemplate[];
  exerciseTemplates: ExerciseTemplate[];
}) {
  const [query, setQuery] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | 'all'>('all');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const index = useMemo(() => buildExerciseIndex(history, programs, exerciseTemplates), [history, programs, exerciseTemplates]);
  const prs = useMemo(() => computePRs(history), [history]);
  const selected = selectedKey ? index.find(item => item.key === selectedKey) : undefined;
  const selectedLogs = useMemo(() => {
    if (!selectedKey) return [];
    return completedSessions(history).flatMap(session => session.exercises
      .filter(exercise => normalizeExerciseKey(exercise) === selectedKey)
      .map(exercise => ({ session, exercise, sets: workingSets(exercise) }))
      .filter(item => item.sets.length > 0))
      .reverse();
  }, [history, selectedKey]);

  const filtered = index.filter(item => {
    const needle = query.trim().toLowerCase();
    const matchesQuery = !needle || item.name.toLowerCase().includes(needle)
      || muscles(item.template).toLowerCase().includes(needle)
      || item.template?.equipment.toLowerCase().includes(needle);
    return matchesQuery && matchesMuscle(item.template, selectedMuscle);
  });

  const grouped = muscleOrder
    .map(muscle => ({
      muscle,
      items: filtered.filter(item => primaryMuscle(item.template) === muscle),
    }))
    .filter(group => group.items.length > 0);

  const ungrouped = filtered.filter(item => !item.template);
  if (ungrouped.length) grouped.push({ muscle: 'full-body', items: ungrouped });

  return (
    <>
      <ScrollView contentContainerStyle={commonStyles.screen} showsVerticalScrollIndicator={false}>
        <ScreenTitle eyebrow="EXERCISES" title="Exercicios" subtitle="Biblioteca, mapeamentos e historico por lift." />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar exercicio, musculo ou equipamento"
          placeholderTextColor={colors.textDim}
          style={styles.search}
        />
        <View style={styles.summaryGrid}>
          <View style={styles.metric}><Text style={styles.metricValue}>{index.length}</Text><Text style={styles.metricLabel}>exercicios</Text></View>
          <View style={styles.metric}><Text style={styles.metricValue}>{index.filter(item => item.logCount > 0).length}</Text><Text style={styles.metricLabel}>com logs</Text></View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.muscleFilters}>
          <Chip label="Todos" selected={selectedMuscle === 'all'} onPress={() => setSelectedMuscle('all')} />
          {muscleOrder.map(muscle => (
            <Chip key={muscle} label={muscleLabel(muscle)} selected={selectedMuscle === muscle} onPress={() => setSelectedMuscle(muscle)} />
          ))}
        </ScrollView>
        {grouped.map(group => (
          <View key={group.muscle} style={styles.group}>
            <Text style={styles.groupTitle}>{muscleLabel(group.muscle)}</Text>
            {group.items.map(item => {
              const pr = prs.get(item.key);
              return (
                <Pressable key={item.key} style={styles.exerciseCard} onPress={() => setSelectedKey(item.key)}>
                  <View style={commonStyles.between}>
                    <View style={{ flex: 1 }}>
                      <Text style={commonStyles.cardTitle}>{item.name}</Text>
                      <Text style={commonStyles.muted}>{muscles(item.template)}</Text>
                    </View>
                    <View style={styles.chevron}><Text style={styles.chevronText}>›</Text></View>
                  </View>
                  <View style={styles.metaRow}>
                    <Meta label="rotinas" value={String(item.routineCount)} />
                    <Meta label="logs" value={String(item.logCount)} />
                    <Meta label="volume" value={kg(item.totalVolume)} />
                  </View>
                  <Text style={styles.lastLine}>Ultimo: {formatSet(item.lastSet)} · {formatDate(item.lastSession?.startedAt)}</Text>
                  {pr ? <Text style={styles.prLine}>PR e1RM {pr.bestE1rm.toFixed(1)}kg · melhor carga {pr.bestWeight.toFixed(1)}kg</Text> : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>

      <ModalShell visible={Boolean(selected)} title={selected?.name ?? 'Exercicio'} onClose={() => setSelectedKey(null)}>
        {selected ? (
          <ScrollView>
            <View style={styles.modalHero}>
              <Text style={styles.modalTitle}>{selected.name}</Text>
              <Text style={commonStyles.muted}>{muscles(selected.template)}</Text>
              <Text style={styles.mappingLine}>ID de mapeamento: {selected.key}</Text>
              <View style={styles.metaRow}>
                <Meta label="rotinas" value={String(selected.routineCount)} />
                <Meta label="logs" value={String(selected.logCount)} />
                <Meta label="sets" value={String(selected.setCount)} />
              </View>
            </View>
            <View style={styles.howToCard}>
              <Text style={styles.howToTitle}>How To</Text>
              <View style={styles.demoBox}>
                <Text style={styles.demoIcon}>↕</Text>
                <Text style={styles.demoText}>Demo animation placeholder</Text>
              </View>
              {(selected.template?.instructions ?? ['Ajuste setup, amplitude e estabilidade antes do set efetivo.', 'Registre carga, reps e RIR de forma consistente.']).map((instruction, index) => (
                <View key={instruction + index} style={styles.instructionRow}>
                  <Text style={styles.instructionNumber}>{index + 1}</Text>
                  <Text style={styles.instructionText}>{instruction}</Text>
                </View>
              ))}
            </View>
            {selectedLogs.length === 0 ? (
              <View style={styles.empty}><Text style={commonStyles.muted}>Ainda nao ha historico finalizado para este exercicio.</Text></View>
            ) : selectedLogs.map(log => (
              <View key={log.session.id + log.exercise.id} style={styles.logCard}>
                <View style={commonStyles.between}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.logTitle}>{log.session.name} · {formatDate(log.session.startedAt)}</Text>
                    <Text style={commonStyles.muted}>{log.sets.length} sets · volume {kg(log.sets.reduce((total, set) => total + setVolumeKg(set), 0))}</Text>
                  </View>
                  <Text style={styles.e1rm}>{Math.max(...log.sets.map(estimated1Rm)).toFixed(1)} e1RM</Text>
                </View>
                {log.sets.map(set => (
                  <View key={set.id} style={styles.setRow}>
                    <Text style={styles.setOrder}>{set.order}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.setMain}>{formatSet(set)}</Text>
                      {setSegments(set).length > 1 ? (
                        <View style={styles.blocks}>
                          {setSegments(set).map((reps, index) => (
                            <Text key={index} style={styles.blockPill}>B{index + 1} {reps}</Text>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
        ) : null}
      </ModalShell>
    </>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return <View style={styles.meta}><Text style={styles.metaValue}>{value}</Text><Text style={styles.metaLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  search: { minHeight: 50, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.elevated, color: colors.text, paddingHorizontal: 14, marginTop: 14, fontSize: type.md, fontWeight: '700' },
  summaryGrid: { flexDirection: 'row', gap: 10, marginTop: 12 },
  muscleFilters: { gap: 8, paddingTop: 12, paddingBottom: 2, paddingRight: 20 },
  group: { marginTop: 16 },
  groupTitle: { color: colors.text, fontSize: type.lg, fontWeight: '900', marginBottom: 2 },
  exerciseCard: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.xl, padding: 16, marginTop: 10 },
  metric: { flex: 1, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: 14 },
  metricValue: { color: colors.text, fontSize: 26, fontWeight: '900' },
  metricLabel: { color: colors.muted, fontSize: type.xs, fontWeight: '900', marginTop: 4, textTransform: 'uppercase' },
  chevron: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border },
  chevronText: { color: colors.accent, fontSize: 24, fontWeight: '900', lineHeight: 26 },
  metaRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  meta: { flex: 1, backgroundColor: colors.elevated, borderRadius: radius.md, borderColor: colors.border, borderWidth: 1, padding: 10 },
  metaValue: { color: colors.text, fontWeight: '900', fontSize: type.md },
  metaLabel: { color: colors.textDim, fontWeight: '900', fontSize: type.xs, marginTop: 3, textTransform: 'uppercase' },
  lastLine: { color: colors.muted, fontSize: type.sm, fontWeight: '800', marginTop: 12 },
  prLine: { color: colors.accent, fontSize: type.xs, fontWeight: '900', marginTop: 5 },
  modalHero: { backgroundColor: colors.elevated, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: 14 },
  modalTitle: { color: colors.text, fontSize: type.xl, fontWeight: '900' },
  mappingLine: { color: colors.textDim, fontSize: type.xs, fontWeight: '800', marginTop: 8 },
  howToCard: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: 12, marginTop: 12 },
  howToTitle: { color: colors.text, fontSize: type.lg, fontWeight: '900' },
  demoBox: { minHeight: 120, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  demoIcon: { color: colors.accent, fontSize: 32, fontWeight: '900' },
  demoText: { color: colors.muted, fontSize: type.xs, fontWeight: '900', marginTop: 6, textTransform: 'uppercase' },
  instructionRow: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', marginTop: 10 },
  instructionNumber: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.accentSoft, color: colors.accent, textAlign: 'center', lineHeight: 22, fontSize: type.xs, fontWeight: '900' },
  instructionText: { flex: 1, color: colors.muted, fontSize: type.sm, lineHeight: 18, fontWeight: '700' },
  empty: { paddingVertical: 20, alignItems: 'center' },
  logCard: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: 12, marginTop: 12 },
  logTitle: { color: colors.text, fontWeight: '900', fontSize: type.md },
  e1rm: { color: colors.accent, fontSize: type.xs, fontWeight: '900' },
  setRow: { flexDirection: 'row', gap: 10, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, marginTop: 10 },
  setOrder: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.accentSoft, color: colors.accent, textAlign: 'center', lineHeight: 26, fontSize: type.xs, fontWeight: '900' },
  setMain: { color: colors.text, fontWeight: '900', fontSize: type.sm },
  blocks: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 5 },
  blockPill: { overflow: 'hidden', color: colors.text, fontSize: 8, fontWeight: '900', backgroundColor: colors.accentSoft, borderColor: colors.accentBorder, borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 6, paddingVertical: 2 },
});
