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
      <ScreenTitle eyebrow="PLANEJAMENTO" title="Treinos personalizados" subtitle="Suas quatro variações Upper e Lower" />
      <ActionButton label="+ CRIAR A PARTIR DO TREINO ATUAL" onPress={onCreate} />
      {programs.map(program => (
        <View key={program.id} style={commonStyles.card}>
          <View style={commonStyles.between}>
            <View style={{ flex: 1 }}>
              <View style={styles.titleRow}>
                <Text style={commonStyles.cardTitle}>{program.name}</Text>
                {program.split ? (
                  <View style={[styles.splitBadge, program.split === 'Lower' && styles.lowerBadge]}>
                    <Text style={styles.splitText}>{program.split}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={commonStyles.muted}>{program.description}</Text>
            </View>
            <View style={styles.badge}><Text style={styles.badgeText}>{program.exercises.length}</Text></View>
          </View>
          <View style={styles.list}>
            {program.exercises.map((item, index) => (
              <Text key={item.exerciseId + index} style={styles.exercise}>
                {index + 1}. {item.exerciseName} · {item.targetSets}×{item.targetRepRange[0]}–{item.targetRepRange[1]}
              </Text>
            ))}
          </View>
          <ActionButton label="INICIAR ESTE TREINO" onPress={() => onStart(program)} />
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
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  splitBadge: { backgroundColor: '#163A35', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  lowerBadge: { backgroundColor: '#332A18' },
  splitText: { color: colors.accent, fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  badge: { width: 35, height: 35, borderRadius: 18, backgroundColor: colors.accentSoft, justifyContent: 'center', alignItems: 'center' },
  badgeText: { color: colors.accent, fontWeight: '800' },
  list: { marginTop: 12, backgroundColor: colors.elevated, borderRadius: 10, padding: 10 },
  exercise: { color: colors.muted, fontSize: 11, paddingVertical: 4 },
  actions: { flexDirection: 'row', gap: 8 },
});
