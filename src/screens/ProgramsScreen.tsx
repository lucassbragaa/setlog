import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';
import type { ProgramTemplate } from '../types/training';
import { ActionButton, commonStyles, ScreenTitle } from '../ui';

export function ProgramsScreen({ programs, onStart, onDuplicate, onCreate, onDelete }: {
  programs: ProgramTemplate[];
  onStart: (program: ProgramTemplate) => void;
  onDuplicate: (program: ProgramTemplate) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <ScrollView contentContainerStyle={commonStyles.screen}>
      <ScreenTitle eyebrow="PLANEJAMENTO" title="Programas" subtitle="Templates e prescrições reutilizáveis" />
      <ActionButton label="+ CRIAR A PARTIR DO TREINO ATUAL" onPress={onCreate} />
      {programs.map(program => (
        <View key={program.id} style={commonStyles.card}>
          <View style={commonStyles.between}><View style={{ flex: 1 }}><Text style={commonStyles.cardTitle}>{program.name}</Text><Text style={commonStyles.muted}>{program.description}</Text></View><View style={styles.badge}><Text style={styles.badgeText}>{program.exercises.length}</Text></View></View>
          <View style={styles.list}>{program.exercises.map((exercise, index) => <Text key={exercise.exerciseId + index} style={styles.exercise}>{index + 1}. {exercise.exerciseName} · {exercise.targetSets}×{exercise.targetRepRange[0]}–{exercise.targetRepRange[1]}</Text>)}</View>
          <ActionButton label="INICIAR ESTE PROGRAMA" onPress={() => onStart(program)} />
          <View style={styles.actions}>
            <View style={{ flex: 1 }}><ActionButton label="Duplicar" tone="secondary" onPress={() => onDuplicate(program)} /></View>
            {program.id.startsWith('custom-') ? <View style={{ flex: 1 }}><ActionButton label="Excluir" tone="danger" onPress={() => onDelete(program.id)} /></View> : null}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  badge: { width: 35, height: 35, borderRadius: 18, backgroundColor: colors.accentSoft, justifyContent: 'center', alignItems: 'center' },
  badgeText: { color: colors.accent, fontWeight: '800' },
  list: { marginTop: 12, backgroundColor: colors.elevated, borderRadius: 10, padding: 10 },
  exercise: { color: colors.muted, fontSize: 11, paddingVertical: 4 },
  actions: { flexDirection: 'row', gap: 8 },
});
