# Handoff — Setlog PWA: Analytics & UI Redesign

**Repositório:** `lucassbragaa/setlog`
**Branch de trabalho:** `claude/pwa-analytics-ui-redesign-65wknd` → mergeado em `main` via PRs #1, #2 (conflito), #3
**Deploy:** GitHub Actions → GitHub Pages em `https://lucassbragaa.github.io/setlog/`

---

## Contexto do projeto

Setlog é um PWA de registro de treino rodando no iPhone via Safari (instalado como app). Stack: Expo SDK 56, React Native 0.85.3, React 19, TypeScript strict, AsyncStorage para persistência offline. Sem backend — tudo local no dispositivo.

---

## O que foi feito (por fase)

### Fase 1 — Analytics: Dados e Lógica

**Problema:** A tela de Análises existente mostrava apenas barras horizontais simples. Não havia rastreamento de PRs, histórico de exercício por tempo, heatmap de frequência, nem dados da sessão anterior durante o treino.

#### `src/types/training.ts` — Tipos novos adicionados ao final do arquivo

```typescript
export type Timeframe = '1m' | '3m' | '6m' | '1y' | 'all';

export interface ExercisePR {
  exerciseKey: string;
  exerciseName: string;
  bestE1rm: number;
  bestWeight: number;
  bestVolume: number;
  achievedAt: string;
}

export interface SeriesPoint {
  date: string;
  value: number;
  label: string;
}

export interface CalendarDay {
  date: string;
  hasWorkout: boolean;
  sessionCount: number;
  totalVolume: number;
}

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  lastWorkoutDate: string | null;
}

export interface WeeklyVolumeSummary {
  weekStart: string;
  weekLabel: string;
  totalVolume: number;
  sessionCount: number;
  setCount: number;
}
```

#### `src/data/analytics.ts` — Arquivo novo (criado do zero)

Centraliza toda a computação analítica. Funções principais:

| Função | O que faz |
|---|---|
| `normalizeExerciseKey(exercise)` | NFD normalize + slug para match cross-sessão (movida de `AnalyticsScreen.tsx`) |
| `filterByTimeframe(sessions, tf)` | Filtra por 1m/3m/6m/1y/all |
| `computePRs(history)` | Retorna `Map<key, ExercisePR>` calculado do histórico completo |
| `exerciseTimeSeries(history, key, metric, tf)` | Série temporal para gráficos (e1rm, volume, weight) |
| `workoutHeatmap(history, weeks)` | Grid `CalendarDay[][]` alinhado em semanas (segunda-feira) |
| `computeStreak(history)` | Streak atual + maior streak em dias |
| `weeklyVolumeSummary(history, weeks)` | Resumo semanal de volume/sets/sessões |
| `lastSessionSetsForExercise(history, key, excludeId)` | Busca sets da sessão anterior do exercício (ghost data) |
| `sessionDurationMinutes(session)` | Duração em minutos (`null` se sem `endedAt`) |

**Nota:** `estimatedE1Rm` usa fórmula de Brzycki: `weight * (1 + reps/30)`. PRs são calculados on-demand — nunca persistidos separadamente.

---

### Fase 2 — Analytics: Componentes UI

#### `src/components/LineChart.tsx` — Criado

Gráfico de linha/área em SVG puro (`react-native-svg`, já incluso no Expo SDK 56 — sem dependência nova). Features:
- Área preenchida com gradiente verde (`accent` → transparente)
- Ponto destacado no último dado
- Labels no eixo X (máx 5, samplea quando >50 pontos)
- Empty state quando `data.length < 2`

**Por que `react-native-svg` e não outra lib?**
- `victory-native` moderno: requer Skia, sem suporte web/PWA
- `victory-native` legado ~36: deprecado, incompatível com React 19
- `recharts`: DOM-only, precisaria de `Platform.OS === 'web'` em todo import

#### `src/components/CalendarHeatmap.tsx` — Criado (depois reescrito)

Grid de frequência de treino. Versão inicial usava `position: 'absolute'` para os labels dos dias e `alignItems: 'center'` na raiz — causava **bug visual no desktop/PWA** (grid pequeno e centralizado na tela).

**Reescrita (Fase 4):** Layout flex com coluna fixa para labels dos dias + `ScrollView` horizontal para o grid de semanas. Sem absolute positioning.

Cores das células:

| Estado | Cor |
|---|---|
| Sem treino | `colors.elevated` |
| 1 treino | `colors.accentBorder` |
| 2+ treinos | `colors.accent` |
| Hoje | border `1.5px accent` |

#### `src/components/PRCard.tsx` — Criado

