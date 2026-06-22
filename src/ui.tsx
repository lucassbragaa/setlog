import type { PropsWithChildren } from 'react';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { daysInMonth, isoWithLocalDate, localDateParts } from './data/sessionDates';
import { colors } from './theme';

export function ActionButton({ label, onPress, tone = 'primary', disabled = false }: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, tone === 'primary' && styles.primary, tone === 'danger' && styles.danger, disabled && styles.disabled]}
    >
      <Text style={[styles.buttonText, tone === 'primary' && styles.primaryText, tone === 'danger' && styles.dangerText]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({ label, selected = false, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export function Stepper({ label, value, suffix = '', step = 1, min = 0, max = 999, onChange }: {
  label: string; value: number; suffix?: string; step?: number; min?: number; max?: number; onChange: (value: number) => void;
}) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepLabel}>{label}</Text>
      <View style={styles.stepRow}>
        <Pressable onPress={() => onChange(Math.max(min, value - step))}><Text style={styles.stepAction}>−</Text></Pressable>
        <Text style={styles.stepValue}>{value}{suffix}</Text>
        <Pressable onPress={() => onChange(Math.min(max, value + step))}><Text style={styles.stepAction}>+</Text></Pressable>
      </View>
    </View>
  );
}

export function ScreenTitle({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <View style={styles.titleBlock}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function ModalShell({ visible, title, onClose, children }: PropsWithChildren<{ visible: boolean; title: string; onClose: () => void }>) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <Pressable onPress={onClose}><Text style={styles.close}>×</Text></Pressable>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}


export function DateEditor({ value, onChange, label = 'DATA DO TREINO' }: {
  value: string;
  onChange: (iso: string) => void;
  label?: string;
}) {
  const initial = localDateParts(value);
  const [visible, setVisible] = useState(false);
  const [day, setDay] = useState(initial.day);
  const [month, setMonth] = useState(initial.month);
  const [year, setYear] = useState(initial.year);

  function open() {
    const current = localDateParts(value);
    setDay(current.day);
    setMonth(current.month);
    setYear(current.year);
    setVisible(true);
  }

  function chooseRelativeDate(daysAgo: number) {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    setDay(date.getDate());
    setMonth(date.getMonth() + 1);
    setYear(date.getFullYear());
  }

  function save() {
    onChange(isoWithLocalDate(value, year, month, day));
    setVisible(false);
  }

  return (
    <>
      <Pressable style={styles.dateButton} onPress={open}>
        <View>
          <Text style={styles.dateLabel}>{label}</Text>
          <Text style={styles.dateValue}>{new Date(value).toLocaleDateString('pt-BR')}</Text>
        </View>
        <Text style={styles.dateEdit}>ALTERAR</Text>
      </Pressable>
      <ModalShell visible={visible} title="Alterar data do treino" onClose={() => setVisible(false)}>
        <Text style={styles.dateHelp}>O horário e os intervalos do treino serão preservados.</Text>
        <View style={styles.dateShortcuts}>
          <Chip label="Hoje" onPress={() => chooseRelativeDate(0)} />
          <Chip label="Ontem" onPress={() => chooseRelativeDate(1)} />
        </View>
        <View style={styles.dateSteppers}>
          <Stepper label="DIA" value={Math.min(day, daysInMonth(year, month))} min={1} max={daysInMonth(year, month)} onChange={setDay} />
          <Stepper label="MÊS" value={month} min={1} max={12} onChange={setMonth} />
          <Stepper label="ANO" value={year} min={2000} max={new Date().getFullYear() + 1} onChange={setYear} />
        </View>
        <ActionButton label="SALVAR DATA" onPress={save} />
      </ModalShell>
    </>
  );
}

export const commonStyles = StyleSheet.create({
  screen: { padding: 20, paddingTop: 24, paddingBottom: 125 },
  card: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 16, marginTop: 14 },
  cardTitle: { color: colors.text, fontWeight: '800', fontSize: 17 },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
});

const styles = StyleSheet.create({
  button: { borderWidth: 1, borderColor: colors.border, borderRadius: 11, paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center', marginTop: 10 },
  primary: { backgroundColor: colors.accent, borderColor: colors.accent },
  danger: { borderColor: '#6F3232', backgroundColor: '#261515' },
  disabled: { opacity: 0.4 },
  buttonText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  primaryText: { color: colors.background },
  dangerText: { color: colors.danger },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 18, paddingHorizontal: 11, paddingVertical: 7 },
  chipSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  chipText: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  chipTextSelected: { color: colors.accent },
  stepper: { flex: 1, backgroundColor: colors.elevated, borderRadius: 10, padding: 9 },
  stepLabel: { color: colors.muted, fontSize: 8, fontWeight: '700', textAlign: 'center' },
  stepRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 7 },
  stepAction: { color: colors.muted, fontSize: 20, paddingHorizontal: 5 },
  stepValue: { color: colors.text, fontWeight: '800', fontSize: 14 },
  titleBlock: { marginBottom: 8 },
  eyebrow: { color: colors.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1.4, marginBottom: 6 },
  title: { color: colors.text, fontSize: 29, lineHeight: 34, fontWeight: '800' },
  subtitle: { color: colors.muted, marginTop: 5, fontSize: 14 },
  backdrop: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'flex-end' },
  modal: { maxHeight: '82%', backgroundColor: colors.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, borderColor: colors.border, borderWidth: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: '800' },
  close: { color: colors.muted, fontSize: 30, paddingHorizontal: 8 },
  dateButton: { minHeight: 58, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, backgroundColor: colors.elevated },
  dateLabel: { color: colors.muted, fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  dateValue: { color: colors.text, fontSize: 16, fontWeight: '800', marginTop: 4 },
  dateEdit: { color: colors.accent, fontSize: 9, fontWeight: '800' },
  dateHelp: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  dateShortcuts: { flexDirection: 'row', gap: 8, marginTop: 12 },
  dateSteppers: { flexDirection: 'row', gap: 8, marginTop: 12 },
});
