import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { exerciseWithPrescriptions, prescriptionsFor, techniqueLabel, techniqueOptions } from '../data/techniques';
import { colors } from '../theme';
import type { ProgramExercise, ProgramTemplate, SetPrescription } from '../types/training';
import { ActionButton, Chip, commonStyles, ModalShell, ScreenTitle, Stepper } from '../ui';

type EditorTarget = { programId: string; exerciseIndex: number };

export function ProgramsScreen({ programs, onStart, onDuplicate, onCreate, onDelete, onUpdate }: {
  programs: ProgramTemplate[];
  onStart: (program: ProgramTemplate) => void;
  onDuplicate: (program: ProgramTemplate) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onUpdate: (program: ProgramTemplate) => void;
}) {
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const program = editor ? programs.find(item => item.id === editor.programId) : undefined;
  const editedExercise = program && editor ? program.exercises[editor.exerciseIndex] : undefined;

  function updateExercise(next: ProgramExercise) {
    if (!program || !editor) return;
    onUpdate({
      ...program,
      exercises: program.exercises.map((item, index) => index === editor.exerciseIndex ? next : item),
    });
  }

  function updatePrescriptions(next: SetPrescription[]) {
    if (!editedExercise) return;
    updateExercise(exerciseWithPrescriptions(editedExercise, next));
  }

  function setCount(count: number) {
    if (!editedExercise) return;
    const current = prescriptionsFor(editedExercise);
    const next = current.slice(0, count);
    while (next.length < count) {
      const source = next[next.length - 1] ?? current[0];
      next.push({ ...source, repRange: [...source.repRange], rirRange: [...source.rirRange] });
    }
    updatePrescriptions(next);
  }

  function updateSet(setIndex: number, nextSet: SetPrescription) {
    if (!editedExercise) return;
    updatePrescriptions(prescriptionsFor(editedExercise).map((item, index) => index === setIndex ? nextSet : item));
  }

  return (
    <>
      <ScrollView contentContainerStyle={commonStyles.screen}>
        <ScreenTitle eyebrow="PLANEJAMENTO" title="Treinos personalizados" subtitle="Edite cada set, técnica, repetições, RIR e observações" />
        <ActionButton label="+ CRIAR A PARTIR DO TREINO ATUAL" onPress={onCreate} />
        {programs.map(item => (
          <View key={item.id} style={commonStyles.card}>
            <View style={commonStyles.between}>
              <View style={{ flex: 1 }}>
                <View style={styles.titleRow}>
                  <Text style={commonStyles.cardTitle}>{item.name}</Text>
                  {item.split ? (
                    <View style={[styles.splitBadge, item.split === 'Lower' && styles.lowerBadge]}>
                      <Text style={styles.splitText}>{item.split}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={commonStyles.muted}>{item.description}</Text>
              </View>
              <View style={styles.badge}><Text style={styles.badgeText}>{item.exercises.length}</Text></View>
            </View>

            <View style={styles.list}>
              {item.exercises.map((exercise, index) => {
                const sets = prescriptionsFor(exercise);
                return (
                  <Pressable
                    key={exercise.exerciseId + index}
                    style={styles.exerciseRow}
                    onPress={() => setEditor({ programId: item.id, exerciseIndex: index })}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.exerciseName}>{index + 1}. {exercise.exerciseName}</Text>
                      <Text style={styles.exercisePrescription}>
                        {sets.map((set, setIndex) => `${setIndex + 1} ${techniqueLabel(set.technique)} ${set.repRange[0]}–${set.repRange[1]} · RIR ${set.rirRange[0]}–${set.rirRange[1]}`).join('  |  ')}
                      </Text>
                      {exercise.notes ? <Text style={styles.notePreview}>Obs.: {exercise.notes}</Text> : null}
                    </View>
                    <Text style={styles.edit}>EDITAR</Text>
                  </Pressable>
                );
              })}
            </View>
            <ActionButton label="INICIAR ESTE TREINO" onPress={() => onStart(item)} />
            <View style={styles.actions}>
              <View style={{ flex: 1 }}><ActionButton label="Duplicar" tone="secondary" onPress={() => onDuplicate(item)} /></View>
              {item.id.startsWith('custom-') ? <View style={{ flex: 1 }}><ActionButton label="Excluir" tone="danger" onPress={() => onDelete(item.id)} /></View> : null}
            </View>
          </View>
        ))}
      </ScrollView>

      <ModalShell
        visible={Boolean(editedExercise)}
        title={editedExercise?.exerciseName ?? 'Editar prescrição'}
        onClose={() => setEditor(null)}
      >
        {editedExercise ? (
          <>
            <ScrollView contentContainerStyle={styles.editorContent}>
              <Text style={styles.sectionTitle}>QUANTIDADE DE SETS</Text>
              <Stepper
                label="SETS"
                value={prescriptionsFor(editedExercise).length}
                min={1}
                max={10}
                onChange={setCount}
              />

              {prescriptionsFor(editedExercise).map((set, setIndex) => (
                <View key={setIndex} style={styles.setEditor}>
                  <Text style={styles.setTitle}>SET {setIndex + 1}</Text>
                  <Text style={styles.fieldLabel}>Técnica</Text>
                  <View style={styles.chips}>
                    {techniqueOptions.map(option => (
                      <Chip
                        key={option.value}
                        label={option.label}
                        selected={set.technique === option.value}
                        onPress={() => updateSet(setIndex, { ...set, technique: option.value })}
                      />
                    ))}
                  </View>
                  <View style={styles.steppers}>
                    <Stepper
                      label="REP MÍN."
                      value={set.repRange[0]}
                      max={100}
                      onChange={value => updateSet(setIndex, { ...set, repRange: [value, Math.max(value, set.repRange[1])] })}
                    />
                    <Stepper
                      label="REP MÁX."
                      value={set.repRange[1]}
                      max={100}
                      onChange={value => updateSet(setIndex, { ...set, repRange: [Math.min(set.repRange[0], value), value] })}
                    />
                  </View>
                  <View style={styles.steppers}>
                    <Stepper
                      label="RIR MÍN."
                      value={set.rirRange[0]}
                      max={10}
                      onChange={value => updateSet(setIndex, { ...set, rirRange: [value, Math.max(value, set.rirRange[1])] })}
                    />
                    <Stepper
                      label="RIR MÁX."
                      value={set.rirRange[1]}
                      max={10}
                      onChange={value => updateSet(setIndex, { ...set, rirRange: [Math.min(set.rirRange[0], value), value] })}
                    />
                  </View>
                </View>
              ))}

              <Text style={styles.sectionTitle}>OBSERVAÇÕES DO EXERCÍCIO</Text>
              <TextInput
                multiline
                value={editedExercise.notes ?? ''}
                onChangeText={notes => updateExercise({ ...editedExercise, notes })}
                placeholder="Ex.: segurar 1s no pico, banco no ajuste 4, usar straps…"
                placeholderTextColor={colors.textDim}
                style={styles.notes}
              />
            </ScrollView>
            <ActionButton label="CONCLUIR E SALVAR" onPress={() => setEditor(null)} />
          </>
        ) : null}
      </ModalShell>
    </>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  splitBadge: { backgroundColor: '#163A35', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  lowerBadge: { backgroundColor: '#332A18' },
  splitText: { color: colors.accent, fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  badge: { width: 35, height: 35, borderRadius: 18, backgroundColor: colors.accentSoft, justifyContent: 'center', alignItems: 'center' },
  badgeText: { color: colors.accent, fontWeight: '800' },
  list: { marginTop: 12, backgroundColor: colors.elevated, borderRadius: 10, paddingHorizontal: 10 },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.border },
  exerciseName: { color: colors.text, fontSize: 12, fontWeight: '700' },
  exercisePrescription: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 3 },
  notePreview: { color: colors.textDim, fontSize: 10, fontStyle: 'italic', marginTop: 3 },
  edit: { color: colors.accent, fontSize: 9, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 8 },
  editorContent: { paddingBottom: 12 },
  sectionTitle: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginTop: 12, marginBottom: 8 },
  setEditor: { backgroundColor: colors.elevated, borderRadius: 12, padding: 12, marginTop: 12 },
  setTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  fieldLabel: { color: colors.muted, fontSize: 10, fontWeight: '700', marginTop: 11 },
  chips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 8 },
  steppers: { flexDirection: 'row', gap: 8, marginTop: 10 },
  notes: { minHeight: 96, color: colors.text, backgroundColor: colors.elevated, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 12, textAlignVertical: 'top' },
});
