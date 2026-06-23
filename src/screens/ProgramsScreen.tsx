import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { exerciseLibrary } from '../data/appDefaults';
import { configForTechnique, emptyPrescription, exerciseWithPrescriptions, prescriptionSummary, prescriptionsFor, techniqueLabel, techniqueOptions, techniqueProfile } from '../data/techniques';
import { colors } from '../theme';
import type { ProgramExercise, ProgramTemplate, SetPrescription } from '../types/training';
import { ActionButton, Chip, commonStyles, ModalShell, ScreenTitle, Stepper } from '../ui';

type EditorTarget = { programId: string; exerciseIndex: number };
type ProgramEditorTarget = { programId: string };

function slugifyExerciseName(name: string) {
  const slug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return slug || 'exercicio';
}

function blankExercise(name: string): ProgramExercise {
  return {
    exerciseId: slugifyExerciseName(name),
    exerciseName: name.trim() || 'Novo exercício',
    targetSets: 0,
    targetRepRange: [0, 0],
    targetRirRange: [0, 0],
    targetRestSeconds: 120,
    setPrescriptions: [],
  };
}

function exerciseFromLibrary(item: typeof exerciseLibrary[number]): ProgramExercise {
  return {
    exerciseId: item.id,
    exerciseName: item.name,
    targetSets: 0,
    targetRepRange: [0, 0],
    targetRirRange: [0, 0],
    targetRestSeconds: item.rest,
    setPrescriptions: [],
  };
}

function TechniquePrescriptionEditor({ prescription, onChange }: {
  prescription: SetPrescription;
  onChange: (next: SetPrescription) => void;
}) {
  const profile = techniqueProfile(prescription.technique);
  const config = configForTechnique(prescription.technique, prescription.techniqueConfig);

  function updateConfig(patch: Partial<NonNullable<SetPrescription['techniqueConfig']>>) {
    onChange({ ...prescription, techniqueConfig: { ...config, ...patch } });
  }

  return (
    <>
      <Text style={styles.techniqueHelp}>{profile.explanation}</Text>
      <View style={styles.steppers}>
        <Stepper label={profile.primaryRepsLabel + ' MÍN.'} value={prescription.repRange[0]} max={100} onChange={value => onChange({ ...prescription, repRange: [value, Math.max(value, prescription.repRange[1])] })} />
        <Stepper label={profile.primaryRepsLabel + ' MÁX.'} value={prescription.repRange[1]} max={100} onChange={value => onChange({ ...prescription, repRange: [Math.min(prescription.repRange[0], value), value] })} />
      </View>
      {profile.secondaryRepsLabel && config?.secondaryRepRange ? (
        <View style={styles.steppers}>
          <Stepper label={profile.secondaryRepsLabel + ' MÍN.'} value={config.secondaryRepRange[0]} max={100} onChange={value => updateConfig({ secondaryRepRange: [value, Math.max(value, config.secondaryRepRange![1])] })} />
          <Stepper label={profile.secondaryRepsLabel + ' MÁX.'} value={config.secondaryRepRange[1]} max={100} onChange={value => updateConfig({ secondaryRepRange: [Math.min(config.secondaryRepRange![0], value), value] })} />
        </View>
      ) : null}
      {profile.blocksLabel && config?.blocks !== undefined ? (
        <View style={styles.steppers}>
          <Stepper label={profile.blocksLabel} value={config.blocks} min={1} max={10} onChange={value => updateConfig({ blocks: value })} />
          {config.intraSetRestSeconds !== undefined ? (
            <Stepper label="PAUSA INTERNA" value={config.intraSetRestSeconds} suffix=" s" min={0} max={120} step={5} onChange={value => updateConfig({ intraSetRestSeconds: value })} />
          ) : null}
        </View>
      ) : null}
      {config?.loadDropPercent !== undefined ? (
        <View style={styles.steppers}>
          <Stepper label="REDUÇÃO POR QUEDA" value={config.loadDropPercent} suffix="%" min={0} max={80} step={5} onChange={value => updateConfig({ loadDropPercent: value })} />
        </View>
      ) : null}
      {config?.breathsBetweenBlocks !== undefined ? (
        <View style={styles.steppers}>
          <Stepper label="RESPIRAÇÕES ENTRE BLOCOS" value={config.breathsBetweenBlocks} min={1} max={20} onChange={value => updateConfig({ breathsBetweenBlocks: value })} />
        </View>
      ) : null}
      <View style={styles.steppers}>
        <Stepper label="RIR MÍN." value={prescription.rirRange[0]} max={10} onChange={value => onChange({ ...prescription, rirRange: [value, Math.max(value, prescription.rirRange[1])] })} />
        <Stepper label="RIR MÁX." value={prescription.rirRange[1]} max={10} onChange={value => onChange({ ...prescription, rirRange: [Math.min(prescription.rirRange[0], value), value] })} />
      </View>
    </>
  );
}