Card com border `accentBorder`. Exibe: nome do exercício, data, e 3 métricas (e1RM | CARGA | VOLUME) com divisores verticais.

#### `src/components/PRBadge.tsx` — Criado

Badge animado "PR!" usando `Animated.spring` (escala) + `Animated.timing` (opacidade). Auto-dismiss em 3 segundos via `setTimeout` guardado em `useRef` para evitar memory leak.

---

### Fase 2 — Telas Redesenhadas

#### `src/screens/AnalyticsScreen.tsx` — Reescrito completamente

3 abas (`Mode: 'overview' | 'program' | 'exercise'`):

**Geral (OverviewTab):**
- `CalendarHeatmap` 12 semanas
- Grid 2×2 de métricas globais (treinos, volume, streak, exercícios únicos)
- Barras de volume semanal (8 semanas)
- Top 5 exercícios por volume acumulado

**Por treino (ProgramTab):**
- Mantém lógica de ciclos A1-B4 existente
- `LineChart` para volume e e1RM por ciclo
- Grid de métricas com setas de tendência (↑ verde / ↓ vermelho)
- Tabela de exercícios com delta percentual

**Por exercício (ExerciseTab):**
- Seletor de exercício (scroll horizontal)
- `TimeframeSelector`: `[1M] [3M] [6M] [1A] [Tudo]`
- `LineChart` para e1RM e volume ao longo do tempo
- `PRCard` do exercício selecionado
- Tabela de logs históricos

#### `src/screens/HistoryScreen.tsx` — Melhorado

- `CalendarHeatmap` (10 semanas, `cellSize=18`) no topo
- `TextInput` de busca — filtra por nome do treino ou exercício
- Badge de duração (ex: "1h 23min") quando `endedAt` existe
- Barra de volume relativo (3px, fill `accentBorder`) proporcional ao maior treino

#### `src/screens/WorkoutScreen.tsx` — Melhorado

- Prop `history: WorkoutSession[]` adicionada
- `previousSetsMap` (useMemo): mapeia `block.id` → sets da sessão anterior do mesmo exercício
- `prsMap` (useMemo): mapeia `block.id` → melhor e1RM histórico
- Ghost row: linha em itálico `textDim` com dados da sessão anterior abaixo do nome do exercício
- `PRBadge`: aparece 3s quando `estimated1Rm(newSet) > bestHistoricalE1rm`

#### `App.tsx` — `history` prop adicionada ao `WorkoutScreen`

```tsx
<WorkoutScreen
  session={data.activeSession}
  programs={data.programs}
  history={data.history}   // ← novo
  ...
/>
```

---

### Fase 3 — Design System

#### `src/theme.ts` — Tokens adicionados

```typescript
// Cores novas (eliminam hardcoded hex nas telas)
dangerSoft: '#261515',
dangerBorder: '#6F3232',
upperBadge: '#163A35',   // badge UPPER no seletor de treino
lowerBadge: '#332A18',   // badge LOWER no seletor de treino

// Escala de border radius
export const radius = {
  sm: 8, md: 12, lg: 16, xl: 20, full: 999
} as const;

// Escala tipográfica
export const type = {
  xs: 9, sm: 11, md: 13, lg: 16, xl: 20, xxl: 26
} as const;
```

#### `src/ui.tsx` — Componentes polidos

| Componente | O que mudou |
|---|---|
| `ActionButton` | Estado `pressed` com opacity 0.75; usa `radius.md` |
| `Chip` | `radius.full`, `colors.elevated` como bg, `fontWeight: '700'` quando selected |
| `Stepper` | `radius.md`, `type.lg`, símbolos +/− em `colors.accent` |
| `ScreenTitle` | `type.xxl` (26px) para título |
| `ModalShell` | `animationType="slide"`, drag handle (View 36×4), `backdropDismiss` Pressable, botão fechar circular, cantos `radius.xl` |

#### `src/screens/WorkoutScreen.tsx` — Tokens substituídos

Todos os hex hardcoded substituídos por tokens:

| Antes | Depois |
|---|---|
| `'#163A35'` | `colors.upperBadge` |
| `'#332A18'` | `colors.lowerBadge` |
| `'#0B1110'` | `colors.background` |
| `'#16302A'` | `colors.accentSoft` |
| `'#6F3232'` | `colors.dangerBorder` |
| `'#261515'` | `colors.dangerSoft` |

---

### Fase 4 — Premium Visual

#### `App.tsx` — Ícones SVG na tab bar

Substituição dos caracteres unicode (`⊕ ↻ ≡ ▲ ◈`) por ícones SVG via `react-native-svg`:

