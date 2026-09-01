import { colors, radii, spacing, typography } from '@homecare/design-tokens';
import { StyleSheet } from 'react-native';

import type { useAppFontFamilies } from '../../foundation/font-runtime';

export function createFormStyles(fonts: ReturnType<typeof useAppFontFamilies>) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    keyboardView: { flex: 1 },
    content: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    topContent: { justifyContent: 'flex-start' },
    brand: {
      color: colors.primary,
      fontFamily: fonts.bold,
      fontSize: typography.supportSize,
      letterSpacing: 1.2,
    },
    title: {
      color: colors.text,
      fontFamily: fonts.bold,
      fontSize: typography.pageTitleSize,
      lineHeight: 42,
      marginTop: spacing.sm,
    },
    description: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.bodySize,
      lineHeight: 24,
      marginTop: spacing.sm,
    },
    field: { marginTop: spacing.xl },
    label: {
      color: colors.text,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
      marginTop: spacing.xl,
      marginBottom: spacing.sm,
    },
    input: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.button,
      borderWidth: 1,
      color: colors.text,
      fontFamily: fonts.regular,
      fontSize: typography.bodySize,
      minHeight: 52,
      paddingHorizontal: spacing.lg,
    },
    inputError: { borderColor: colors.danger },
    helper: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      lineHeight: 21,
      marginTop: spacing.sm,
    },
    error: {
      color: colors.danger,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      lineHeight: 21,
      marginTop: spacing.sm,
    },
    primaryButton: {
      alignItems: 'center',
      backgroundColor: colors.action,
      borderRadius: radii.button,
      justifyContent: 'center',
      marginTop: spacing.xl,
      minHeight: 52,
      paddingHorizontal: spacing.lg,
    },
    buttonDisabled: { opacity: 0.46 },
    buttonPressed: { opacity: 0.76 },
    primaryButtonText: {
      color: colors.surface,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
    },
    secondaryButton: {
      alignItems: 'center',
      borderRadius: radii.button,
      justifyContent: 'center',
      marginTop: spacing.md,
      minHeight: 48,
      paddingHorizontal: spacing.lg,
    },
    secondaryButtonText: {
      color: colors.action,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
    },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      marginTop: spacing.xl,
      padding: spacing.lg,
    },
    cardTitle: {
      color: colors.text,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
    },
    cardBody: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      lineHeight: 21,
      marginTop: spacing.xs,
    },
  });
}
