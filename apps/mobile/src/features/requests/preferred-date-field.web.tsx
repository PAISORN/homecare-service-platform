import { colors, radii, spacing, typography } from '@homecare/design-tokens';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatPreferredDateTh, toPreferredDateValue } from './preferred-date';

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
  return (
    <View style={styles.group}>
      <input
        aria-label={placeholder}
        min={toPreferredDateValue(minimumDate)}
        onChange={(event) => onChange(event.currentTarget.value)}
        style={{
          backgroundColor: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: radii.button,
          boxSizing: 'border-box',
          color: colors.text,
          fontFamily,
          fontSize: typography.bodySize,
          minHeight: 52,
          padding: `0 ${spacing.md}px`,
          width: '100%',
        }}
        type="date"
        value={value}
      />
      {value ? (
        <View style={styles.selectionRow}>
          <Text style={[styles.selection, { fontFamily }]}>
            {formatPreferredDateTh(value)}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => onChange('')}
            style={styles.clearButton}
          >
            <Text style={[styles.clearText, { fontFamily }]}>{clearLabel}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.xs },
  selectionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  selection: {
    color: colors.textMuted,
    fontSize: typography.supportSize,
  },
  clearButton: {
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.sm,
  },
  clearText: { color: colors.action, fontSize: typography.supportSize },
});