| Tab | Ícone |
|---|---|
| Treino | Halter (dumbbell) |
| Ciclos | Setas circulares (refresh) |
| Histórico | Relógio analógico |
| Análises | Barras crescentes |
| Programas | Grade 2×2 |

Estado ativo: ícone e label em `colors.accent`. Estado inativo: `colors.textDim`. Sem wrapper colorido — a cor do ícone já indica o estado.

#### `src/screens/AnalyticsScreen.tsx` — Métricas e barras

| Propriedade | Antes | Depois |
|---|---|---|
| `metricValue fontSize` | 18px | 30px |
| `metricValue fontWeight` | '800' | '900' |
| `metricValue letterSpacing` | — | -0.5 |
| `metricLabel letterSpacing` | — | 0.8 |
| `barTrack/bar height` | 14px | 26px |
| `barTrack/bar borderRadius` | 4 | 13 (pill shape) |
| `grid marginTop` | 2 | 14 |

#### `src/components/CalendarHeatmap.tsx` — Layout reescrito

**Problema original:** `root` com `alignItems: 'center'` + grid de largura fixa (~300px) + labels com `position: 'absolute', left: -18`. No desktop (1440px de largura), o grid ficava centralizado e minúsculo.

**Solução:**

```
<View flexDirection="row">
  <View width={16}>          ← coluna fixa de labels dos dias (S/T/Q...)
  <ScrollView horizontal>
    <View>
      <View flexDirection="row">  ← linha de labels de mês
      <View flexDirection="row">  ← colunas de semanas
    </View>
  </ScrollView>
</View>
```

Sem `position: 'absolute'` em nenhuma parte. Os labels de mês são Views com largura fixa (`cellSize`) que ficam alinhados com as colunas do grid.

---

## Arquitetura de dados

```
App.tsx
├── data: AppData  (AsyncStorage via workoutStorage.ts)
│   ├── activeSession: WorkoutSession
│   ├── history: WorkoutSession[]
│   └── programs: ProgramTemplate[]
│
├── WorkoutScreen ← history (ghost data + PR detection)
├── HistoryScreen ← history (heatmap + busca)
├── AnalyticsScreen ← sessions=history (tudo derivado on-demand)
├── CyclesScreen
└── ProgramsScreen

src/data/analytics.ts
└── Funções puras — recebem history[], retornam dados calculados
    Nada é persistido — tudo computado no render via useMemo
```

---

## Dependência adicionada

```
react-native-svg@15.15.5
```

Instalada via `npm install` (não `npx expo install` — o comando falhou porque o módulo `expo` não estava no PATH do ambiente). A lib já estava disponível no Expo SDK 56 managed workflow; a instalação apenas formalizou no `package.json`.

---

## Todos os arquivos modificados

| Arquivo | Ação | Fase |
|---|---|---|
| `src/types/training.ts` | Tipos novos adicionados | 1 |
| `src/data/analytics.ts` | **Criado** | 1 |
| `src/components/LineChart.tsx` | **Criado** | 2 |
| `src/components/CalendarHeatmap.tsx` | **Criado** + reescrito | 2 + 4 |
| `src/components/PRCard.tsx` | **Criado** | 2 |
| `src/components/PRBadge.tsx` | **Criado** | 2 |
| `src/screens/AnalyticsScreen.tsx` | Reescrito + ajustes visuais | 2 + 4 |
| `src/screens/HistoryScreen.tsx` | Melhorado | 2 |
| `src/screens/WorkoutScreen.tsx` | Melhorado + tokens | 2 + 3 |
| `src/theme.ts` | Tokens `radius`, `type`, novas cores | 3 |
| `src/ui.tsx` | Componentes polidos com tokens | 3 |
| `App.tsx` | `history` prop + SVG icons + tab bar | 2 + 4 |
| `package.json` | `react-native-svg` formalizado | 1 |

---

## Deploy

GitHub Actions em `.github/workflows/deploy-pages.yml` — dispara automaticamente em push na `main`. Pipeline:

1. `npm ci`
2. `npm run typecheck` (tsc --noEmit, zero erros)
3. `npm run build:web` (expo export + prepare-pwa.mjs)
4. `node scripts/prepare-github-pages.mjs`
5. Upload artifact → deploy em GitHub Pages

Tempo médio: ~2-3 minutos após o merge.

---

## Como atualizar o PWA no iPhone após deploy

1. Fechar o app completamente (swipe up para encerrar)
2. Abrir Safari e acessar `https://lucassbragaa.github.io/setlog/`
3. O service worker baixa a nova versão automaticamente
4. Se instalado como PWA, pode ser necessário remover e reinstalar da tela inicial
