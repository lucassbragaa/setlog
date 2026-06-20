import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { exerciseLibrary } from '../data/appDefaults';
import { isProgramCode } from '../data/cycles';
import { prescriptionsFor, techniqueLabel, techniqueOptions } from '../data/techniques';
import { colors } from '../theme';
import type { ExerciseBlock, LoggedSet, ProgramTemplate, RangeOfMotion, SetType, WorkoutSession } from '../types/training';
import { ActionButton, Chip, commonStyles, ModalShell, ScreenTitle, Stepper } from '../ui';

function formatTimer(seconds: number) {
  return Math.floor(seconds / 60).toString().padStart(2, '0') + ':' + (seconds % 60).toString().padStart(2, '0');
}

function ExerciseCard({ block, index, onChange, onRemove }: {
  block: ExerciseBlock;
  index: number;
  onChange: (block: ExerciseBlock) => void;
  onRemove: () => void;
}) {
  const last = block.sets[block.sets.length - 1];
  const prescriptions = prescriptionsFor(block);
  const nextPrescription = prescriptions[block.sets.length];
  const [weight, setWeight] = useState(last?.loadKg ?? 0);
  const [reps, setReps] = useState(nextPrescription?.repRange[1] ?? last?.repetitions ?? 0);
  const [rir, setRir] = useState(nextPrescription?.rirRange[1] ?? last?.rir ?? 0);
  const [type, setType] = useState<SetType>(nextPrescription?.technique ?? 'working');
  const [details, setDetails] = useState(false);
  const [menu, setMenu] = useState(false);
  const [rom, setRom] = useState<RangeOfMotion>('full');
  const [quality, setQuality] = useState(4);
  const [pain, setPain] = useState(0);

  useEffect(() => {
    if (!nextPrescription) return;
    setReps(nextPrescription.repRange[1]);
    setRir(nextPrescription.rirRange[1]);
    setType(nextPrescription.technique);
  }, [
    block.sets.length,
    nextPrescription?.repRange[0],
    nextPrescription?.repRange[1],
    nextPrescription?.rirRange[0],
    nextPrescription?.rirRange[1],
    nextPrescription?.technique,
  ]);

  function logSet() {
    const set: LoggedSet = {
      id: 'set-' + Date.now() + '-' + block.id,
      order: block.sets.length + 1,
      type,
      loadKg: weight,
      repetitions: reps,
      rir,
      completedAt: new Date().toISOString(),
      rangeOfMotion: rom,
      techniqueQuality: quality as 1 | 2 | 3 | 4 | 5,
      painScore: pain,
    };
    onChange({ ...block, sets: [...block.sets, set] });
  }

  return (
    <View style={styles.exerciseCard}>
      <View style={commonStyles.between}>
        <View style={styles.exerciseHeader}>
          <View style={styles.number}><Text style={styles.numberText}>{String(index + 1).padStart(2, '0')}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={commonStyles.cardTitle}>{block.exerciseName}</Text>
            <Text style={prescriptions.length ? commonStyles.muted : styles.unprescribed}>
              {prescriptions.length ? prescriptions.map(item => techniqueLabel(item.technique)).join(' / ') : 'Sem prescrição definida'}
            </Text>
            {block.notes ? <Text style={styles.notePreview}>Obs.: {block.notes}</Text> : null}
          </View>
        </View>
        <Pressable onPress={() => setMenu(value => !value)}><Text style={styles.more}>•••</Text></Pressable>
      </View>

      {menu && (
        <View style={styles.inlineMenu}>
          <ActionButton label="Limpar sets" tone="secondary" onPress={() => { onChange({ ...block, sets: [] }); setMenu(false); }} />
          <ActionButton label="Remover exercício" tone="danger" onPress={onRemove} />
        </View>
      )}

      <View style={styles.tableHeader}>
        <Text style={styles.smallColumn}>SET</Text><Text style={styles.column}>CARGA</Text><Text style={styles.column}>REPS</Text><Text style={styles.column}>RIR</Text><Text style={styles.smallColumn}>AÇÃO</Text>
      </View>
      {block.sets.length === 0 ? <Text style={styles.emptySets}>Nenhum set registrado.</Text> : block.sets.map(set => (
        <View style={styles.setRow} key={set.id}>
          <View style={styles.smallCell}><Text style={styles.cellText}>{set.order}</Text><Text style={styles.techniqueMini}>{techniqueLabel(set.type)}</Text></View>
          <Text style={styles.cell}>{set.loadKg} kg</Text>
          <Text style={styles.cell}>{set.repetitions}</Text>
          <Text style={styles.cell}>{set.rir ?? '—'}</Text>
          <Pressable style={styles.smallCell} onPress={() => onChange({ ...block, sets: block.sets.filter(item => item.id !== set.id).map((item, order) => ({ ...item, order: order + 1 })) })}>
            <Text style={styles.deleteSet}>×</Text>
          </Pressable>
        </View>
      ))}

      <View style={styles.nextPrescription}>
        <Text style={styles.next}>{nextPrescription ? 'PRÓXIMO SET PRESCRITO' : 'PRÓXIMO SET · MANUAL'} · {techniqueLabel(type).toUpperCase()}</Text>
        {nextPrescription ? <Text style={styles.target}>META {nextPrescription.repRange[0]}–{nextPrescription.repRange[1]} REPS · RIR {nextPrescription.rirRange[0]}–{nextPrescription.rirRange[1]}</Text> : null}
      </View>
      <View style={styles.steppers}>
        <Stepper label="CARGA" value={weight} suffix=" kg" step={0.5} onChange={setWeight} />
        <Stepper label="REPS" value={reps} max={100} onChange={setReps} />
        <Stepper label="RIR" value={rir} max={10} onChange={setRir} />
      </View>
      <View style={styles.quickWeights}>
        <Text style={styles.quickWeightsLabel}>REDUZIR CARGA</Text>
        <View style={styles.quickWeightsRow}>
          {[2.5, 5, 10, 20].map(amount => (
            <Pressable key={amount} style={[styles.quickWeight, styles.quickWeightReduce]} onPress={() => setWeight(value => Math.max(0, value - amount))}>
              <Text style={styles.quickWeightReduceText}>{'−' + String(amount).replace('.', ',') + ' kg'}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={[styles.quickWeightsLabel, styles.addWeightLabel]}>ADICIONAR CARGA</Text>
        <View style={styles.quickWeightsRow}>
          {[2.5, 5, 10, 20].map(amount => (
            <Pressable key={amount} style={styles.quickWeight} onPress={() => setWeight(value => Math.min(999, value + amount))}>
              <Text style={styles.quickWeightText}>{'+' + String(amount).replace('.', ',') + ' kg'}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Text style={styles.detailTitle}>TÉCNICA DESTE SET</Text>
      <View style={styles.chips}>
        {techniqueOptions.map(option => <Chip key={option.value} label={option.label} selected={type === option.value} onPress={() => setType(option.value)} />)}
      </View>
      <Chip label={details ? '− Fechar detalhes e observações' : '+ Detalhes e observações'} selected={details} onPress={() => setDetails(value => !value)} />

      {details && (
        <View style={styles.details}>
          <Text style={styles.detailTitle}>Amplitude</Text>
          <View style={styles.chips}>
            <Chip label="Completa" selected={rom === 'full'} onPress={() => setRom('full')} />
            <Chip label="Parcial alongada" selected={rom === 'lengthenedPartial'} onPress={() => setRom('lengthenedPartial')} />
          </View>
          <Text style={styles.detailTitle}>Técnica de execução · {quality}/5</Text>
          <Stepper label="QUALIDADE" value={quality} min={1} max={5} onChange={setQuality} />
          <Text style={styles.detailTitle}>Dor · {pain}/10</Text>
          <Stepper label="DOR" value={pain} max={10} onChange={setPain} />
          <Text style={styles.detailTitle}>Observações do exercício</Text>
          <TextInput multiline value={block.notes ?? ''} onChangeText={notes => onChange({ ...block, notes })} placeholder="Execução, ajustes, equipamento ou qualquer detalhe…" placeholderTextColor={colors.textDim} style={styles.notes} />
        </View>
      )}
      <ActionButton label={'REGISTRAR SET ' + (block.sets.length + 1)} onPress={logSet} />
    </View>
  );
}

export function WorkoutScreen({ session, programs, saveStatus, onChange, onFinish, onSelectProgram }: {
  session: WorkoutSession;
  programs: ProgramTemplate[];
  saveStatus: 'loading' | 'saved' | 'error';
  onChange: (session: WorkoutSession) => void;
  onFinish: () => void;
  onSelectProgram: (program: ProgramTemplate) => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [pendingProgram, setPendingProgram] = useState<ProgramTemplate | null>(null);
  const [restSeconds, setRestSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const totalSets = session.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
  const volume = useMemo(() => session.exercises.flatMap(exercise => exercise.sets).reduce((total, set) => total + set.loadKg * set.repetitions, 0), [session]);
  const workoutPrograms = programs.filter(program => isProgramCode(program.name));

  useEffect(() => {
    if (!timerRunning) return;
    const timer = setInterval(() => setRestSeconds(value => value + 1), 1000);
    return () => clearInterval(timer);
  }, [timerRunning]);

  function requestProgram(program: ProgramTemplate) {
    if (program.id === session.programId || program.name === session.name) return;
    if (totalSets > 0) setPendingProgram(program);
    else onSelectProgram(program);
  }

  function updateBlock(id: string, block: ExerciseBlock) {
    const oldCount = session.exercises.find(item => item.id === id)?.sets.length ?? 0;
    onChange({ ...session, exercises: session.exercises.map(item => item.id === id ? block : item) });
    if (block.sets.length > oldCount) {
      setRestSeconds(0);
      setTimerRunning(true);
    }
  }

  function addExercise(item: typeof exerciseLibrary[number]) {
    const now = Date.now();
    onChange({
      ...session,
      exercises: [...session.exercises, {
        id: 'block-' + now,
        exerciseId: item.id,
        exerciseName: item.name,
        targetSets: 0,
        targetRepRange: [0, 0],
        targetRirRange: [0, 0],
        targetRestSeconds: item.rest,
        setPrescriptions: [],
        sets: [],
      }],
    });
    setAddOpen(false);
  }

  return (
    <>
      <ScrollView contentContainerStyle={commonStyles.screen} showsVerticalScrollIndicator={false}>
        <View style={styles.selector}>
          <View style={commonStyles.between}>
            <View><Text style={styles.selectorLabel}>TREINO DE HOJE</Text><Text style={styles.selectorTitle}>Escolha A1–B4</Text></View>
            {session.cycleNumber ? <View style={styles.cycleBadge}><Text style={styles.cycleText}>CICLO {session.cycleNumber}</Text></View> : null}
          </View>
          <View style={styles.programChoices}>
            {workoutPrograms.map(program => (
              <Pressable key={program.id} style={[styles.programChoice, session.name === program.name && styles.programChoiceSelected]} onPress={() => requestProgram(program)}>
                <Text style={[styles.programChoiceText, session.name === program.name && styles.programChoiceTextSelected]}>{program.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={commonStyles.between}>
          <ScreenTitle eyebrow="SESSÃO EM ANDAMENTO" title={session.name} subtitle={session.exercises.length + ' exercícios · ' + totalSets + ' sets registrados'} />
          <View style={styles.live}><View style={styles.dot} /><Text style={styles.liveText}>LIVE</Text></View>
        </View>
        <Text style={[styles.save, saveStatus === 'error' && { color: colors.danger }]}>{saveStatus === 'saved' ? '● Salvo neste dispositivo' : saveStatus === 'error' ? 'Falha ao salvar' : 'Salvando…'}</Text>

        <View style={styles.metrics}>
          <View><Text style={styles.metricValue}>{totalSets}</Text><Text style={styles.metricLabel}>SETS</Text></View>
          <View><Text style={styles.metricValue}>{volume.toLocaleString('pt-BR')}</Text><Text style={styles.metricLabel}>KG VOLUME</Text></View>
          <View><Text style={styles.metricValue}>{formatTimer(restSeconds)}</Text><Text style={styles.metricLabel}>DESCANSO</Text></View>
        </View>

        {timerRunning || restSeconds > 0 ? (
          <View style={styles.timer}>
            <View><Text style={styles.next}>DESCANSO</Text><Text style={styles.timerValue}>{formatTimer(restSeconds)}</Text></View>
            <View style={styles.chips}>
              <Chip label={timerRunning ? 'Pausar' : 'Retomar'} onPress={() => setTimerRunning(value => !value)} />
              <Chip label="+30s" onPress={() => setRestSeconds(value => value + 30)} />
              <Chip label="Zerar" onPress={() => { setRestSeconds(0); setTimerRunning(false); }} />
            </View>
          </View>
        ) : null}

        {session.exercises.map((block, index) => (
          <ExerciseCard key={block.id} block={block} index={index} onChange={next => updateBlock(block.id, next)} onRemove={() => onChange({ ...session, exercises: session.exercises.filter(item => item.id !== block.id) })} />
        ))}
        <ActionButton label="+ ADICIONAR EXERCÍCIO" tone="secondary" onPress={() => setAddOpen(true)} />
        <ActionButton label="Finalizar treino" tone="danger" disabled={totalSets === 0} onPress={() => setFinishOpen(true)} />
      </ScrollView>

      <ModalShell visible={Boolean(pendingProgram)} title="Trocar treino em andamento?" onClose={() => setPendingProgram(null)}>
        <Text style={commonStyles.muted}>Você já registrou {totalSets} sets. Trocar agora substituirá esta sessão ativa; os treinos finalizados no histórico não serão afetados.</Text>
        <ActionButton label={'TROCAR PARA ' + (pendingProgram?.name ?? '')} tone="danger" onPress={() => { if (pendingProgram) onSelectProgram(pendingProgram); setPendingProgram(null); }} />
        <ActionButton label="Continuar neste treino" tone="secondary" onPress={() => setPendingProgram(null)} />
      </ModalShell>

      <ModalShell visible={addOpen} title="Adicionar exercício" onClose={() => setAddOpen(false)}>
        <ScrollView>
          {exerciseLibrary.map(item => <Pressable key={item.id} style={styles.libraryItem} onPress={() => addExercise(item)}><Text style={commonStyles.cardTitle}>{item.name}</Text><Text style={commonStyles.muted}>Sem prescrição automática.</Text></Pressable>)}
        </ScrollView>
      </ModalShell>

      <ModalShell visible={finishOpen} title="Finalizar treino?" onClose={() => setFinishOpen(false)}>
        <Text style={commonStyles.muted}>{totalSets} sets · {volume.toLocaleString('pt-BR')} kg de volume serão enviados ao histórico.</Text>
        <ActionButton label="FINALIZAR E SALVAR" onPress={() => { setFinishOpen(false); onFinish(); }} />
        <ActionButton label="Continuar treinando" tone="secondary" onPress={() => setFinishOpen(false)} />
      </ModalShell>
    </>
  );
}

const styles = StyleSheet.create({
  selector: { backgroundColor: colors.card, borderColor: colors.accentBorder, borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 18 },
  selectorLabel: { color: colors.accent, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  selectorTitle: { color: colors.text, fontSize: 17, fontWeight: '800', marginTop: 3 },
  cycleBadge: { backgroundColor: colors.accentSoft, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  cycleText: { color: colors.accent, fontSize: 8, fontWeight: '800' },
  programChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 },
  programChoice: { width: '22.5%', borderColor: colors.border, borderWidth: 1, borderRadius: 9, paddingVertical: 9, alignItems: 'center' },
  programChoiceSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  programChoiceText: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  programChoiceTextSelected: { color: colors.background },
  exerciseCard: { ...commonStyles.card, padding: 15 },
  exerciseHeader: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  number: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.accentSoft, justifyContent: 'center', alignItems: 'center' },
  numberText: { color: colors.accent, fontWeight: '800', fontSize: 11 },
  unprescribed: { color: colors.textDim, fontSize: 11, marginTop: 2 },
  more: { color: colors.muted, padding: 10, letterSpacing: 2 },
  notePreview: { color: colors.textDim, fontSize: 10, fontStyle: 'italic', marginTop: 3 },
  inlineMenu: { backgroundColor: colors.elevated, borderRadius: 10, padding: 8, marginTop: 10 },
  tableHeader: { flexDirection: 'row', marginTop: 16, paddingBottom: 7 },
  column: { flex: 1, color: colors.muted, fontSize: 9, textAlign: 'center' },
  smallColumn: { flex: 0.65, color: colors.muted, fontSize: 9, textAlign: 'center' },
  setRow: { flexDirection: 'row', alignItems: 'center', minHeight: 46, borderTopWidth: 1, borderTopColor: colors.border },
  cell: { flex: 1, color: colors.text, fontSize: 13, textAlign: 'center', fontWeight: '600' },
  cellText: { color: colors.text, textAlign: 'center', fontWeight: '700' },
  smallCell: { flex: 0.65, alignItems: 'center', justifyContent: 'center' },
  techniqueMini: { color: colors.accent, fontSize: 7, textAlign: 'center', marginTop: 2 },
  deleteSet: { color: colors.danger, fontSize: 20 },
  emptySets: { color: colors.textDim, fontSize: 12, paddingVertical: 13, textAlign: 'center', borderTopWidth: 1, borderColor: colors.border },
  nextPrescription: { marginTop: 15 },
  next: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  target: { color: colors.muted, fontSize: 10, marginTop: 4 },
  steppers: { flexDirection: 'row', gap: 7, marginTop: 10 },
  quickWeights: { marginTop: 10 },
  quickWeightsLabel: { color: colors.muted, fontSize: 8, fontWeight: '800', letterSpacing: 0.8, marginBottom: 7 },
  quickWeightsRow: { flexDirection: 'row', gap: 6 },
  quickWeight: { flex: 1, backgroundColor: colors.elevated, borderColor: colors.border, borderWidth: 1, borderRadius: 9, paddingVertical: 9, alignItems: 'center' },
  quickWeightText: { color: colors.accent, fontSize: 10, fontWeight: '800' },
  quickWeightReduce: { borderColor: '#6F3232', backgroundColor: '#261515' },
  quickWeightReduceText: { color: colors.danger, fontSize: 10, fontWeight: '800' },
  addWeightLabel: { marginTop: 10 },
  chips: { flexDirection: 'row', gap: 7, flexWrap: 'wrap', alignItems: 'center', marginTop: 8, marginBottom: 10 },
  details: { backgroundColor: colors.elevated, borderRadius: 11, padding: 12, marginTop: 10 },
  detailTitle: { color: colors.text, fontSize: 11, fontWeight: '700', marginTop: 12 },
  notes: { minHeight: 90, color: colors.text, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 10, padding: 11, marginTop: 8, textAlignVertical: 'top' },
  live: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 7 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.danger },
  liveText: { color: colors.text, fontSize: 9, fontWeight: '800' },
  save: { color: colors.success, fontSize: 10, marginTop: 3 },
  metrics: { flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, paddingVertical: 17, marginTop: 20 },
  metricValue: { color: colors.text, fontWeight: '800', fontSize: 18, textAlign: 'center' },
  metricLabel: { color: colors.muted, fontSize: 9, textAlign: 'center', marginTop: 3 },
  timer: { backgroundColor: colors.accentSoft, borderColor: colors.accentBorder, borderWidth: 1, borderRadius: 12, padding: 13, marginTop: 14 },
  timerValue: { color: colors.text, fontSize: 22, fontWeight: '800', marginTop: 2 },
  libraryItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
});
