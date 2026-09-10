import { colors, radii, spacing, typography } from '@homecare/design-tokens';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAppFontFamilies } from '../../foundation/font-runtime';
import type { MobileSupabaseClient } from '../../lib/supabase';
import { serviceJobAcceptanceCopyTh as copy } from '../../locales/th';
import type { ServiceJobActorRole, ServiceJobStatus } from './service-jobs-api';
import {
  confirmServiceJobAcceptance,
  formatAcceptanceRemainingTh,
  getServiceJobAcceptance,
  requestServiceJobAcceptanceHelp,
  validateAcceptanceHelpReason,
  type ServiceJobAcceptance,
} from './service-job-acceptance-api';

type Props = Readonly<{
  client: MobileSupabaseClient;
  jobId: string;
  jobStatus: ServiceJobStatus;
  mode: ServiceJobActorRole;
  onChanged: () => Promise<void>;
  onOpenEvidence: () => void;
}>;

export function ServiceJobAcceptancePanel({
  client,
  jobId,
  jobStatus,
  mode,
  onChanged,
  onOpenEvidence,
}: Props) {
  const [acceptance, setAcceptance] = useState<ServiceJobAcceptance | null>(
    null,
  );
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState<'accept' | 'help' | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [reason, setReason] = useState('');
  const [showReasonError, setShowReasonError] = useState(false);
  const styles = createStyles(useAppFontFamilies());
  const validReason = useMemo(
    () => validateAcceptanceHelpReason(reason),
    [reason],
  );

  const load = useCallback(async () => {
    setState('loading');
    try {
      const nextAcceptance = await getServiceJobAcceptance(client, jobId);
      setAcceptance(nextAcceptance);
      setState('ready');
      if (
        jobStatus === 'awaiting_acceptance' &&
        (nextAcceptance?.status === 'customer_accepted' ||
          nextAcceptance?.status === 'automatic_accepted')
      ) {
        await onChanged();
      }
    } catch {
      setState('error');
    }
  }, [client, jobId, jobStatus, onChanged]);

  useFocusEffect(useCallback(() => void load(), [load]));

  function askToAccept() {
    if (busy) return;
    Alert.alert(copy.confirmTitle, copy.confirmBody, [
      { text: copy.keepReviewing, style: 'cancel' },
      { text: copy.confirmAction, onPress: () => void accept() },
    ]);
  }

  async function accept() {
    setBusy('accept');
    try {
      const nextAcceptance = await confirmServiceJobAcceptance(client, jobId);
      setAcceptance(nextAcceptance);
      Alert.alert(copy.acceptedTitle, copy.acceptedBody);
      await onChanged();
    } catch {
      Alert.alert(copy.actionFailedTitle, copy.actionFailedBody);
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function requestHelp() {
    setShowReasonError(true);
    if (!validReason || busy) return;
    setBusy('help');
    try {
      const nextAcceptance = await requestServiceJobAcceptanceHelp(
        client,
        jobId,
        validReason,
      );
      setAcceptance(nextAcceptance);
      setShowHelp(false);
      setReason('');
      Alert.alert(copy.helpSavedTitle, copy.helpSavedBody);
      await onChanged();
    } catch {
      Alert.alert(copy.actionFailedTitle, copy.actionFailedBody);
      await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <View>
      <Text style={styles.sectionTitle}>{copy.title}</Text>
      <View style={styles.card}>
        <View style={styles.sandboxNotice}>
          <Text style={styles.sandboxTitle}>{copy.sandboxTitle}</Text>
          <Text style={styles.sandboxBody}>{copy.sandboxBody}</Text>
        </View>

        {state === 'loading' ? (
          <ActivityIndicator color={colors.action} style={styles.loader} />
        ) : null}
        {state === 'error' ? (
          <View style={styles.group}>
            <Text accessibilityLiveRegion="polite" style={styles.error}>
              {copy.loadFailed}
            </Text>
            <ActionButton
              label={copy.retry}
              onPress={() => void load()}
              styles={styles}
            />
          </View>
        ) : null}
        {state === 'ready' && !acceptance ? (
          <Text style={styles.support}>{copy.notAvailable}</Text>
        ) : null}
        {state === 'ready' && acceptance ? (
          <>
            <Text style={styles.statusTitle}>
              {copy.statusLabels[acceptance.status]}
            </Text>
            {acceptance.status === 'pending' ? (
              <>
                <Text style={styles.deadline}>
                  {formatAcceptanceRemainingTh(acceptance.review_deadline_at)}
                </Text>
                <Text style={styles.support}>
                  {copy.deadline(formatDateTime(acceptance.review_deadline_at))}
                </Text>
                <Text style={styles.body}>
                  {mode === 'customer'
                    ? copy.customerGuidance
                    : copy.technicianGuidance}
                </Text>
                <ActionButton
                  label={copy.openEvidence}
                  onPress={onOpenEvidence}
                  styles={styles}
                />
                {mode === 'customer' ? (
                  <>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ disabled: busy !== null }}
                      disabled={busy !== null}
                      onPress={askToAccept}
                      style={({ pressed }) => [
                        styles.primaryButton,
                        busy !== null && styles.disabled,
                        pressed && styles.pressed,
                      ]}
                    >
                      {busy === 'accept' ? (
                        <ActivityIndicator color={colors.surface} />
                      ) : (
                        <Text style={styles.primaryText}>
                          {copy.acceptAction}
                        </Text>
                      )}
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ disabled: busy !== null }}
                      disabled={busy !== null}
                      onPress={() => setShowHelp((value) => !value)}
                      style={({ pressed }) => [
                        styles.helpToggle,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.helpToggleText}>
                        {copy.helpAction}
                      </Text>
                    </Pressable>
                    {showHelp ? (
                      <View style={styles.group}>
                        <Text style={styles.label}>{copy.helpReasonLabel}</Text>
                        <Text style={styles.support}>
                          {copy.helpReasonHelp}
                        </Text>
                        <TextInput
                          accessibilityLabel={copy.helpReasonLabel}
                          maxLength={1000}
                          multiline
                          onChangeText={setReason}
                          placeholder={copy.helpReasonPlaceholder}
                          placeholderTextColor={colors.textMuted}
                          style={[
                            styles.input,
                            showReasonError &&
                              !validReason &&
                              styles.inputError,
                          ]}
                          textAlignVertical="top"
                          value={reason}
                        />
                        {showReasonError && !validReason ? (
                          <Text
                            accessibilityLiveRegion="polite"
                            style={styles.error}
                          >
                            {copy.helpReasonInvalid}
                          </Text>
                        ) : null}
                        <ActionButton
                          disabled={busy !== null}
                          label={copy.saveHelpAction}
                          loading={busy === 'help'}
                          onPress={() => void requestHelp()}
                          styles={styles}
                        />
                      </View>
                    ) : null}
                  </>
                ) : null}
              </>
            ) : null}

            {acceptance.status === 'help_requested' ? (
              <>
                <Text style={styles.body}>{copy.helpRequestedBody}</Text>
                {acceptance.help_reason ? (
                  <Text style={styles.reason}>{acceptance.help_reason}</Text>
                ) : null}
              </>
            ) : null}

            {acceptance.status === 'customer_accepted' ||
            acceptance.status === 'automatic_accepted' ? (
              <Text style={styles.body}>
                {acceptance.status === 'customer_accepted'
                  ? copy.customerAcceptedBody
                  : copy.automaticAcceptedBody}
              </Text>
            ) : null}
          </>
        ) : null}
      </View>
    </View>
  );
}

