import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { PRBadge } from '../components/PRBadge';
import { exerciseLibrary } from '../data/appDefaults';
import { isProgramCode } from '../data/cycles';
import { matchesMuscle, muscleLabel, muscleOrder } from '../data/exerciseTaxonomy';
import { computePRs, lastSessionSetsForExercise, normalizeExerciseKey } from '../data/analytics';
import { moveSessionToStartedAt, nowOnLocalDate } from '../data/sessionDates';
import { estimated1Rm, setVolumeKg } from '../data/setMetrics';
import { configForTechnique, prescriptionSummary, prescriptionsFor, techniqueLabel, techniqueOptions, techniqueProfile } from '../data/techniques';
import { colors } from '../theme';
import type { ExerciseBlock, LoggedSet, MuscleGroup, ProgramTemplate, RangeOfMotion, SetPrescription, SetType, TechniqueConfig, WorkoutSession } from '../types/training';
import { ActionButton, Chip, commonStyles, DateEditor, ModalShell, ScreenTitle, Stepper } from '../ui';

function formatTimer(seconds: number) {
  return Math.floor(seconds / 60).toString().padStart(2, '0') + ':' + (seconds % 60).toString().padStart(2, '0');
}
function buildSegments(type: SetType, primaryReps: number, prescription?: SetPrescription): number[] {
  const config = configForTechnique(type, prescription?.techniqueConfig);
  const profile = techniqueProfile(type);
  const blocks = Math.max(1, config?.blocks ?? 1);
  if (profile.mode === 'single' || blocks === 1) return [primaryReps];
  const secondary = config?.secondaryRepRange?.[1] ?? primaryReps;
  return Array.from({ length: blocks }, (_, index) => index === 0 ? primaryReps : secondary);
}

function techniqueExecutionSummary(set: LoggedSet): string | null {
  const details = set.techniqueDetails;
  if (!details) return null;
  const parts: string[] = [];
  if (details.segmentRepetitions.length > 1) parts.push(details.segmentRepetitions.join('+') + ' reps');
  if (details.intraSetRestSeconds !== undefined) parts.push(details.intraSetRestSeconds + 's');
  if (details.loadDropPercent !== undefined) parts.push('−' + details.loadDropPercent + '%');
  if (details.breathsBetweenBlocks !== undefined) parts.push(details.breathsBetweenBlocks + ' resp.');
  if (details.durationSeconds !== undefined) parts.push(formatTimer(details.durationSeconds));
  return parts.length ? parts.join(' · ') : null;
}

function setSegments(set: LoggedSet): number[] {
  return set.techniqueDetails?.segmentRepetitions?.length ? set.techniqueDetails.segmentRepetitions : [set.repetitions];
}

function segmentLabel(set: LoggedSet) {
  const segments = setSegments(set);
  return segments.length > 1 ? segments.join('+') : String(segments[0] ?? set.repetitions);
}

function compactSet(set: LoggedSet) {
  const segments = setSegments(set);
  const totalLabel = segments.length > 1 ? ' (' + set.repetitions + ')' : '';
  return set.loadKg + 'kg x ' + segmentLabel(set) + totalLabel + (set.rir !== undefined ? ' @' + set.rir : '');
}

function previousSetsSummary(sets: LoggedSet[]) {
  if (sets.length === 0) return '';
  return sets.slice(0, 4).map(compactSet).join(' - ') + (sets.length > 4 ? ' +' + (sets.length - 4) : '');
}

function previousForSet(sets: LoggedSet[], index: number) {
  return sets[index] ? compactSet(sets[index]) : '-';
}

function previousBlocksForSet(set?: LoggedSet) {
  if (!set) return [];
  return setSegments(set).map((repetitions, index) => ({
    label: index === 0 ? 'B1' : 'B' + (index + 1),
    repetitions,
  }));
}

