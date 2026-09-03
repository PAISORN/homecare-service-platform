import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { colors, radii, spacing, typography } from '@homecare/design-tokens';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  formatPreferredDateTh,
  parsePreferredDate,
  toPreferredDateValue,
} from './preferred-date';

type Props = Readonly<{
  value: string;
  onChange: (value: string) => void;
  minimumDate: Date;
  placeholder: string;
  clearLabel: string;
  fontFamily?: string;
}>;

export function PreferredDateField({
  value,
  onChange,
  minimumDate,
  placeholder,
  clearLabel,
  fontFamily,
}: Props) {
  const selectedDate = parsePreferredDate(value);
  const [showPicker, setShowPicker] = useState(false);

  function handleChange(event: DateTimePickerEvent, nextDate?: Date) {
    setShowPicker(false);
    if (event.type === 'set' && nextDate) {
      onChange(toPreferredDateValue(nextDate));
    }
  }

  return (
    <View style={styles.group}>
      <Pressable
        accessibilityRole="button"
        onPress={() => setShowPicker(true)}
        style={styles.pickerWrap}
      >
        <Text
          style={[
            styles.selection,
            selectedDate && styles.selected,
            { fontFamily },
          ]}
        >
          {selectedDate ? formatPreferredDateTh(value) : placeholder}
        </Text>
      </Pressable>
      {showPicker ? (
        <DateTimePicker
          accessibilityLabel={placeholder}
          display={Platform.OS === 'ios' ? 'compact' : 'default'}
          minimumDate={minimumDate}
          mode="date"
          onChange={handleChange}
          value={selectedDate ?? minimumDate}
        />
      ) : null}
      {selectedDate ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => onChange('')}
          style={styles.clearButton}
        >
          <Text style={[styles.clearText, { fontFamily }]}>{clearLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  pickerWrap: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.button,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
  selection: {
    color: colors.textMuted,
    flex: 1,
    fontSize: typography.bodySize,
  },
  selected: { color: colors.text },
  clearButton: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.sm,
  },
  clearText: { color: colors.action, fontSize: typography.supportSize },
});