export function ProgramsScreen({ programs, onStart, onDuplicate, onCreate, onCreateBlank, onDelete, onUpdate }: {
  programs: ProgramTemplate[];
  onStart: (program: ProgramTemplate) => void;
  onDuplicate: (program: ProgramTemplate) => void;
  onCreate: () => void;
  onCreateBlank: () => void;
  onDelete: (id: string) => void;
  onUpdate: (program: ProgramTemplate) => void;
}) {
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const [programEditor, setProgramEditor] = useState<ProgramEditorTarget | null>(null);
  const [newExerciseName, setNewExerciseName] = useState('');
  const program = editor ? programs.find(item => item.id === editor.programId) : undefined;
  const editedExercise = program && editor ? program.exercises[editor.exerciseIndex] : undefined;
  const editedProgram = programEditor ? programs.find(item => item.id === programEditor.programId) : undefined;

  function updateProgram(program: ProgramTemplate) {
    onUpdate(program);
  }

  function updateProgramExercise(program: ProgramTemplate, exerciseIndex: number, next: ProgramExercise) {
    updateProgram({ ...program, exercises: program.exercises.map((item, index) => index === exerciseIndex ? next : item) });
  }

  function addExerciseToProgram(program: ProgramTemplate, exercise: ProgramExercise) {
    updateProgram({ ...program, exercises: [...program.exercises, exercise] });
    setNewExerciseName('');
  }

  function moveExercise(program: ProgramTemplate, from: number, to: number) {
    if (to < 0 || to >= program.exercises.length) return;
    const exercises = [...program.exercises];
    const [moved] = exercises.splice(from, 1);
    exercises.splice(to, 0, moved);
    updateProgram({ ...program, exercises });
  }

  function updateExercise(next: ProgramExercise) {
    if (!program || !editor) return;
    updateProgramExercise(program, editor.exerciseIndex, next);
  }

  function updatePrescriptions(next: SetPrescription[]) {
    if (editedExercise) updateExercise(exerciseWithPrescriptions(editedExercise, next));
  }

  function setCount(count: number) {
    if (!editedExercise) return;
    const current = prescriptionsFor(editedExercise);
    const next = current.slice(0, count);
    while (next.length < count) {
      const source = next[next.length - 1];
      next.push(source
        ? { ...source, repRange: [...source.repRange], rirRange: [...source.rirRange] }
        : emptyPrescription());
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
        <ScreenTitle eyebrow="PLANEJAMENTO" title="Treinos personalizados" subtitle="Crie, ajuste e preserve todos os programas" />
        <View style={styles.actions}>
          <View style={{ flex: 1 }}><ActionButton label="+ CRIAR TREINO NOVO" onPress={onCreateBlank} /></View>
          <View style={{ flex: 1 }}><ActionButton label="+ COPIAR TREINO ATUAL" tone="secondary" onPress={onCreate} /></View>
        </View>
        {programs.map(item => (
          <View key={item.id} style={commonStyles.card}>
            <View style={commonStyles.between}>
              <View style={{ flex: 1 }}>
                <View style={styles.titleRow}>
                  <Text style={commonStyles.cardTitle}>{item.name}</Text>
                  {item.split ? <View style={[styles.splitBadge, item.split === 'Lower' && styles.lowerBadge]}><Text style={styles.splitText}>{item.split}</Text></View> : null}
                </View>
                <Text style={commonStyles.muted}>{item.description || 'Sem descrição'}</Text>
              </View>
              <View style={styles.badge}><Text style={styles.badgeText}>{item.exercises.length}</Text></View>
            </View>

            <View style={styles.list}>
              {item.exercises.length === 0 ? (
                <View style={styles.emptyProgram}><Text style={styles.undefined}>Nenhum exercício neste treino.</Text></View>
              ) : item.exercises.map((exercise, index) => {
                const sets = prescriptionsFor(exercise);
                return (
                  <Pressable key={exercise.exerciseId + index} style={styles.exerciseRow} onPress={() => setEditor({ programId: item.id, exerciseIndex: index })}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.exerciseName}>{index + 1}. {exercise.exerciseName}</Text>
                      <Text style={[styles.exercisePrescription, sets.length === 0 && styles.undefined]}>
                        {sets.length === 0
                          ? 'Sem prescrição · toque para configurar'
                          : sets.map((set, setIndex) => `${setIndex + 1} ${techniqueLabel(set.technique)} · ${prescriptionSummary(set)} · RIR ${set.rirRange[0]}–${set.rirRange[1]}`).join('  |  ')}
                      </Text>
                      {exercise.notes ? <Text style={styles.notePreview}>Obs.: {exercise.notes}</Text> : null}
                    </View>
                    <Text style={styles.edit}>SETS</Text>
                  </Pressable>
                );
              })}
            </View>
            <ActionButton label="INICIAR ESTE TREINO" onPress={() => onStart(item)} />
            <View style={styles.actions}>
              <View style={{ flex: 1 }}><ActionButton label="Editar treino" tone="secondary" onPress={() => setProgramEditor({ programId: item.id })} /></View>
              <View style={{ flex: 1 }}><ActionButton label="Duplicar" tone="secondary" onPress={() => onDuplicate(item)} /></View>
              {item.id.startsWith('custom-') ? <View style={{ flex: 1 }}><ActionButton label="Excluir" tone="danger" onPress={() => onDelete(item.id)} /></View> : null}
            </View>
          </View>
        ))}
      </ScrollView>

      <ModalShell visible={Boolean(editedProgram)} title={editedProgram ? `Editar ${editedProgram.name}` : 'Editar treino'} onClose={() => setProgramEditor(null)}>
        {editedProgram ? (
          <>
            <ScrollView contentContainerStyle={styles.editorContent}>
              <Text style={styles.sectionTitle}>DADOS DO TREINO</Text>
              <Text style={styles.fieldLabel}>Nome</Text>
              <TextInput value={editedProgram.name} onChangeText={name => updateProgram({ ...editedProgram, name })} placeholder="Ex.: Upper 1" placeholderTextColor={colors.textDim} style={styles.input} />
              <Text style={styles.fieldLabel}>Descrição</Text>
              <TextInput value={editedProgram.description} onChangeText={description => updateProgram({ ...editedProgram, description })} placeholder="Objetivo, foco, observações gerais..." placeholderTextColor={colors.textDim} style={styles.input} />
              <Text style={styles.fieldLabel}>Divisão</Text>
              <View style={styles.chips}>
                <Chip label="Upper" selected={editedProgram.split === 'Upper'} onPress={() => updateProgram({ ...editedProgram, split: 'Upper' })} />
                <Chip label="Lower" selected={editedProgram.split === 'Lower'} onPress={() => updateProgram({ ...editedProgram, split: 'Lower' })} />
                <Chip label="Livre" selected={!editedProgram.split} onPress={() => updateProgram({ ...editedProgram, split: undefined })} />
              </View>

              <Text style={styles.sectionTitle}>EXERCÍCIOS</Text>
              {editedProgram.exercises.length === 0 ? (
                <View style={styles.emptyPrescription}><Text style={styles.undefined}>Adicione exercícios para este treino aparecer completo na aba Treino.</Text></View>
              ) : editedProgram.exercises.map((exercise, index) => (
                <View key={exercise.exerciseId + index} style={styles.programExerciseEditor}>
                  <Text style={styles.setTitle}>{index + 1}. {exercise.exerciseName}</Text>
                  <TextInput value={exercise.exerciseName} onChangeText={exerciseName => updateProgramExercise(editedProgram, index, { ...exercise, exerciseName, exerciseId: slugifyExerciseName(exerciseName) })} placeholder="Nome do exercício" placeholderTextColor={colors.textDim} style={styles.input} />
                  <View style={styles.actions}>
                    <View style={{ flex: 1 }}><ActionButton label="↑" tone="secondary" disabled={index === 0} onPress={() => moveExercise(editedProgram, index, index - 1)} /></View>
                    <View style={{ flex: 1 }}><ActionButton label="↓" tone="secondary" disabled={index === editedProgram.exercises.length - 1} onPress={() => moveExercise(editedProgram, index, index + 1)} /></View>
                    <View style={{ flex: 2 }}><ActionButton label="Editar sets" tone="secondary" onPress={() => { setEditor({ programId: editedProgram.id, exerciseIndex: index }); setProgramEditor(null); }} /></View>
                    <View style={{ flex: 1.4 }}><ActionButton label="Remover" tone="danger" onPress={() => updateProgram({ ...editedProgram, exercises: editedProgram.exercises.filter((_, itemIndex) => itemIndex !== index) })} /></View>
                  </View>
                </View>
              ))}

              <Text style={styles.sectionTitle}>ADICIONAR EXERCÍCIO</Text>
              <TextInput value={newExerciseName} onChangeText={setNewExerciseName} placeholder="Nome livre do exercício" placeholderTextColor={colors.textDim} style={styles.input} />
              <ActionButton label="ADICIONAR NOME LIVRE" disabled={!newExerciseName.trim()} onPress={() => addExerciseToProgram(editedProgram, blankExercise(newExerciseName))} />
              <Text style={[commonStyles.muted, { marginTop: 12 }]}>Ou escolha um exercício que já existe nos treinos A/B:</Text>
              <View style={styles.libraryGrid}>
                {exerciseLibrary.map(item => (
                  <Pressable key={item.id} style={styles.libraryPill} onPress={() => addExerciseToProgram(editedProgram, exerciseFromLibrary(item))}>
                    <Text style={styles.libraryPillText}>{item.name}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
            <ActionButton label="CONCLUIR" onPress={() => setProgramEditor(null)} />
          </>
        ) : null}
      </ModalShell>

      <ModalShell visible={Boolean(editedExercise)} title={editedExercise?.exerciseName ?? 'Editar prescrição'} onClose={() => setEditor(null)}>
        {editedExercise ? (
          <>
            <ScrollView contentContainerStyle={styles.editorContent}>
              <Text style={styles.sectionTitle}>SETS PRESCRITOS</Text>
              <Text style={commonStyles.muted}>Começa vazio. Use + somente para os sets que você realmente pretende fazer.</Text>
              <View style={{ marginTop: 8 }}>
                <Stepper label="QUANTIDADE" value={prescriptionsFor(editedExercise).length} min={0} max={10} onChange={setCount} />
              </View>

              {prescriptionsFor(editedExercise).length === 0 ? (
                <View style={styles.emptyPrescription}><Text style={styles.undefined}>Nenhum set definido.</Text></View>
              ) : prescriptionsFor(editedExercise).map((set, setIndex) => (
                <View key={setIndex} style={styles.setEditor}>
                  <Text style={styles.setTitle}>SET {setIndex + 1}</Text>
                  <Text style={styles.fieldLabel}>Técnica</Text>
                  <View style={styles.chips}>
                    {techniqueOptions.map(option => (
                      <Chip key={option.value} label={option.label} selected={set.technique === option.value} onPress={() => updateSet(setIndex, { ...set, technique: option.value, techniqueConfig: configForTechnique(option.value) })} />
                    ))}
                  </View>
                  <TechniquePrescriptionEditor prescription={set} onChange={next => updateSet(setIndex, next)} />
                </View>
              ))}

              <Text style={styles.sectionTitle}>OBSERVAÇÕES DO EXERCÍCIO</Text>
              <TextInput multiline value={editedExercise.notes ?? ''} onChangeText={notes => updateExercise({ ...editedExercise, notes })} placeholder="Execução, ajustes, equipamento, straps…" placeholderTextColor={colors.textDim} style={styles.notes} />
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
  emptyProgram: { paddingVertical: 16, alignItems: 'center' },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.border },
  exerciseName: { color: colors.text, fontSize: 12, fontWeight: '700' },
  exercisePrescription: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 3 },
  undefined: { color: colors.textDim, fontSize: 10 },
  notePreview: { color: colors.textDim, fontSize: 10, fontStyle: 'italic', marginTop: 3 },
  edit: { color: colors.accent, fontSize: 9, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 8 },
  editorContent: { paddingBottom: 12 },
  sectionTitle: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginTop: 12, marginBottom: 8 },
  emptyPrescription: { backgroundColor: colors.elevated, borderRadius: 12, padding: 18, marginTop: 12, alignItems: 'center' },
  setEditor: { backgroundColor: colors.elevated, borderRadius: 12, padding: 12, marginTop: 12 },
  programExerciseEditor: { backgroundColor: colors.elevated, borderRadius: 12, padding: 12, marginTop: 10 },
  setTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  fieldLabel: { color: colors.muted, fontSize: 10, fontWeight: '700', marginTop: 11, marginBottom: 6 },
  techniqueHelp: { color: colors.textDim, fontSize: 10, lineHeight: 15, marginTop: 10 },
  chips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 8 },
  steppers: { flexDirection: 'row', gap: 8, marginTop: 10 },
  input: { color: colors.text, backgroundColor: colors.elevated, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 44 },
  notes: { minHeight: 96, color: colors.text, backgroundColor: colors.elevated, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 12, textAlignVertical: 'top' },
  libraryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 },
  libraryPill: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: colors.elevated },
  libraryPillText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
});
