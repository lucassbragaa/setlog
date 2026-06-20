import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { exerciseLibrary } from '../data/appDefaults';
import { colors } from '../theme';
import type { ExerciseBlock, LoggedSet, RangeOfMotion, SetType, WorkoutSession } from '../types/training';
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
  const [weight, setWeight] = useState(last?.loadKg ?? (block.exerciseId.includes('bench') ? 100 : 40));
  const [reps, setReps] = useState(last?.repetitions ?? block.targetRepRange[1]);
  const [rir, setRir] = useState(last?.rir ?? block.targetRirRange[1]);
  const [type, setType] = useState<SetType>('working');
  const [details, setDetails] = useState(false);
  const [menu, setMenu] = useState(false);
  const [rom, setRom] = useState<RangeOfMotion>('full');
  const [quality, setQuality] = useState(4);
  const [pain, setPain] = useState(0);

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
            <Text style={commonStyles.muted}>{block.targetSets} × {block.targetRepRange[0]}–{block.targetRepRange[1]} · {block.targetRirRange[0]}–{block.targetRirRange[1]} RIR</Text>
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
          <Text style={styles.smallCell}>{set.order}</Text>
          <Text style={styles.cell}>{set.loadKg} kg</Text>
          <Text style={styles.cell}>{set.repetitions}</Text>
          <Text style={styles.cell}>{set.rir ?? '—'}</Text>
          <Pressable style={styles.smallCell} onPress={() => onChange({ ...block, sets: block.sets.filter(item => item.id !== set.id).map((item, order) => ({ ...item, order: order + 1 })) })}>
            <Text style={styles.deleteSet}>×</Text>
          </Pressable>
        </View>
      ))}

      <Text style={styles.next}>PRÓXIMO SET · {type === 'warmup' ? 'AQUECIMENTO' : 'TRABALHO'}</Text>
      <View style={styles.steppers}>
        <Stepper label="CARGA" value={weight} suffix=" kg" step={2.5} onChange={setWeight} />
        <Stepper label="REPS" value={reps} max={50} onChange={setReps} />
        <Stepper label="RIR" value={rir} max={10} onChange={setRir} />
      </View>
      <View style={styles.chips}>
        <Chip label="Trabalho" selected={type === 'working'} onPress={() => setType('working')} />
        <Chip label="Aquecimento" selected={type === 'warmup'} onPress={() => setType('warmup')} />
        <Chip label={details ? '− Detalhes' : '+ Detalhes'} selected={details} onPress={() => setDetails(value => !value)} />
      </View>

      {details && (
        <View style={styles.details}>
          <Text style={styles.detailTitle}>Amplitude</Text>
          <View style={styles.chips}>
            <Chip label="Completa" selected={rom === 'full'} onPress={() => setRom('full')} />
            <Chip label="Parcial alongada" selected={rom === 'lengthenedPartial'} onPress={() => setRom('lengthenedPartial')} />
          </View>
          <Text style={styles.detailTitle}>Técnica · {quality}/5</Text>
          <Stepper label="QUALIDADE" value={quality} min={1} max={5} onChange={setQuality} />
          <Text style={styles.detailTitle}>Dor · {pain}/10</Text>
          <Stepper label="DOR" value={pain} max={10} onChange={setPain} />
        </View>
      )}
      <ActionButton label={'REGISTRAR SET ' + (block.sets.length + 1)} onPress={logSet} />
    </View>
  );
}

export function WorkoutScreen({ session, saveStatus, onChange, onFinish }: {
  session: WorkoutSession;
  saveStatus: 'loading' | 'saved' | 'error';
  onChange: (session: WorkoutSession) => void;
  onFinish: () => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [restSeconds, setRestSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const totalSets = session.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
  const volume = useMemo(() => session.exercises.flatMap(exercise => exercise.sets).reduce((total, set) => total + set.loadKg * set.repetitions, 0), [session]);

  useEffect(() => {
    if (!timerRunning) return;
    const timer = setInterval(() => setRestSeconds(value => value + 1), 1000);
    return () => clearInterval(timer);
  }, [timerRunning]);

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
        id: 'block-' + now, exerciseId: item.id, exerciseName: item.name, targetSets: item.sets,
        targetRepRange: item.reps, targetRirRange: item.rir, targetRestSeconds: item.rest, sets: [],
      }],
    });
    setAddOpen(false);
  }

  return (
    <>
      <ScrollView contentContainerStyle={commonStyles.screen} showsVerticalScrollIndicator={false}>
        <View style={commonStyles.between}>
          <ScreenTitle eyebrow="SESSÃO EM ANDAMENTO" title={session.name} subtitle={session.exercises.length + ' exercícios · ' + totalSets + ' sets'} />
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
          <ExerciseCard
            key={block.id}
            block={block}
            index={index}
            onChange={next => updateBlock(block.id, next)}
            onRemove={() => onChange({ ...session, exercises: session.exercises.filter(item => item.id !== block.id) })}
          />
        ))}
        <ActionButton label="+ ADICIONAR EXERCÍCIO" tone="secondary" onPress={() => setAddOpen(true)} />
        <ActionButton label="Finalizar treino" tone="danger" disabled={totalSets === 0} onPress={() => setFinishOpen(true)} />
      </ScrollView>

      <ModalShell visible={addOpen} title="Adicionar exercício" onClose={() => setAddOpen(false)}>
        <ScrollView>
          {exerciseLibrary.map(item => (
            <Pressable key={item.id} style={styles.libraryItem} onPress={() => addExercise(item)}>
              <Text style={commonStyles.cardTitle}>{item.name}</Text>
              <Text style={commonStyles.muted}>{item.sets} × {item.reps[0]}–{item.reps[1]} · descanso {Math.round(item.rest / 60)} min</Text>
            </Pressable>
          ))}
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
  exerciseCard: { ...commonStyles.card, padding: 15 },
  exerciseHeader: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  number: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.accentSoft, justifyContent: 'center', alignItems: 'center' },
  numberText: { color: colors.accent, fontWeight: '800', fontSize: 11 },
  more: { color: colors.muted, padding: 10, letterSpacing: 2 },
  inlineMenu: { backgroundColor: colors.elevated, borderRadius: 10, padding: 8, marginTop: 10 },
  tableHeader: { flexDirection: 'row', marginTop: 16, paddingBottom: 7 },
  column: { flex: 1, color: colors.muted, fontSize: 9, textAlign: 'center' },
  smallColumn: { flex: 0.55, color: colors.muted, fontSize: 9, textAlign: 'center' },
  setRow: { flexDirection: 'row', alignItems: 'center', minHeight: 38, borderTopWidth: 1, borderTopColor: colors.border },
  cell: { flex: 1, color: colors.text, fontSize: 13, textAlign: 'center', fontWeight: '600' },
  smallCell: { flex: 0.55, color: colors.text, textAlign: 'center' },
  deleteSet: { color: colors.danger, fontSize: 20 },
  emptySets: { color: colors.textDim, fontSize: 12, paddingVertical: 13, textAlign: 'center', borderTopWidth: 1, borderColor: colors.border },
  next: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginTop: 15 },
  steppers: { flexDirection: 'row', gap: 7, marginTop: 10 },
  chips: { flexDirection: 'row', gap: 7, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 },
  details: { backgroundColor: colors.elevated, borderRadius: 11, padding: 12, marginTop: 10 },
  detailTitle: { color: colors.text, fontSize: 11, fontWeight: '700', marginTop: 9 },
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
