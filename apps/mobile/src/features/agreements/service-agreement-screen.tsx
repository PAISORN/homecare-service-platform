import { colors, radii, spacing, typography } from '@homecare/design-tokens';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
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
import { serviceAgreementCopyTh as copy } from '../../locales/th';
import { useSession } from '../../providers/session-provider';
import { PreferredDateField } from '../requests/preferred-date-field';
import { formatPreferredDateTh } from '../requests/preferred-date';
import { goBackOrReplace } from '../shared/navigation';
import {
  confirmServiceRequestAgreement,
  formatServiceAddress,
  getServiceRequestAgreement,
  proposeServiceRequestAppointment,
  type ServiceRequestAgreement,
  validateAppointmentProposal,
} from './service-agreement-api';

type Props = Readonly<{ fallback: '/requests' | '/technician/feed' }>;

export function ServiceAgreementScreen({ fallback }: Props) {
  const router = useRouter();
  const { requestId } = useLocalSearchParams<{ requestId?: string }>();
  const { client } = useSession();
  const [agreement, setAgreement] = useState<ServiceRequestAgreement | null>(
    null,
  );
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTimeWindow, setAppointmentTimeWindow] = useState('');
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState<'save' | 'confirm' | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const fonts = useAppFontFamilies();
  const styles = createStyles(fonts);

  const load = useCallback(async () => {
    if (!client || !requestId) {
      setState('error');
      return;
    }
    setState('loading');
    try {
      const next = await getServiceRequestAgreement(client, requestId);
      setAgreement(next);
      setAppointmentDate(next.appointment_date ?? '');
      setAppointmentTimeWindow(next.appointment_time_window ?? '');
      setShowErrors(false);
      setState('ready');
    } catch {
      setState('error');
    }
  }, [client, requestId]);

  useFocusEffect(useCallback(() => void load(), [load]));

  const validation = useMemo(
    () => validateAppointmentProposal(appointmentDate, appointmentTimeWindow),
    [appointmentDate, appointmentTimeWindow],
  );
  const hasChanges = Boolean(
    agreement &&
    (appointmentDate.trim() !== (agreement.appointment_date ?? '') ||
      appointmentTimeWindow.trim() !==
        (agreement.appointment_time_window ?? '')),
  );
  const ownConfirmed = agreement
    ? agreement.actor_role === 'customer'
      ? agreement.customer_confirmed
      : agreement.technician_confirmed
    : false;

  async function saveAppointment() {
    if (!client || !requestId || busy || agreement?.fully_confirmed_at) return;
    setShowErrors(true);
    if (Object.keys(validation.errors).length > 0) return;
    setBusy('save');
    try {
      await proposeServiceRequestAppointment(
        client,
        requestId,
        validation.value.appointmentDate,
        validation.value.appointmentTimeWindow,
      );
      await load();
    } catch {
      Alert.alert(copy.saveFailed);
    } finally {
      setBusy(null);
    }
  }

  function askToConfirm() {
    if (!client || !requestId || busy || hasChanges || ownConfirmed) return;
    Alert.alert(copy.confirmTitle, copy.confirmBody, [
      { text: copy.keepReviewing, style: 'cancel' },
      { text: copy.confirm, onPress: () => void confirmAgreement() },
    ]);
  }

  async function confirmAgreement() {
    if (!client || !requestId || busy) return;
    setBusy('confirm');
    try {
      await confirmServiceRequestAgreement(client, requestId);
      await load();
    } catch {
      Alert.alert(copy.confirmFailed);
    } finally {
      setBusy(null);
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
            onPress={() => goBackOrReplace(router, fallback)}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.backText}>{copy.back}</Text>
          </Pressable>
          <Text accessibilityRole="header" style={styles.title}>
            {copy.title}
          </Text>
          <Text style={styles.description}>{copy.description}</Text>

          {state === 'loading' ? (
            <ActivityIndicator color={colors.action} style={styles.loader} />
          ) : null}
          {state === 'error' ? (
            <View style={styles.errorGroup}>
              <Text accessibilityLiveRegion="polite" style={styles.error}>
                {copy.loadFailed}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => void load()}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.secondaryText}>{copy.retry}</Text>
              </Pressable>
            </View>
          ) : null}

          {state === 'ready' && agreement ? (
            <>
              <View style={styles.card}>
                <Text style={styles.cardEyebrow}>
                  {agreement.category_name_th} ·{' '}
                  {copy.quantity(agreement.quantity)}
                </Text>
                <Text style={styles.cardTitle}>
                  {agreement.item_name_th ?? copy.symptomRequest}
                </Text>
                <Text style={styles.cardBody}>
                  {agreement.problem_description}
                </Text>
              </View>

              <Text style={styles.sectionTitle}>{copy.scopeTitle}</Text>
              <View style={styles.card}>
                <Text style={styles.cardBody}>
                  {agreement.scope_description}
                </Text>
                <Text style={styles.amount}>
                  {copy.laborAmount(agreement.labor_amount, agreement.currency)}
                </Text>
              </View>

              <Text style={styles.sectionTitle}>
                {copy.serviceLocationTitle}
              </Text>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{agreement.location_label}</Text>
                <Text style={styles.cardBody}>
                  {formatServiceAddress(agreement)}
                </Text>
              </View>

              <Text style={styles.sectionTitle}>{copy.appointmentTitle}</Text>
              <Text style={styles.sectionDescription}>
                {copy.appointmentDescription}
              </Text>
              <Text style={styles.label}>{copy.dateLabel}</Text>
              <PreferredDateField
                clearLabel={copy.clearDate}
                fontFamily={fonts.regular}
                minimumDate={new Date()}
                onChange={setAppointmentDate}
                placeholder={copy.datePlaceholder}
                value={appointmentDate}
              />
              {showErrors && validation.errors.appointmentDate ? (
                <Text style={styles.error}>
                  {validation.errors.appointmentDate === 'required'
                    ? copy.required
                    : copy.invalidDate}
                </Text>
              ) : null}
              <Text style={styles.label}>{copy.timeLabel}</Text>
              <TextInput
                accessibilityLabel={copy.timeLabel}
                editable={!agreement.fully_confirmed_at}
                maxLength={80}
                onChangeText={setAppointmentTimeWindow}
                placeholder={copy.timePlaceholder}
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.input,
                  showErrors &&
                    validation.errors.appointmentTimeWindow &&
                    styles.inputError,
                ]}
                value={appointmentTimeWindow}
              />
              {showErrors && validation.errors.appointmentTimeWindow ? (
                <Text style={styles.error}>
                  {validation.errors.appointmentTimeWindow === 'required'
                    ? copy.required
                    : copy.invalidTime}
                </Text>
              ) : null}
              {!agreement.fully_confirmed_at ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: busy !== null }}
                  disabled={busy !== null}
                  onPress={() => void saveAppointment()}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    busy !== null && styles.disabled,
                    pressed && styles.pressed,
                  ]}
                >
                  {busy === 'save' ? (
                    <ActivityIndicator color={colors.action} />
                  ) : (
                    <Text style={styles.secondaryText}>
                      {copy.saveAppointment}
                    </Text>
                  )}
                </Pressable>
              ) : null}

              <Text style={styles.sectionTitle}>{copy.confirmationTitle}</Text>
              <View style={styles.confirmationRow}>
                <ConfirmationStatus
                  confirmed={agreement.customer_confirmed}
                  label={copy.customerLabel}
                  styles={styles}
                />
                <ConfirmationStatus
                  confirmed={agreement.technician_confirmed}
                  label={copy.technicianLabel}
                  styles={styles}
                />
              </View>
              {hasChanges ? (
                <Text accessibilityLiveRegion="polite" style={styles.notice}>
                  {copy.changedNotice}
                </Text>
              ) : null}
              {agreement.fully_confirmed_at ? (
                <View style={styles.successCard}>
                  <Text style={styles.successTitle}>{copy.completedTitle}</Text>
                  <Text style={styles.successBody}>{copy.completedBody}</Text>
                </View>
              ) : ownConfirmed ? (
                <Text style={styles.notice}>{copy.waitingOtherParty}</Text>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{
                    disabled:
                      busy !== null ||
                      hasChanges ||
                      !agreement.appointment_date,
                  }}
                  disabled={
                    busy !== null || hasChanges || !agreement.appointment_date
                  }
                  onPress={askToConfirm}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    (busy !== null ||
                      hasChanges ||
                      !agreement.appointment_date) &&
                      styles.disabled,
                    pressed && styles.pressed,
                  ]}
                >
                  {busy === 'confirm' ? (
                    <ActivityIndicator color={colors.surface} />
                  ) : (
                    <Text style={styles.primaryText}>
                      {copy.confirmAgreement}
                    </Text>
                  )}
                </Pressable>
              )}
              {agreement.appointment_date && !hasChanges ? (
                <Text style={styles.revisionText}>
                  {formatPreferredDateTh(agreement.appointment_date)} ·{' '}
                  {agreement.appointment_time_window} · ฉบับที่{' '}
                  {agreement.revision}
                </Text>
              ) : null}
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ConfirmationStatus({
  confirmed,
  label,
  styles,
}: Readonly<{
  confirmed: boolean;
  label: string;
  styles: ReturnType<typeof createStyles>;
}>) {
  return (
    <View style={[styles.statusCard, confirmed && styles.statusCardConfirmed]}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={confirmed ? styles.statusConfirmed : styles.statusWaiting}>
        {confirmed ? copy.confirmed : copy.waiting}
      </Text>
    </View>
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
      lineHeight: 42,
      marginTop: spacing.md,
    },
    description: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.bodySize,
      lineHeight: 24,
      marginTop: spacing.sm,
    },
    loader: { marginTop: spacing.xxl },
    errorGroup: { marginTop: spacing.xl },
    error: {
      color: colors.danger,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      lineHeight: 21,
      marginTop: spacing.sm,
    },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      marginTop: spacing.md,
      padding: spacing.lg,
    },
    cardEyebrow: {
      color: colors.primary,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
    },
    cardTitle: {
      color: colors.text,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
      marginTop: spacing.xs,
    },
    cardBody: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.bodySize,
      lineHeight: 24,
      marginTop: spacing.xs,
    },
    amount: {
      color: colors.primary,
      fontFamily: fonts.bold,
      fontSize: typography.sectionTitleSize,
      marginTop: spacing.md,
    },
    sectionTitle: {
      color: colors.text,
      fontFamily: fonts.bold,
      fontSize: typography.sectionTitleSize,
      marginTop: spacing.xxl,
    },
    sectionDescription: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      lineHeight: 21,
      marginTop: spacing.sm,
    },
    label: {
      color: colors.text,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
      marginBottom: spacing.sm,
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
      minHeight: 52,
      paddingHorizontal: spacing.lg,
    },
    inputError: { borderColor: colors.danger },
    primaryButton: {
      alignItems: 'center',
      backgroundColor: colors.action,
      borderRadius: radii.button,
      justifyContent: 'center',
      marginTop: spacing.xl,
      minHeight: 52,
      paddingHorizontal: spacing.lg,
    },
    primaryText: {
      color: colors.surface,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
    },
    secondaryButton: {
      alignItems: 'center',
      borderColor: colors.action,
      borderRadius: radii.button,
      borderWidth: 1,
      justifyContent: 'center',
      marginTop: spacing.md,
      minHeight: 48,
      paddingHorizontal: spacing.lg,
    },
    secondaryText: {
      color: colors.action,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
    },
    confirmationRow: {
      flexDirection: 'row',
      gap: spacing.md,
      marginTop: spacing.md,
    },
    statusCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.button,
      borderWidth: 1,
      flex: 1,
      padding: spacing.md,
    },
    statusCardConfirmed: { borderColor: colors.success },
    statusLabel: {
      color: colors.text,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
    },
    statusConfirmed: {
      color: colors.success,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
      marginTop: spacing.xs,
    },
    statusWaiting: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      marginTop: spacing.xs,
    },
    notice: {
      color: colors.warning,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      lineHeight: 21,
      marginTop: spacing.md,
    },
    successCard: {
      backgroundColor: colors.surface,
      borderColor: colors.success,
      borderRadius: radii.card,
      borderWidth: 1,
      marginTop: spacing.lg,
      padding: spacing.lg,
    },
    successTitle: {
      color: colors.success,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
    },
    successBody: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      lineHeight: 21,
      marginTop: spacing.xs,
    },
    revisionText: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      lineHeight: 21,
      marginTop: spacing.md,
      textAlign: 'center',
    },
    disabled: { opacity: 0.46 },
    pressed: { opacity: 0.76 },
  });
}
