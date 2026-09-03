import { colors, radii, spacing, typography } from '@homecare/design-tokens';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppFontFamilies } from '../../foundation/font-runtime';
import { technicianQuotationCopyTh as copy } from '../../locales/th';
import { useSession } from '../../providers/session-provider';
import { canUseTechnicianMode } from '../account/account-api';
import { goBackOrReplace } from '../shared/navigation';
import {
  submitTechnicianQuotation,
  validateTechnicianQuotation,
} from './technician-matching-api';

export function TechnicianQuotationScreen() {
  const router = useRouter();
  const { requestId, scope, amount } = useLocalSearchParams<{
    requestId?: string;
    scope?: string;
    amount?: string;
  }>();
  const { client, technicianApplication } = useSession();
  const [scopeDescription, setScopeDescription] = useState(scope ?? '');
  const [laborAmount, setLaborAmount] = useState(amount ?? '');
  const [errors, setErrors] = useState<
    ReturnType<typeof validateTechnicianQuotation>['errors']
  >({});
  const [saving, setSaving] = useState(false);
  const styles = createStyles(useAppFontFamilies());

  if (!canUseTechnicianMode(technicianApplication)) {
    return <Redirect href="/account" />;
  }
  if (!requestId) return <Redirect href="/technician/feed" />;

  async function saveQuotation() {
    if (!client || !requestId || saving) return;
    const validation = validateTechnicianQuotation({
      requestId,
      scopeDescription,
      laborAmount,
    });
    setErrors(validation.errors);
    if (Object.keys(validation.errors).length > 0) return;

    setSaving(true);
    try {
      await submitTechnicianQuotation(client, {
        requestId,
        scopeDescription,
        laborAmount,
      });
      Alert.alert(copy.savedTitle, copy.savedBody, [
        {
          text: copy.done,
          onPress: () => goBackOrReplace(router, '/technician/feed'),
        },
      ]);
    } catch {
      Alert.alert(copy.saveFailedTitle, copy.saveFailedBody);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            accessibilityRole="button"
            onPress={() => goBackOrReplace(router, '/technician/feed')}
            style={styles.backButton}
          >
            <Text style={styles.backText}>{copy.back}</Text>
          </Pressable>
          <Text accessibilityRole="header" style={styles.title}>
            {copy.title}
          </Text>
          <Text style={styles.description}>{copy.description}</Text>

          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>{copy.sealedTitle}</Text>
            <Text style={styles.noticeBody}>{copy.sealedBody}</Text>
          </View>

          <Text style={styles.label}>{copy.scopeLabel}</Text>
          <TextInput
            accessibilityLabel={copy.scopeLabel}
            maxLength={2000}
            multiline
            onChangeText={setScopeDescription}
            placeholder={copy.scopePlaceholder}
            placeholderTextColor={colors.textMuted}
            style={[styles.input, styles.textArea]}
            textAlignVertical="top"
            value={scopeDescription}
          />
          {errors.scopeDescription ? (
            <Text accessibilityLiveRegion="polite" style={styles.error}>
              {errors.scopeDescription === 'required'
                ? copy.required
                : copy.scopeInvalid}
            </Text>
          ) : null}
          <Text style={styles.helper}>{copy.scopeHelper}</Text>

          <Text style={styles.label}>{copy.amountLabel}</Text>
          <TextInput
            accessibilityLabel={copy.amountLabel}
            inputMode="decimal"
            onChangeText={setLaborAmount}
            placeholder={copy.amountPlaceholder}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={laborAmount}
          />
          {errors.laborAmount ? (
            <Text accessibilityLiveRegion="polite" style={styles.error}>
              {errors.laborAmount === 'required'
                ? copy.required
                : copy.amountInvalid}
            </Text>
          ) : null}
          <Text style={styles.helper}>{copy.amountHelper}</Text>

          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={() => void saveQuotation()}
            style={({ pressed }) => [
              styles.primaryButton,
              saving && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            {saving ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <Text style={styles.primaryText}>{copy.submit}</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(fonts: ReturnType<typeof useAppFontFamilies>) {
  return StyleSheet.create({
    flex: { flex: 1 },
    safeArea: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl },
    backButton: {
      alignSelf: 'flex-start',
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: spacing.sm,
    },
    backText: {
      color: colors.action,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
    },
    title: {
      color: colors.text,
      fontFamily: fonts.bold,
      fontSize: typography.pageTitleSize,
      marginTop: spacing.md,
    },
    description: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.bodySize,
      lineHeight: 24,
      marginTop: spacing.sm,
    },
    notice: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      marginTop: spacing.xl,
      padding: spacing.lg,
    },
    noticeTitle: {
      color: colors.primary,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
    },
    noticeBody: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      lineHeight: 21,
      marginTop: spacing.xs,
    },
    label: {
      color: colors.text,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
      marginTop: spacing.xl,
    },
    input: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.button,
      borderWidth: 1,
      color: colors.text,
      fontFamily: fonts.regular,
      fontSize: typography.bodySize,
      marginTop: spacing.sm,
      minHeight: 52,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    textArea: { minHeight: 140 },
    helper: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      lineHeight: 20,
      marginTop: spacing.xs,
    },
    error: {
      color: colors.danger,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      marginTop: spacing.xs,
    },
    primaryButton: {
      alignItems: 'center',
      backgroundColor: colors.action,
      borderRadius: radii.button,
      justifyContent: 'center',
      marginTop: spacing.xxl,
      minHeight: 52,
      paddingHorizontal: spacing.lg,
    },
    primaryText: {
      color: colors.surface,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
    },
    disabled: { opacity: 0.5 },
    pressed: { opacity: 0.76 },
  });
}