function TechniqueExecutionInputs({ type, config, segments, durationSeconds, onConfigChange, onSegmentsChange, onDurationChange }: {
  type: SetType;
  config?: TechniqueConfig;
  segments: number[];
  durationSeconds: number;
  onConfigChange: (next: TechniqueConfig | undefined) => void;
  onSegmentsChange: (next: number[]) => void;
  onDurationChange: (next: number) => void;
}) {
  const profile = techniqueProfile(type);
  const hasMultipleBlocks = segments.length > 1;

  function updateSegment(index: number, value: number) {
    onSegmentsChange(segments.map((item, itemIndex) => itemIndex === index ? value : item));
  }

  function updateConfig(patch: Partial<TechniqueConfig>) {
    onConfigChange({ ...config, ...patch });
  }

  if (!hasMultipleBlocks && !profile.showDuration && config?.breathsBetweenBlocks === undefined) return null;

  return (
    <View style={styles.techniqueExecution}>
      <Text style={styles.techniqueHelp}>{profile.explanation}</Text>
      {hasMultipleBlocks ? (
        <>
          <Text style={styles.quickWeightsLabel}>REPETIÇÕES POR BLOCO</Text>
          <View style={styles.segmentGrid}>
            {segments.map((value, index) => {
              const label = index === 0
                ? profile.primaryRepsLabel
                : profile.mode === 'drop' ? 'QUEDA ' + index : 'BLOCO ' + (index + 1);
              return (
                <View key={index} style={styles.segmentItem}>
                  <Stepper label={label} value={value} max={100} onChange={next => updateSegment(index, next)} />
                </View>
              );
            })}
          </View>
        </>
      ) : null}
      <View style={styles.steppers}>
        {config?.intraSetRestSeconds !== undefined ? (
          <Stepper label="PAUSA INTERNA" value={config.intraSetRestSeconds} suffix=" s" min={0} max={120} step={5} onChange={value => updateConfig({ intraSetRestSeconds: value })} />
        ) : null}
        {config?.loadDropPercent !== undefined ? (
          <Stepper label="REDUÇÃO / QUEDA" value={config.loadDropPercent} suffix="%" min={0} max={80} step={5} onChange={value => updateConfig({ loadDropPercent: value })} />
        ) : null}
        {config?.breathsBetweenBlocks !== undefined ? (
          <Stepper label="RESPIRAÇÕES" value={config.breathsBetweenBlocks} min={1} max={20} onChange={value => updateConfig({ breathsBetweenBlocks: value })} />
        ) : null}
        {profile.showDuration ? (
          <Stepper label="DURAÇÃO" value={durationSeconds} suffix=" s" min={0} max={600} step={5} onChange={onDurationChange} />
        ) : null}
      </View>
    </View>
  );
}


