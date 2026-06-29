import type { ProgramExercise, SetPrescription, SetType, TechniqueConfig } from '../types/training';

export const techniqueOptions: { value: SetType; label: string }[] = [
  { value: 'working', label: 'Straight set' },
  { value: 'failure', label: 'Failure' },
  { value: 'topSet', label: 'Top set' },
  { value: 'backoff', label: 'Backoff' },
  { value: 'muscleRound', label: 'Muscle round' },
  { value: 'widowmaker', label: 'Widowmaker' },
  { value: 'restPause', label: 'Rest-pause' },
  { value: 'breathingCluster', label: 'Breathing clusters' },
  { value: 'drop', label: 'Drop set' },
  { value: 'myoRep', label: 'Myo-reps' },
  { value: 'approach', label: 'Aproximação' },
  { value: 'warmup', label: 'Aquecimento' },
];

export function techniqueLabel(type: SetType): string {
  return techniqueOptions.find(option => option.value === type)?.label ?? 'Straight set';
}
export type TechniqueMode = 'single' | 'blocks' | 'drop' | 'breathing';

export interface TechniqueProfile {
  mode: TechniqueMode;
  primaryRepsLabel: string;
  secondaryRepsLabel?: string;
  blocksLabel?: string;
  defaultConfig?: TechniqueConfig;
  showDuration?: boolean;
  explanation: string;
}

const single = (primaryRepsLabel: string, explanation: string): TechniqueProfile => ({
  mode: 'single', primaryRepsLabel, explanation,
});

export function techniqueProfile(type: SetType): TechniqueProfile {
  switch (type) {
    case 'muscleRound':
      return {
        mode: 'blocks', primaryRepsLabel: 'REPS POR BLOCO', blocksLabel: 'BLOCOS',
        defaultConfig: { blocks: 6, intraSetRestSeconds: 10 },
        explanation: 'Blocos curtos com a mesma carga e pausas muito breves dentro do set.',
      };
    case 'restPause':
      return {
        mode: 'blocks', primaryRepsLabel: 'REPS INICIAIS', secondaryRepsLabel: 'REPS POR MINI-SET', blocksLabel: 'BLOCOS TOTAIS',
        defaultConfig: { blocks: 3, secondaryRepRange: [0, 0], intraSetRestSeconds: 15 },
        explanation: 'Um bloco inicial próximo da falha seguido de mini-sets com pausas curtas.',
      };
    case 'myoRep':
      return {
        mode: 'blocks', primaryRepsLabel: 'REPS DE ATIVAÇÃO', secondaryRepsLabel: 'REPS POR MINI-SET', blocksLabel: 'BLOCOS TOTAIS',
        defaultConfig: { blocks: 5, secondaryRepRange: [3, 5], intraSetRestSeconds: 15 },
        explanation: 'Set de ativação seguido de mini-sets curtos, separados por pausas breves.',
      };
    case 'drop':
      return {
        mode: 'drop', primaryRepsLabel: 'REPS INICIAIS', secondaryRepsLabel: 'REPS POR QUEDA', blocksLabel: 'ETAPAS TOTAIS',
        defaultConfig: { blocks: 3, secondaryRepRange: [0, 0], intraSetRestSeconds: 0, loadDropPercent: 20 },
        explanation: 'Bloco inicial seguido de uma ou mais quedas de carga, com transição mínima.',
      };
    case 'breathingCluster':
      return {
        mode: 'breathing', primaryRepsLabel: 'REPS POR BLOCO', blocksLabel: 'BLOCOS',
        defaultConfig: { blocks: 5, breathsBetweenBlocks: 5 },
        explanation: 'Repetições agrupadas em blocos, usando respirações profundas entre eles.',
      };
    case 'widowmaker':
      return {
        mode: 'breathing', primaryRepsLabel: 'REPS TOTAIS', showDuration: true,
        defaultConfig: { blocks: 1 },
        explanation: 'Um set longo; as últimas reps podem ser separadas por respirações profundas.',
      };
    case 'topSet': return single('REPS', 'Set mais pesado do exercício, registrado como um bloco contínuo.');
    case 'backoff': return single('REPS', 'Set posterior com carga reduzida, registrado como um bloco contínuo.');
    case 'approach': return single('REPS', 'Set de aproximação para chegar à carga de trabalho.');
    case 'warmup': return single('REPS', 'Set de aquecimento, sem pausa interna prescrita.');
    case 'failure': return single('REPS', 'Set levado ate a falha tecnica ou muscular.');
    default: return single('REPS', 'Set contínuo convencional.');
  }
}

export function configForTechnique(type: SetType, current?: TechniqueConfig): TechniqueConfig | undefined {
  const defaults = techniqueProfile(type).defaultConfig;
  if (!defaults) return undefined;
  return {
    ...defaults,
    ...current,
    secondaryRepRange: current?.secondaryRepRange ?? defaults.secondaryRepRange,
  };
}

export function prescriptionSummary(set: SetPrescription): string {
  const profile = techniqueProfile(set.technique);
  const config = configForTechnique(set.technique, set.techniqueConfig);
  const primary = `${set.repRange[0]}–${set.repRange[1]}`;
  if (profile.mode === 'single' || (profile.mode === 'breathing' && (config?.blocks ?? 1) === 1)) return `${primary} reps`;
  const secondary = config?.secondaryRepRange
    ? ` · demais ${config.secondaryRepRange[0]}–${config.secondaryRepRange[1]}`
    : '';
  const interval = config?.intraSetRestSeconds !== undefined ? ` · ${config.intraSetRestSeconds}s` : '';
  const breaths = config?.breathsBetweenBlocks ? ` · ${config.breathsBetweenBlocks} resp.` : '';
  const drop = config?.loadDropPercent ? ` · −${config.loadDropPercent}%` : '';
  return `${config?.blocks ?? 1} blocos · ${primary}${secondary}${interval}${breaths}${drop}`;
}


export function emptyPrescription(): SetPrescription {
  return { technique: 'working', repRange: [0, 0], rirRange: [0, 0] };
}

export function prescriptionsFor(exercise: ProgramExercise): SetPrescription[] {
  return exercise.setPrescriptions ?? [];
}

export function exerciseWithPrescriptions(
  exercise: ProgramExercise,
  setPrescriptions: SetPrescription[],
): ProgramExercise {
  if (setPrescriptions.length === 0) {
    return {
      ...exercise,
      targetSets: 0,
      targetRepRange: [0, 0],
      targetRirRange: [0, 0],
      setPrescriptions: [],
    };
  }
  const reps = setPrescriptions.flatMap(item => item.repRange);
  const rirs = setPrescriptions.flatMap(item => item.rirRange);
  return {
    ...exercise,
    targetSets: setPrescriptions.length,
    targetRepRange: [Math.min(...reps), Math.max(...reps)],
    targetRirRange: [Math.min(...rirs), Math.max(...rirs)],
    setPrescriptions,
  };
}

export function removeLegacyGuess<T extends ProgramExercise>(exercise: T): T {
  if (exercise.setPrescriptions !== undefined) return exercise;
  return {
    ...exercise,
    targetSets: 0,
    targetRepRange: [0, 0],
    targetRirRange: [0, 0],
    setPrescriptions: [],
  };
}
