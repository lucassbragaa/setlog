import type { PropsWithChildren } from 'react';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { daysInMonth, isoWithLocalDate, localDateParts } from './data/sessionDates';
import { colors, radius, type } from './theme';

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
      style={({ pressed }) => [
        styles.button,
        tone === 'primary' && styles.primary,
        tone === 'danger' && styles.danger,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={[styles.buttonText, tone === 'primary' && styles.primaryText, tone === 'danger' && styles.dangerText]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({ label, selected = false, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}>
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
        <Pressable hitSlop={8} onPress={() => onChange(Math.max(min, value - step))}><Text style={styles.stepAction}>-</Text></Pressable>
        <Text style={styles.stepValue}>{value}{suffix}</Text>
        <Pressable hitSlop={8} onPress={() => onChange(Math.min(max, value + step))}><Text style={styles.stepAction}>+</Text></Pressable>
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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.modal}>
          <View style={styles.handle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <Pressable onPress={onClose} style={styles.closeButton}><Text style={styles.close}>x</Text></Pressable>
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
        <Text style={styles.dateHelp}>O horario e os intervalos do treino serao preservados.</Text>
        <View style={styles.dateShortcuts}>
          <Chip label="Hoje" onPress={() => chooseRelativeDate(0)} />
          <Chip label="Ontem" onPress={() => chooseRelativeDate(1)} />
        </View>
        <View style={styles.dateSteppers}>
          <Stepper label="DIA" value={Math.min(day, daysInMonth(year, month))} min={1} max={daysInMonth(year, month)} onChange={setDay} />
          <Stepper label="MES" value={month} min={1} max={12} onChange={setMonth} />
          <Stepper label="ANO" value={year} min={2000} max={new Date().getFullYear() + 1} onChange={setYear} />
        </View>
        <ActionButton label="SALVAR DATA" onPress={save} />
      </ModalShell>
    </>
  );
}

export const commonStyles = StyleSheet.create({
  screen: { padding: 20, paddingTop: 24, paddingBottom: 125 },
  card: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: 16, marginTop: 14 },
  cardTitle: { color: colors.text, fontWeight: '900', fontSize: type.lg },
  muted: { color: colors.muted, fontSize: type.sm, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
});

const styles = StyleSheet.create({
  pressed: { opacity: 0.72 },
  button: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 13, paddingHorizontal: 14, alignItems: 'center', marginTop: 10, backgroundColor: colors.elevated },
  primary: { backgroundColor: colors.accent, borderColor: colors.accent },
  danger: { borderColor: colors.dangerBorder, backgroundColor: colors.dangerSoft },
  disabled: { opacity: 0.4 },
  buttonText: { color: colors.text, fontSize: type.sm, fontWeight: '900', letterSpacing: 0.8 },
  primaryText: { color: colors.background },
  dangerText: { color: colors.danger },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.elevated },
  chipSelected: { borderColor: colors.accent, backgroundColor: colors.accent },
  chipText: { color: colors.muted, fontSize: type.sm, fontWeight: '700' },
  chipTextSelected: { color: colors.background, fontWeight: '900' },
  stepper: { flex: 1, backgroundColor: colors.elevated, borderRadius: radius.md, padding: 10, borderWidth: 1, borderColor: colors.border },
  stepLabel: { color: colors.muted, fontSize: type.xs, fontWeight: '900', textAlign: 'center', letterSpacing: 0.8 },
  stepRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  stepAction: { color: colors.accent, fontSize: 24, fontWeight: '700', paddingHorizontal: 6 },
  stepValue: { color: colors.text, fontWeight: '900', fontSize: type.lg },
  titleBlock: { marginBottom: 8 },
  eyebrow: { color: colors.muted, fontSize: type.sm, fontWeight: '900', letterSpacing: 1.4, marginBottom: 6 },
  title: { color: colors.text, fontSize: type.xxl, lineHeight: 32, fontWeight: '900', letterSpacing: -0.4 },
  subtitle: { color: colors.muted, marginTop: 5, fontSize: type.md, lineHeight: 19 },
  backdrop: { flex: 1, backgroundColor: '#000000CC', justifyContent: 'flex-end' },
  modal: { maxHeight: '84%', backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: 20, borderColor: colors.border, borderWidth: 1 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 14 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { color: colors.text, fontSize: type.xl, fontWeight: '900' },
  closeButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.elevated, borderColor: colors.border, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  close: { color: colors.muted, fontSize: 18, fontWeight: '900' },
  dateButton: { minHeight: 58, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 13, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, backgroundColor: colors.elevated },
  dateLabel: { color: colors.muted, fontSize: type.xs, fontWeight: '900', letterSpacing: 1 },
  dateValue: { color: colors.text, fontSize: type.lg, fontWeight: '900', marginTop: 4 },
  dateEdit: { color: colors.accent, fontSize: type.xs, fontWeight: '900' },
  dateHelp: { color: colors.muted, fontSize: type.sm, lineHeight: 17 },
  dateShortcuts: { flexDirection: 'row', gap: 8, marginTop: 12 },
  dateSteppers: { flexDirection: 'row', gap: 8, marginTop: 12 },
});
