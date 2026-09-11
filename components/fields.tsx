import { createElement, useState, type CSSProperties, type ChangeEvent } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';

import { colors, radius, space } from '@/constants/theme';
import { combineDateTime, formatDayLong, toISODate } from '@/lib/dates';

export function LabeledField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
  autoCapitalize,
  autoCorrect,
  autoComplete,
  secureTextEntry,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'decimal-pad' | 'numeric' | 'email-address';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  autoComplete?: 'email' | 'password' | 'off' | 'name';
  secureTextEntry?: boolean;
}) {
  return (
    <LabeledField label={label}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        autoComplete={autoComplete}
        secureTextEntry={secureTextEntry}
        style={[styles.input, multiline && styles.textarea]}
      />
    </LabeledField>
  );
}

export function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <PickerField
      label={label}
      display={formatDayLong(value)}
      mode="date"
      date={combineDateTime(value || toISODate(new Date()), '12:00')}
      onChangeDate={(next) => onChange(toISODate(next))}
    />
  );
}

export function TimeField({
  label,
  value,
  onChange,
  optional,
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  optional?: boolean;
}) {
  const display = value ?? (optional ? 'Brak' : '--:--');
  return (
    <PickerField
      label={label}
      display={display}
      mode="time"
      date={combineDateTime('2000-01-01', value ?? '18:00')}
      onChangeDate={(next) => {
        const hours = String(next.getHours()).padStart(2, '0');
        const minutes = String(next.getMinutes()).padStart(2, '0');
        onChange(`${hours}:${minutes}`);
      }}
      onClear={optional ? () => onChange(null) : undefined}
    />
  );
}

function PickerField({
  label,
  display,
  mode,
  date,
  onChangeDate,
  onClear,
}: {
  label: string;
  display: string;
  mode: 'date' | 'time';
  date: Date;
  onChangeDate: (value: Date) => void;
  onClear?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;

  if (Platform.OS === 'web') {
    return (
      <WebPickerField
        label={label}
        mode={mode}
        date={safeDate}
        onChangeDate={onChangeDate}
        onClear={onClear}
      />
    );
  }

  const onAndroidChange = (event: DateTimePickerEvent, selected?: Date) => {
    setOpen(false);
    if (event.type === 'dismissed') return;
    if (selected) onChangeDate(selected);
  };

  const onIosChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (event.type === 'dismissed') return;
    if (selected) onChangeDate(selected);
  };

  return (
    <LabeledField label={label}>
      <View style={styles.pickerRow}>
        <Pressable onPress={() => setOpen(true)} style={styles.input}>
          <Text style={styles.inputText}>{display}</Text>
        </Pressable>
        {onClear ? (
          <Pressable onPress={onClear} style={styles.clearBtn}>
            <Text style={styles.clearText}>Wyczyść</Text>
          </Pressable>
        ) : null}
      </View>

      {Platform.OS === 'android' && open ? (
        <DateTimePicker
          value={safeDate}
          mode={mode}
          is24Hour
          display={mode === 'date' ? 'calendar' : 'default'}
          onChange={onAndroidChange}
        />
      ) : null}

      {Platform.OS === 'ios' ? (
        <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <View style={styles.modalRoot}>
            <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
            <View style={styles.sheet}>
              <Text style={styles.sheetTitle}>{mode === 'date' ? 'Wybierz datę' : 'Wybierz godzinę'}</Text>
              <DateTimePicker
                value={safeDate}
                mode={mode}
                is24Hour
                display={mode === 'date' ? 'inline' : 'spinner'}
                onChange={onIosChange}
                themeVariant="light"
                accentColor={colors.accent}
                locale="pl-PL"
                style={mode === 'date' ? styles.calendar : styles.timeSpinner}
              />
              <Pressable onPress={() => setOpen(false)} style={styles.doneBtn}>
                <Text style={styles.doneText}>Gotowe</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      ) : null}
    </LabeledField>
  );
}

function WebPickerField({
  label,
  mode,
  date,
  onChangeDate,
  onClear,
}: {
  label: string;
  mode: 'date' | 'time';
  date: Date;
  onChangeDate: (value: Date) => void;
  onClear?: () => void;
}) {
  const value =
    mode === 'date'
      ? toISODate(date)
      : `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  const inputStyle: CSSProperties = {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    border: `1px solid ${colors.border}`,
    padding: '12px 16px',
    fontSize: 16,
    backgroundColor: colors.card,
    color: colors.text,
    fontFamily: 'inherit',
  };

  return (
    <LabeledField label={label}>
      <View style={styles.pickerRow}>
        {createElement('input', {
          type: mode === 'date' ? 'date' : 'time',
          value,
          onChange: (event: ChangeEvent<HTMLInputElement>) => {
            const next = event.target.value;
            if (!next) return;
            if (mode === 'date') {
              onChangeDate(combineDateTime(next, '12:00'));
              return;
            }
            onChangeDate(combineDateTime('2000-01-01', next.length === 5 ? next : next.slice(0, 5)));
          },
          style: inputStyle,
        })}
        {onClear ? (
          <Pressable onPress={onClear} style={styles.clearBtn}>
            <Text style={styles.clearText}>Wyczyść</Text>
          </Pressable>
        ) : null}
      </View>
    </LabeledField>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 8,
  },
  label: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 52,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    justifyContent: 'center',
  },
  textarea: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
  inputText: {
    fontSize: 16,
    color: colors.text,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clearBtn: {
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  clearText: {
    color: colors.muted,
    fontWeight: '600',
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    padding: space.md,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.overlay,
  },
  sheet: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: space.md,
    gap: space.sm,
  },
  sheetTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  calendar: {
    alignSelf: 'stretch',
    height: 360,
    width: '100%',
  },
  timeSpinner: {
    alignSelf: 'center',
    height: 180,
  },
  doneBtn: {
    alignSelf: 'stretch',
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 16,
  },
});