function ActionButton({
  disabled = false,
  label,
  loading = false,
  onPress,
  styles,
}: Readonly<{
  disabled?: boolean;
  label: string;
  loading?: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryButton,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.action} />
      ) : (
        <Text style={styles.secondaryText}>{label}</Text>
      )}
    </Pressable>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function createStyles(fonts: ReturnType<typeof useAppFontFamilies>) {
  return StyleSheet.create({
    sectionTitle: {
      color: colors.text,
      fontFamily: fonts.bold,
      fontSize: typography.sectionTitleSize,
      marginTop: spacing.xxl,
    },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      marginTop: spacing.md,
      padding: spacing.lg,
    },
    sandboxNotice: {
      backgroundColor: colors.background,
      borderColor: colors.warning,
      borderRadius: radii.button,
      borderWidth: 1,
      padding: spacing.md,
    },
    sandboxTitle: {
      color: colors.warning,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
    },
    sandboxBody: {
      color: colors.text,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      lineHeight: 21,
      marginTop: spacing.xs,
    },
    loader: { marginVertical: spacing.xl },
    statusTitle: {
      color: colors.primary,
      fontFamily: fonts.bold,
      fontSize: typography.bodySize,
      marginTop: spacing.lg,
    },
    deadline: {
      color: colors.warning,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
      marginTop: spacing.sm,
    },
    body: {
      color: colors.text,
      fontFamily: fonts.regular,
      fontSize: typography.bodySize,
      lineHeight: 25,
      marginTop: spacing.md,
    },
    support: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      lineHeight: 21,
      marginTop: spacing.sm,
    },
    group: { marginTop: spacing.md },
    primaryButton: {
      alignItems: 'center',
      backgroundColor: colors.action,
      borderRadius: radii.button,
      justifyContent: 'center',
      marginTop: spacing.md,
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
    helpToggle: {
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.md,
      minHeight: 48,
      paddingHorizontal: spacing.lg,
    },
    helpToggleText: {
      color: colors.danger,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
    },
    label: {
      color: colors.text,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
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
      minHeight: 120,
      padding: spacing.md,
    },
    inputError: { borderColor: colors.danger },
    error: {
      color: colors.danger,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      lineHeight: 21,
      marginTop: spacing.sm,
    },
    reason: {
      backgroundColor: colors.background,
      borderRadius: radii.button,
      color: colors.text,
      fontFamily: fonts.regular,
      fontSize: typography.bodySize,
      lineHeight: 25,
      marginTop: spacing.md,
      padding: spacing.md,
    },
    disabled: { opacity: 0.5 },
    pressed: { opacity: 0.8 },
  });
}