function ExerciseCard({ block, index, sessionStartedAt, previousSets, bestHistoricalE1rm, expanded, onToggle, onChange, onRemove }: {
  block: ExerciseBlock;
  sessionStartedAt: string;
  index: number;
  previousSets: LoggedSet[];
  bestHistoricalE1rm: number;
  expanded: boolean;
  onToggle: () => void;
  onChange: (block: ExerciseBlock) => void;
  onRemove: () => void;
}) {
  const last = block.sets[block.sets.length - 1];
  const prescriptions = prescriptionsFor(block);
  const nextPrescription = prescriptions[block.sets.length];
  const previousNextSet = previousSets[block.sets.length];
  const previousNextSegments = previousNextSet ? setSegments(previousNextSet) : [];
  const [weight, setWeight] = useState(last?.loadKg ?? previousNextSet?.loadKg ?? 0);
  const [reps, setReps] = useState(nextPrescription?.repRange[1] ?? previousNextSegments[0] ?? last?.repetitions ?? 0);
  const [rir, setRir] = useState(nextPrescription?.rirRange[1] ?? last?.rir ?? 0);
  const [type, setType] = useState<SetType>(nextPrescription?.technique ?? 'working');
  const [techniqueConfig, setTechniqueConfig] = useState<TechniqueConfig | undefined>(() => configForTechnique(nextPrescription?.technique ?? 'working', nextPrescription?.techniqueConfig));
  const [segmentReps, setSegmentReps] = useState<number[]>(() => nextPrescription
    ? buildSegments(nextPrescription.technique, nextPrescription.repRange[1], nextPrescription)
    : previousNextSegments.length ? previousNextSegments : buildSegments('working', last?.repetitions ?? 0));
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [details, setDetails] = useState(false);
  const [menu, setMenu] = useState(false);
  const [rom, setRom] = useState<RangeOfMotion>('full');
  const [quality, setQuality] = useState(4);
  const [pain, setPain] = useState(0);
  const [prVisible, setPrVisible] = useState(false);

  useEffect(() => {
    if (!nextPrescription) {
      if (previousNextSet) {
        const previousSegments = setSegments(previousNextSet);
        setWeight(previousNextSet.loadKg);
        setReps(previousSegments[0] ?? previousNextSet.repetitions);
        setRir(previousNextSet.rir ?? 0);
        setSegmentReps(previousSegments);
      }
      return;
    }
    setReps(nextPrescription.repRange[1]);
    setRir(nextPrescription.rirRange[1]);
    setType(nextPrescription.technique);
    setTechniqueConfig(configForTechnique(nextPrescription.technique, nextPrescription.techniqueConfig));
    setSegmentReps(buildSegments(nextPrescription.technique, nextPrescription.repRange[1], nextPrescription));
    setDurationSeconds(0);
  }, [
    block.sets.length,
    nextPrescription?.repRange[0],
    nextPrescription?.repRange[1],
    nextPrescription?.rirRange[0],
    nextPrescription?.rirRange[1],
    nextPrescription?.technique,
    nextPrescription?.techniqueConfig,
    previousNextSet?.id,
  ]);

  function logSet() {
    const profile = techniqueProfile(type);
    const actualSegments = profile.mode === 'single' || (techniqueConfig?.blocks ?? 1) === 1 ? [reps] : segmentReps;
    const totalRepetitions = actualSegments.reduce((total, value) => total + value, 0);
    const set: LoggedSet = {
      id: 'set-' + Date.now() + '-' + block.id,
      order: block.sets.length + 1,
      type,
      loadKg: weight,
      repetitions: totalRepetitions,
      rir,
      previous: previousNextSet ? {
        source: 'any-workout',
        workoutId: 'previous',
        workoutName: 'Anterior',
        completedAt: previousNextSet.completedAt,
        loadKg: previousNextSet.loadKg,
        repetitions: previousNextSet.repetitions,
        segmentRepetitions: setSegments(previousNextSet),
        rir: previousNextSet.rir,
      } : undefined,
      completedAt: nowOnLocalDate(sessionStartedAt),
      rangeOfMotion: rom,
      techniqueQuality: quality as 1 | 2 | 3 | 4 | 5,
      painScore: pain,
      techniqueDetails: {
        segmentRepetitions: actualSegments,
        intraSetRestSeconds: techniqueConfig?.intraSetRestSeconds,
        loadDropPercent: techniqueConfig?.loadDropPercent,
        breathsBetweenBlocks: techniqueConfig?.breathsBetweenBlocks,
        durationSeconds: techniqueProfile(type).showDuration ? durationSeconds : undefined,
      },
    };
    if (bestHistoricalE1rm > 0 && estimated1Rm(set) > bestHistoricalE1rm) setPrVisible(true);
    onChange({ ...block, sets: [...block.sets, set] });
  }

  return (
    <View style={styles.exerciseCard}>
      <View style={styles.exerciseTop}>
        <Pressable style={styles.exerciseHeader} onPress={onToggle}>
          <View style={styles.number}><Text style={styles.numberText}>{String(index + 1).padStart(2, '0')}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.exerciseCardTitle}>{block.exerciseName}</Text>
            <Text style={prescriptions.length ? commonStyles.muted : styles.unprescribed}>
              {prescriptions.length ? prescriptions.map(item => techniqueLabel(item.technique)).join(' / ') : 'Sem prescricao definida'}
            </Text>
            {block.notes ? <Text style={styles.notePreview}>Obs.: {block.notes}</Text> : null}
            <PRBadge visible={prVisible} onDone={() => setPrVisible(false)} />
          </View>
        </Pressable>
        <Pressable onPress={() => setMenu(value => !value)}><Text style={styles.more}>...</Text></Pressable>
      </View>

      {menu && (
        <View style={styles.inlineMenu}>
          <ActionButton label="Limpar sets" tone="secondary" onPress={() => { onChange({ ...block, sets: [] }); setMenu(false); }} />
          <ActionButton label="Remover exercicio" tone="danger" onPress={onRemove} />
        </View>
      )}

      {!expanded ? (
        <Pressable style={styles.compactExerciseFooter} onPress={onToggle}>
          <View style={{ flex: 1 }}>
            <Text style={styles.compactMeta}>{block.sets.length} logged sets</Text>
            <Text numberOfLines={1} style={styles.compactPrevious}>
              {block.sets.length ? 'Last: ' + compactSet(block.sets[block.sets.length - 1]) : previousSetsSummary(previousSets) ? 'Previous: ' + previousSetsSummary(previousSets) : 'Tap to log this exercise'}
            </Text>
          </View>
          <Text style={styles.openExercise}>Open</Text>
        </Pressable>
      ) : null}

      {!expanded ? null : (
      <>

      <View style={styles.setTable}>
        <View style={styles.tableHeader}>
          <Text style={styles.setColumn}>SET</Text>
          <Text style={styles.previousColumn}>ANTERIOR</Text>
          <Text style={styles.column}>KG</Text>
          <Text style={styles.column}>REPS</Text>
          <Text style={styles.column}>RIR</Text>
          <Text style={styles.actionColumn}></Text>
        </View>
        {block.sets.length === 0 ? (
          <Text style={styles.emptySets}>Nenhum set registrado. A coluna anterior aparece quando houver historico deste exercicio.</Text>
        ) : block.sets.map(set => (
          <View style={styles.setRow} key={set.id}>
            <View style={styles.setCell}><Text style={styles.cellText}>{set.order}</Text><Text style={styles.techniqueMini}>{techniqueLabel(set.type)}</Text>{techniqueExecutionSummary(set) ? <Text style={styles.techniqueDetailMini}>{techniqueExecutionSummary(set)}</Text> : null}</View>
            <View style={styles.previousCellBox}>
              <Text style={styles.previousCell}>{previousForSet(previousSets, set.order - 1)}</Text>
              {previousBlocksForSet(previousSets[set.order - 1]).length > 1 ? (
                <View style={styles.previousBlockRow}>
                  {previousBlocksForSet(previousSets[set.order - 1]).map(item => (
                    <Text key={item.label} style={styles.previousBlockPill}>{item.label} {item.repetitions}</Text>
                  ))}
                </View>
              ) : null}
            </View>
            <Text style={styles.cell}>{set.loadKg}</Text>
            <Text style={styles.cell}>{set.repetitions}</Text>
            <Text style={styles.cell}>{set.rir ?? '-'}</Text>
            <Pressable style={styles.actionCell} onPress={() => onChange({ ...block, sets: block.sets.filter(item => item.id !== set.id).map((item, order) => ({ ...item, order: order + 1 })) })}>
              <Text style={styles.deleteSet}>x</Text>
            </Pressable>
          </View>
        ))}
      </View>

      <View style={styles.logPanel}>
        <View style={commonStyles.between}>
          <View style={{ flex: 1 }}>
            <Text style={styles.next}>{nextPrescription ? 'PROXIMO SET PRESCRITO' : 'LOGAR PROXIMO SET'}</Text>
            <Text style={styles.target}>{techniqueLabel(type)} - anterior: {previousForSet(previousSets, block.sets.length)}</Text>
            {previousBlocksForSet(previousNextSet).length > 1 ? (
              <View style={styles.previousBlockRow}>
                {previousBlocksForSet(previousNextSet).map(item => (
                  <Text key={item.label} style={styles.previousBlockPill}>{item.label} {item.repetitions}</Text>
                ))}
              </View>
            ) : null}
            {nextPrescription ? <Text style={styles.target}>Meta {prescriptionSummary(nextPrescription)} - RIR {nextPrescription.rirRange[0]}-{nextPrescription.rirRange[1]}</Text> : null}
          </View>
          <View style={styles.setNumberBadge}><Text style={styles.setNumberText}>{block.sets.length + 1}</Text></View>
        </View>
        <View style={styles.steppers}>
          <Stepper label="KG" value={weight} suffix=" kg" step={0.5} onChange={setWeight} />
          {(techniqueProfile(type).mode === 'single' || (techniqueConfig?.blocks ?? 1) === 1) ? <Stepper label={techniqueProfile(type).primaryRepsLabel} value={reps} max={100} onChange={setReps} /> : null}
          <Stepper label="RIR" value={rir} max={10} onChange={setRir} />
        </View>
      </View>

      <View style={styles.quickWeights}>
        <Text style={styles.quickWeightsLabel}>REDUZIR CARGA</Text>
        <View style={styles.quickWeightsRow}>
          {[2.5, 5, 10, 20].map(amount => (
            <Pressable key={amount} style={[styles.quickWeight, styles.quickWeightReduce]} onPress={() => setWeight(value => Math.max(0, value - amount))}>
              <Text style={styles.quickWeightReduceText}>{'-' + String(amount).replace('.', ',') + ' kg'}</Text>
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

      <TechniqueExecutionInputs
        type={type}
        config={techniqueConfig}
        segments={segmentReps}
        durationSeconds={durationSeconds}
        onConfigChange={setTechniqueConfig}
        onSegmentsChange={setSegmentReps}
        onDurationChange={setDurationSeconds}
      />

      <Text style={styles.detailTitle}>TIPO DE SET</Text>
      <View style={styles.chips}>
        {techniqueOptions.map(option => <Chip key={option.value} label={option.label} selected={type === option.value} onPress={() => { const config = configForTechnique(option.value); setType(option.value); setTechniqueConfig(config); setSegmentReps(buildSegments(option.value, reps, { technique: option.value, repRange: [reps, reps], rirRange: [rir, rir], techniqueConfig: config })); setDurationSeconds(0); }} />)}
      </View>
      <Chip label={details ? '- Fechar detalhes e observacoes' : '+ Detalhes e observacoes'} selected={details} onPress={() => setDetails(value => !value)} />

      {details && (
        <View style={styles.details}>
          <Text style={styles.detailTitle}>Amplitude</Text>
          <View style={styles.chips}>
            <Chip label="Completa" selected={rom === 'full'} onPress={() => setRom('full')} />
            <Chip label="Parcial alongada" selected={rom === 'lengthenedPartial'} onPress={() => setRom('lengthenedPartial')} />
          </View>
          <Text style={styles.detailTitle}>Tecnica de execucao - {quality}/5</Text>
          <Stepper label="QUALIDADE" value={quality} min={1} max={5} onChange={setQuality} />
          <Text style={styles.detailTitle}>Dor - {pain}/10</Text>
          <Stepper label="DOR" value={pain} max={10} onChange={setPain} />
          <Text style={styles.detailTitle}>Observacoes do exercicio</Text>
          <TextInput multiline value={block.notes ?? ''} onChangeText={notes => onChange({ ...block, notes })} placeholder="Execucao, ajustes, equipamento ou qualquer detalhe..." placeholderTextColor={colors.textDim} style={styles.notes} />
        </View>
      )}
      <ActionButton label={'ADICIONAR SET ' + (block.sets.length + 1)} onPress={logSet} />
      </>
      )}
    </View>
  );
}

export function WorkoutScreen({ session, programs, history, saveStatus, onChange, onFinish, onSelectProgram }: {
  session: WorkoutSession;
  programs: ProgramTemplate[];
  history: WorkoutSession[];
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
  const [libraryQuery, setLibraryQuery] = useState('');
  const [libraryMuscle, setLibraryMuscle] = useState<MuscleGroup | 'all'>('all');
  const [activeExerciseId, setActiveExerciseId] = useState(session.exercises[0]?.id ?? '');
  const totalSets = session.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
  const volume = useMemo(() => session.exercises.flatMap(exercise => exercise.sets).reduce((total, set) => total + setVolumeKg(set), 0), [session]);
  const workoutPrograms = programs.filter(program => isProgramCode(program.name));
  const previousSetsMap = useMemo(() => {
    const map = new Map<string, LoggedSet[]>();
    session.exercises.forEach(block => {
      map.set(block.id, lastSessionSetsForExercise(history, normalizeExerciseKey(block), session.id));
    });
    return map;
  }, [history, session.exercises, session.id]);
  const bestE1rmMap = useMemo(() => {
    const prs = computePRs(history);
    const map = new Map<string, number>();
    session.exercises.forEach(block => {
      map.set(block.id, prs.get(normalizeExerciseKey(block))?.bestE1rm ?? 0);
    });
    return map;
  }, [history, session.exercises]);
  const filteredLibrary = useMemo(() => {
    const needle = libraryQuery.trim().toLowerCase();
    return exerciseLibrary.filter(item => {
      const matchesQuery = !needle
        || item.name.toLowerCase().includes(needle)
        || item.template.equipment.toLowerCase().includes(needle)
        || [...item.template.primaryMuscles, ...(item.template.secondaryMuscles ?? [])].map(muscleLabel).join(' ').toLowerCase().includes(needle);
      return matchesQuery && matchesMuscle(item.template, libraryMuscle);
    });
  }, [libraryMuscle, libraryQuery]);
  const libraryGroups = useMemo(() => muscleOrder
    .map(muscle => ({
      muscle,
      items: filteredLibrary.filter(item => item.template.primaryMuscles[0] === muscle),
    }))
    .filter(group => group.items.length > 0), [filteredLibrary]);

  useEffect(() => {
    if (!timerRunning) return;
    const timer = setInterval(() => setRestSeconds(value => value + 1), 1000);
    return () => clearInterval(timer);
  }, [timerRunning]);

  useEffect(() => {
    if (session.exercises.length === 0) {
      setActiveExerciseId('');
      return;
    }
    if (!session.exercises.some(exercise => exercise.id === activeExerciseId)) setActiveExerciseId(session.exercises[0].id);
  }, [activeExerciseId, session.exercises]);

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
    const blockId = 'block-' + now;
    onChange({
      ...session,
      exercises: [...session.exercises, {
        id: blockId,
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
    setActiveExerciseId(blockId);
    setAddOpen(false);
  }

  return (
    <>
      <ScrollView contentContainerStyle={commonStyles.screen} showsVerticalScrollIndicator={false}>
        <View style={styles.appHeader}>
          <Text style={styles.appTitle}>Workout</Text>
          <Text style={styles.appSubtitle}>Start a routine, log each set, compare against previous blocks.</Text>
        </View>
        <Pressable style={styles.startEmptyButton} onPress={() => setAddOpen(true)}>
          <Text style={styles.startEmptyText}>Start Empty Workout</Text>
        </Pressable>
        <Text style={styles.sectionHeading}>Routines</Text>
        <View style={styles.selector}>
          <View style={commonStyles.between}>
            <View><Text style={styles.selectorLabel}>MY ROUTINES</Text><Text style={styles.selectorTitle}>Choose today's workout</Text></View>
            {session.cycleNumber ? <View style={styles.cycleBadge}><Text style={styles.cycleText}>CICLO {session.cycleNumber}</Text></View> : null}
          </View>
          <View style={styles.programCards}>
            {workoutPrograms.map(program => {
              const selected = session.programId === program.id || session.name === program.name;
              const splitLabel = program.split ?? (program.name.startsWith('B') ? 'Lower' : 'Upper');
              return (
                <Pressable key={program.id} style={[styles.programCard, selected && styles.programCardSelected]} onPress={() => requestProgram(program)}>
                  <View style={styles.programCardTop}>
                    <Text style={[styles.programCardCode, selected && styles.programCardCodeSelected]}>{program.name}</Text>
                    <View style={[styles.programSplitBadge, splitLabel === 'Lower' && styles.programSplitBadgeLower, selected && styles.programSplitBadgeSelected]}>
                      <Text style={[styles.programSplitText, selected && styles.programSplitTextSelected]}>{splitLabel}</Text>
                    </View>
                  </View>
                  <Text style={[styles.programCardDetail, selected && styles.programCardDetailSelected]}>{program.exercises.length} exercises</Text>
                  <Text numberOfLines={1} style={[styles.programCardDescription, selected && styles.programCardDescriptionSelected]}>{program.description || 'Custom routine'}</Text>
                  {selected ? <Text style={styles.programCardActive}>ACTIVE</Text> : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.workoutHero}>
          <View style={commonStyles.between}>
            <View style={{ flex: 1 }}>
              <Text style={styles.selectorLabel}>ACTIVE WORKOUT</Text>
              <Text style={styles.workoutTitle}>{session.name}</Text>
              <Text style={styles.workoutSubtitle}>{session.exercises.length} exercises - {totalSets} logged sets</Text>
            </View>
            <View style={styles.live}><View style={styles.dot} /><Text style={styles.liveText}>LIVE</Text></View>
          </View>
          <View style={styles.metrics}>
            <View><Text style={styles.metricValue}>{totalSets}</Text><Text style={styles.metricLabel}>SETS</Text></View>
            <View><Text style={styles.metricValue}>{volume.toLocaleString('pt-BR')}</Text><Text style={styles.metricLabel}>KG</Text></View>
            <View><Text style={styles.metricValue}>{formatTimer(restSeconds)}</Text><Text style={styles.metricLabel}>REST</Text></View>
          </View>
          <Text style={[styles.save, saveStatus === 'error' && { color: colors.danger }]}>{saveStatus === 'saved' ? 'Salvo neste dispositivo' : saveStatus === 'error' ? 'Falha ao salvar' : 'Salvando...'}</Text>
          <DateEditor value={session.startedAt} onChange={startedAt => onChange(moveSessionToStartedAt(session, startedAt))} />
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
            sessionStartedAt={session.startedAt}
            previousSets={previousSetsMap.get(block.id) ?? []}
            bestHistoricalE1rm={bestE1rmMap.get(block.id) ?? 0}
            expanded={activeExerciseId === block.id}
            onToggle={() => setActiveExerciseId(current => current === block.id ? '' : block.id)}
            onChange={next => updateBlock(block.id, next)}
            onRemove={() => onChange({ ...session, exercises: session.exercises.filter(item => item.id !== block.id) })}
          />
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
          <TextInput value={libraryQuery} onChangeText={setLibraryQuery} placeholder="Buscar exercício, músculo ou equipamento" placeholderTextColor={colors.textDim} style={styles.librarySearch} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.libraryFilters}>
            <Chip label="Todos" selected={libraryMuscle === 'all'} onPress={() => setLibraryMuscle('all')} />
            {muscleOrder.map(muscle => (
              <Chip key={muscle} label={muscleLabel(muscle)} selected={libraryMuscle === muscle} onPress={() => setLibraryMuscle(muscle)} />
            ))}
          </ScrollView>
          {libraryGroups.map(group => (
            <View key={group.muscle} style={styles.libraryGroup}>
              <Text style={styles.libraryGroupTitle}>{muscleLabel(group.muscle)}</Text>
              {group.items.map(item => (
                <Pressable key={item.id} style={styles.libraryItem} onPress={() => addExercise(item)}>
                  <Text style={commonStyles.cardTitle}>{item.name}</Text>
                  <Text style={commonStyles.muted}>{muscleLabel(item.template.primaryMuscles[0])} · {item.template.equipment}</Text>
                </Pressable>
              ))}
            </View>
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
  appHeader: { marginTop: 4, marginBottom: 12 },
  appTitle: { color: colors.text, fontSize: 34, fontWeight: '900', letterSpacing: -0.8 },
  appSubtitle: { color: colors.muted, fontSize: 13, fontWeight: '700', marginTop: 4 },
  startEmptyButton: { backgroundColor: colors.accent, borderRadius: 14, minHeight: 54, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  startEmptyText: { color: colors.text, fontSize: 16, fontWeight: '900' },
  sectionHeading: { color: colors.text, fontSize: 20, fontWeight: '900', marginBottom: 10 },
  selector: { backgroundColor: 'transparent', borderColor: colors.border, borderWidth: 0, borderRadius: 0, padding: 0, marginBottom: 18 },
  selectorLabel: { color: colors.accent, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  selectorTitle: { color: colors.text, fontSize: 17, fontWeight: '800', marginTop: 3 },
  cycleBadge: { backgroundColor: colors.accentSoft, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  cycleText: { color: colors.accent, fontSize: 8, fontWeight: '800' },
  programCards: { gap: 8, marginTop: 12 },
  programCard: { width: '100%', minHeight: 84, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 13, backgroundColor: colors.card },
  programCardSelected: { backgroundColor: colors.elevated, borderColor: colors.accent },
  programCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  programCardCode: { color: colors.text, fontSize: 20, fontWeight: '900' },
  programCardCodeSelected: { color: colors.text },
  programSplitBadge: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, backgroundColor: colors.upperBadge },
  programSplitBadgeLower: { backgroundColor: colors.lowerBadge },
  programSplitBadgeSelected: { backgroundColor: colors.card },
  programSplitText: { color: colors.accent, fontSize: 8, fontWeight: '900', textTransform: 'uppercase' },
  programSplitTextSelected: { color: colors.text },
  programCardDetail: { color: colors.muted, fontSize: 11, fontWeight: '800', marginTop: 10 },
  programCardDetailSelected: { color: colors.accent },
  programCardDescription: { color: colors.textDim, fontSize: 9, marginTop: 4 },
  programCardDescriptionSelected: { color: colors.muted },
  programCardActive: { color: colors.accent, fontSize: 8, fontWeight: '900', marginTop: 8, letterSpacing: 1 },
  workoutHero: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 16, marginTop: 10, marginBottom: 4 },
  workoutTitle: { color: colors.text, fontSize: 30, fontWeight: '900', letterSpacing: -0.6, marginTop: 4 },
  workoutSubtitle: { color: colors.muted, fontSize: 12, fontWeight: '700', marginTop: 4 },
  exerciseCard: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 22, padding: 14, marginTop: 14 },
  exerciseTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  exerciseCardTitle: { color: colors.text, fontWeight: '900', fontSize: 18 },
  exerciseHeader: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  number: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.accentSoft, justifyContent: 'center', alignItems: 'center' },
  numberText: { color: colors.accent, fontWeight: '800', fontSize: 11 },
  unprescribed: { color: colors.textDim, fontSize: 11, marginTop: 2 },
  more: { color: colors.muted, padding: 10, letterSpacing: 2 },
  notePreview: { color: colors.textDim, fontSize: 10, fontStyle: 'italic', marginTop: 3 },
  previousBox: { borderLeftWidth: 2, borderLeftColor: colors.border, paddingLeft: 8, marginTop: 8 },
  previousLabel: { color: colors.textDim, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  previousSets: { color: colors.muted, fontSize: 10, fontStyle: 'italic', marginTop: 2 },
  inlineMenu: { backgroundColor: colors.elevated, borderRadius: 10, padding: 8, marginTop: 10 },
  compactExerciseFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.elevated, borderColor: colors.border, borderWidth: 1, borderRadius: 13, padding: 11, marginTop: 12 },
  compactMeta: { color: colors.muted, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.7 },
  compactPrevious: { color: colors.text, fontSize: 12, fontWeight: '800', marginTop: 4 },
  openExercise: { color: colors.accent, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  setTable: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, overflow: 'hidden', marginTop: 14, backgroundColor: colors.background },
  tableHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.elevated, paddingVertical: 8, paddingHorizontal: 7 },
  column: { flex: 0.85, color: colors.muted, fontSize: 9, textAlign: 'center', fontWeight: '900' },
  setColumn: { flex: 0.65, color: colors.muted, fontSize: 9, textAlign: 'center', fontWeight: '900' },
  previousColumn: { flex: 1.55, color: colors.muted, fontSize: 9, textAlign: 'center', fontWeight: '900' },
  actionColumn: { flex: 0.45 },
  smallColumn: { flex: 0.65, color: colors.muted, fontSize: 9, textAlign: 'center' },
  setRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48, borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 7 },
  cell: { flex: 0.85, color: colors.text, fontSize: 13, textAlign: 'center', fontWeight: '800' },
  previousCellBox: { flex: 1.55, alignItems: 'center', justifyContent: 'center', gap: 4 },
  previousCell: { color: colors.muted, fontSize: 10, textAlign: 'center', fontWeight: '800' },
  previousBlockRow: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  previousBlockPill: { overflow: 'hidden', color: colors.text, fontSize: 8, fontWeight: '900', backgroundColor: colors.accentSoft, borderColor: colors.accentBorder, borderWidth: 1, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
  cellText: { color: colors.text, textAlign: 'center', fontWeight: '700' },
  setCell: { flex: 0.65, alignItems: 'center', justifyContent: 'center' },
  actionCell: { flex: 0.45, alignItems: 'center', justifyContent: 'center' },
  smallCell: { flex: 0.65, alignItems: 'center', justifyContent: 'center' },
  techniqueMini: { color: colors.accent, fontSize: 7, textAlign: 'center', marginTop: 2 },
  techniqueDetailMini: { color: colors.textDim, fontSize: 6, textAlign: 'center', marginTop: 2 },
  deleteSet: { color: colors.danger, fontSize: 20 },
  emptySets: { color: colors.textDim, fontSize: 12, paddingVertical: 18, paddingHorizontal: 12, textAlign: 'center', borderTopWidth: 1, borderColor: colors.border, lineHeight: 17 },
  logPanel: { backgroundColor: colors.elevated, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 13, marginTop: 13 },
  setNumberBadge: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  setNumberText: { color: colors.text, fontSize: 16, fontWeight: '900' },
  nextPrescription: { marginTop: 15 },
  next: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  target: { color: colors.muted, fontSize: 10, marginTop: 4, lineHeight: 15 },
  steppers: { flexDirection: 'row', gap: 7, marginTop: 10 },
  techniqueExecution: { backgroundColor: colors.elevated, borderRadius: 12, padding: 10, marginTop: 12 },
  techniqueHelp: { color: colors.textDim, fontSize: 10, lineHeight: 15, marginBottom: 10 },
  segmentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  segmentItem: { width: '31%', minWidth: 92 },
  quickWeights: { marginTop: 10 },
  quickWeightsLabel: { color: colors.muted, fontSize: 8, fontWeight: '800', letterSpacing: 0.8, marginBottom: 7 },
  quickWeightsRow: { flexDirection: 'row', gap: 6 },
  quickWeight: { flex: 1, backgroundColor: colors.elevated, borderColor: colors.border, borderWidth: 1, borderRadius: 9, paddingVertical: 9, alignItems: 'center' },
  quickWeightText: { color: colors.accent, fontSize: 10, fontWeight: '800' },
  quickWeightReduce: { borderColor: colors.dangerBorder, backgroundColor: colors.dangerSoft },
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
  metrics: { flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, paddingVertical: 15, marginTop: 15 },
  metricValue: { color: colors.text, fontWeight: '900', fontSize: 21, textAlign: 'center' },
  metricLabel: { color: colors.muted, fontSize: 9, textAlign: 'center', marginTop: 3, fontWeight: '900' },
  timer: { backgroundColor: colors.accentSoft, borderColor: colors.accentBorder, borderWidth: 1, borderRadius: 12, padding: 13, marginTop: 14 },
  timerValue: { color: colors.text, fontSize: 22, fontWeight: '800', marginTop: 2 },
  librarySearch: { minHeight: 48, color: colors.text, backgroundColor: colors.elevated, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 8 },
  libraryFilters: { gap: 8, paddingVertical: 8, paddingRight: 20 },
  libraryGroup: { marginTop: 12 },
  libraryGroupTitle: { color: colors.text, fontSize: 15, fontWeight: '900', marginBottom: 4 },
  libraryItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
});
