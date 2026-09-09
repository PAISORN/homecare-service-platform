import { colors, radii, spacing, typography } from '@homecare/design-tokens';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
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
import {
  serviceJobDetailCopyTh as copy,
  serviceJobsCopyTh,
} from '../../locales/th';
import { useSession } from '../../providers/session-provider';
import { formatPreferredDateTh } from '../requests/preferred-date';
import { goBackOrReplace } from '../shared/navigation';
import {
  canCancelServiceJob,
  getNextTechnicianStatus,
  getServiceJob,
  listServiceJobStatusEvents,
  transitionServiceJob,
  validateCancellationReason,
  type ServiceJobActorRole,
  type ServiceJobDetail,
  type ServiceJobStatus,
  type ServiceJobStatusEvent,
} from './service-jobs-api';

type Props = Readonly<{
  mode: ServiceJobActorRole;
  fallback: '/jobs' | '/technician/jobs';
}>;

export function ServiceJobDetailScreen({ mode, fallback }: Props) {
  const router = useRouter();
  const { jobId } = useLocalSearchParams<{ jobId?: string }>();
  const { client } = useSession();
  const [job, setJob] = useState<ServiceJobDetail | null>(null);
  const [events, setEvents] = useState<readonly ServiceJobStatusEvent[]>([]);
  const [reason, setReason] = useState('');
  const [showReasonError, setShowReasonError] = useState(false);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState<'transition' | 'cancel' | null>(null);
  const styles = createStyles(useAppFontFamilies());

  const load = useCallback(async () => {
    if (!client || !jobId) {
      setState('error');
      return;
    }
    setState('loading');
    try {
      const [nextJob, nextEvents] = await Promise.all([
        getServiceJob(client, jobId),
        listServiceJobStatusEvents(client, jobId),
      ]);
      if (nextJob.actor_role !== mode) throw new Error('actor_role_mismatch');
      setJob(nextJob);
      setEvents(nextEvents);
      setReason('');
      setShowReasonError(false);
      setState('ready');
    } catch {
      setState('error');
    }
  }, [client, jobId, mode]);

  useFocusEffect(useCallback(() => void load(), [load]));

  const nextStatus =
    job && mode === 'technician'
      ? getNextTechnicianStatus(job.job_status)
      : null;
  const cancellationAllowed = job
    ? canCancelServiceJob(mode, job.job_status)
    : false;
  const validReason = useMemo(
    () => validateCancellationReason(reason),
    [reason],
  );

  function askToTransition(newStatus: ServiceJobStatus) {
    if (!job || busy) return;
    Alert.alert(copy.confirmTransitionTitle, copy.confirmTransitionBody, [
      { text: copy.keepReviewing, style: 'cancel' },
      { text: copy.confirm, onPress: () => void updateStatus(newStatus) },
    ]);
  }

  async function updateStatus(newStatus: ServiceJobStatus) {
    if (!client || !job || busy) return;
    setBusy('transition');
    try {
      await transitionServiceJob(client, job.job_id, job.job_status, newStatus);
      await load();
    } catch {
      Alert.alert(copy.transitionFailed);
    } finally {
      setBusy(null);
    }
  }

  function askToCancel() {
    setShowReasonError(true);
    if (!validReason || !job || busy) return;
    Alert.alert(copy.cancelConfirmTitle, copy.cancelConfirmBody, [
      { text: copy.keepJob, style: 'cancel' },
      {
        text: copy.confirmCancel,
        style: 'destructive',
        onPress: () => void cancelJob(validReason),
      },
    ]);
  }

  async function cancelJob(cancellationReason: string) {
    if (!client || !job || busy) return;
    setBusy('cancel');
    try {
      await transitionServiceJob(
        client,
        job.job_id,
        job.job_status,
        'cancelled',
        cancellationReason,
      );
      await load();
    } catch {
      Alert.alert(copy.cancelFailed);
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
            onPress={() => goBackOrReplace(router, fallback as never)}
            style={styles.backButton}
          >
            <Text style={styles.backText}>{copy.back}</Text>
          </Pressable>
          <Text accessibilityRole="header" style={styles.title}>
            {copy.title}
          </Text>

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
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryText}>{copy.retry}</Text>
              </Pressable>
            </View>
          ) : null}

          {state === 'ready' && job ? (
            <>
              <View style={styles.summaryCard}>
                <Text selectable style={styles.jobNumber}>
                  {job.job_number}
                </Text>
                <Text style={styles.cardTitle}>
                  {job.item_name_th ?? copy.symptomRequest}
                </Text>
                <Text style={styles.meta}>{job.category_name_th}</Text>
                <Text
                  style={[
                    styles.status,
                    job.job_status === 'cancelled' && styles.cancelled,
                  ]}
                >
                  {serviceJobsCopyTh.statusLabels[job.job_status]}
                </Text>
              </View>

              <View style={styles.chatSection}>
                <Text style={styles.sectionDescription}>
                  {copy.chatDescription}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname:
                        mode === 'customer'
                          ? ('/jobs/chat' as never)
                          : ('/technician/jobs/chat' as never),
                      params: { jobId: job.job_id },
                    })
                  }
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.secondaryText}>
                    {mode === 'customer'
                      ? copy.chatCustomer
                      : copy.chatTechnician}
                  </Text>
                </Pressable>
              </View>

              <Section title={copy.appointmentTitle} styles={styles}>
                <Text style={styles.cardTitle}>
                  {formatPreferredDateTh(job.appointment_date) ??
                    job.appointment_date}{' '}
                  · {job.appointment_time_window}
                </Text>
                <Text style={styles.body}>{job.location_label}</Text>
                <Text style={styles.body}>{formatAddress(job)}</Text>
                {job.access_instructions ? (
                  <>
                    <Text style={styles.supportTitle}>
                      {copy.accessInstructions}
                    </Text>
                    <Text style={styles.body}>{job.access_instructions}</Text>
                  </>
                ) : null}
              </Section>

              <Section title={copy.scopeTitle} styles={styles}>
                <Text style={styles.body}>{job.scope_description}</Text>
                <Text style={styles.supportText}>
                  {job.warranty_days === null
                    ? copy.noWarranty
                    : copy.warranty(job.warranty_days)}
                </Text>
              </Section>

              <Section title={copy.priceTitle} styles={styles}>
                <Text style={styles.body}>
                  {mode === 'customer'
                    ? copy.customerAmount(
                        formatMoney(job.total_amount, job.currency),
                      )
                    : copy.technicianAmount(
                        formatMoney(job.labor_amount, job.currency),
                        formatMoney(job.commission_amount, job.currency),
                        formatMoney(
                          job.technician_net_labor_amount,
                          job.currency,
                        ),
                      )}
                </Text>
                {job.materials_amount > 0 ? (
                  <Text style={styles.supportText}>
                    {copy.materialsAmount(
                      formatMoney(job.materials_amount, job.currency),
                    )}
                  </Text>
                ) : null}
              </Section>

              <Text style={styles.sectionTitle}>{copy.statusTitle}</Text>
              {nextStatus ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: busy !== null }}
                  disabled={busy !== null}
                  onPress={() => askToTransition(nextStatus)}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    busy !== null && styles.disabled,
                    pressed && styles.pressed,
                  ]}
                >
                  {busy === 'transition' ? (
                    <ActivityIndicator color={colors.surface} />
                  ) : (
                    <Text style={styles.primaryText}>
                      {
                        copy.nextActions[
                          nextStatus as keyof typeof copy.nextActions
                        ]
                      }
                    </Text>
                  )}
                </Pressable>
              ) : null}

              {cancellationAllowed ? (
                <View style={styles.cancelSection}>
                  <Text style={styles.sectionTitle}>{copy.cancelTitle}</Text>
                  <Text style={styles.sectionDescription}>
                    {copy.cancelDescription}
                  </Text>
                  <Text style={styles.label}>{copy.cancelReasonLabel}</Text>
                  <TextInput
                    accessibilityLabel={copy.cancelReasonLabel}
                    maxLength={500}
                    multiline
                    onChangeText={setReason}
                    placeholder={copy.cancelReasonPlaceholder}
                    placeholderTextColor={colors.textMuted}
                    style={[
                      styles.reasonInput,
                      showReasonError && !validReason && styles.inputError,
                    ]}
                    textAlignVertical="top"
                    value={reason}
                  />
                  {showReasonError && !validReason ? (
                    <Text style={styles.error}>{copy.cancelReasonInvalid}</Text>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: busy !== null }}
                    disabled={busy !== null}
                    onPress={askToCancel}
                    style={({ pressed }) => [
                      styles.dangerButton,
                      busy !== null && styles.disabled,
                      pressed && styles.pressed,
                    ]}
                  >
                    {busy === 'cancel' ? (
                      <ActivityIndicator color={colors.danger} />
                    ) : (
                      <Text style={styles.dangerText}>{copy.cancelButton}</Text>
                    )}
                  </Pressable>
                </View>
              ) : job.job_status !== 'cancelled' ? (
                <Text style={styles.lockedNotice}>
                  {mode === 'customer'
                    ? copy.cancellationLockedCustomer
                    : copy.cancellationLockedTechnician}
                </Text>
              ) : null}

              <Text style={styles.sectionTitle}>{copy.historyTitle}</Text>
              <View style={styles.historyList}>
                {events.map((event) => (
                  <View key={event.event_id} style={styles.historyItem}>
                    <Text style={styles.historyStatus}>
                      {event.from_status === null
                        ? copy.initialEvent
                        : serviceJobsCopyTh.statusLabels[event.to_status]}
                    </Text>
                    <Text style={styles.supportText}>
                      {formatTimestamp(event.created_at)}
                    </Text>
                    {event.actor_display_name ? (
                      <Text style={styles.supportText}>
                        {copy.changedBy(event.actor_display_name)}
                      </Text>
                    ) : null}
                    {event.reason ? (
                      <Text style={styles.reason}>{event.reason}</Text>
                    ) : null}
                  </View>
                ))}
              </View>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Section({
  title,
  children,
  styles,
}: Readonly<{
  title: string;
  children: ReactNode;
  styles: ReturnType<typeof createStyles>;
}>) {
  return (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatAddress(job: ServiceJobDetail) {
  return [
    job.address_line,
    job.building,
    job.floor ? `ชั้น ${job.floor}` : null,
    job.unit ? `ห้อง/ยูนิต ${job.unit}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
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
    loader: { marginTop: spacing.xxl },
    errorGroup: { gap: spacing.md, marginTop: spacing.xl },
    error: {
      color: colors.danger,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      marginTop: spacing.sm,
    },
    summaryCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      marginTop: spacing.xl,
      padding: spacing.lg,
    },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      marginTop: spacing.md,
      padding: spacing.lg,
    },
    jobNumber: {
      color: colors.primary,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
    },
    cardTitle: {
      color: colors.text,
      fontFamily: fonts.bold,
      fontSize: typography.bodySize,
      lineHeight: 24,
      marginTop: spacing.xs,
    },
    meta: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      marginTop: spacing.xs,
    },
    status: {
      color: colors.success,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
      marginTop: spacing.md,
    },
    cancelled: { color: colors.danger },
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
      marginTop: spacing.xs,
    },
    body: {
      color: colors.text,
      fontFamily: fonts.regular,
      fontSize: typography.bodySize,
      lineHeight: 25,
    },
    supportTitle: {
      color: colors.text,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
      marginTop: spacing.lg,
    },
    supportText: {
      color: colors.textMuted,
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
      minHeight: 48,
      paddingHorizontal: spacing.lg,
    },
    secondaryText: {
      color: colors.action,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
    },
    chatSection: { gap: spacing.md, marginTop: spacing.lg },
    cancelSection: { marginTop: spacing.sm },
    label: {
      color: colors.text,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
      marginTop: spacing.lg,
    },
    reasonInput: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.button,
      borderWidth: 1,
      color: colors.text,
      fontFamily: fonts.regular,
      fontSize: typography.bodySize,
      minHeight: 120,
      marginTop: spacing.sm,
      padding: spacing.lg,
    },
    inputError: { borderColor: colors.danger },
    dangerButton: {
      alignItems: 'center',
      borderColor: colors.danger,
      borderRadius: radii.button,
      borderWidth: 1,
      justifyContent: 'center',
      marginTop: spacing.lg,
      minHeight: 48,
      paddingHorizontal: spacing.lg,
    },
    dangerText: {
      color: colors.danger,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
    },
    lockedNotice: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      lineHeight: 21,
      marginTop: spacing.xl,
    },
    historyList: { gap: spacing.md, marginTop: spacing.md },
    historyItem: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.button,
      borderWidth: 1,
      padding: spacing.lg,
    },
    historyStatus: {
      color: colors.text,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
    },
    reason: {
      color: colors.text,
      fontFamily: fonts.regular,
      fontSize: typography.bodySize,
      lineHeight: 24,
      marginTop: spacing.md,
    },
    disabled: { opacity: 0.5 },
    pressed: { opacity: 0.76 },
  });
}
