import { colors, radii, spacing, typography } from '@homecare/design-tokens';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppFontFamilies } from '../../foundation/font-runtime';
import { serviceJobsCopyTh as copy } from '../../locales/th';
import { useSession } from '../../providers/session-provider';
import { formatPreferredDateTh } from '../requests/preferred-date';
import { goBackOrReplace } from '../shared/navigation';
import {
  listServiceJobs,
  type ServiceJobActorRole,
  type ServiceJobListItem,
} from './service-jobs-api';

type Props = Readonly<{
  mode: ServiceJobActorRole;
  fallback: '/home' | '/technician/feed';
}>;

export function ServiceJobsScreen({ mode, fallback }: Props) {
  const router = useRouter();
  const { client } = useSession();
  const [jobs, setJobs] = useState<readonly ServiceJobListItem[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const styles = createStyles(useAppFontFamilies());

  const load = useCallback(async () => {
    if (!client) return;
    setState('loading');
    try {
      const next = await listServiceJobs(client);
      setJobs(next.filter((job) => job.actor_role === mode));
      setState('ready');
    } catch {
      setState('error');
    }
  }, [client, mode]);

  useFocusEffect(useCallback(() => void load(), [load]));

  const title = mode === 'customer' ? copy.customerTitle : copy.technicianTitle;
  const description =
    mode === 'customer' ? copy.customerDescription : copy.technicianDescription;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          accessibilityRole="button"
          onPress={() => goBackOrReplace(router, fallback as never)}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.backText}>{copy.back}</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        <Text style={styles.description}>{description}</Text>

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
        {state === 'ready' && jobs.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              {mode === 'customer' ? copy.emptyCustomer : copy.emptyTechnician}
            </Text>
          </View>
        ) : null}

        <View style={styles.list}>
          {jobs.map((job) => {
            const path =
              mode === 'customer' ? '/jobs/detail' : '/technician/jobs/detail';
            const date =
              formatPreferredDateTh(job.appointment_date, 'short') ??
              job.appointment_date;
            return (
              <Pressable
                accessibilityRole="button"
                key={job.job_id}
                onPress={() =>
                  router.push({
                    pathname: path as never,
                    params: { jobId: job.job_id },
                  })
                }
                style={({ pressed }) => [
                  styles.card,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.cardHeader}>
                  <Text selectable style={styles.jobNumber}>
                    {job.job_number}
                  </Text>
                  <Text
                    style={[
                      styles.status,
                      job.job_status === 'cancelled' && styles.cancelled,
                    ]}
                  >
                    {copy.statusLabels[job.job_status]}
                  </Text>
                </View>
                <Text style={styles.cardTitle}>
                  {job.item_name_th ?? copy.symptomRequest}
                </Text>
                <Text style={styles.meta}>{job.category_name_th}</Text>
                <Text style={styles.meta}>
                  {mode === 'customer'
                    ? copy.counterpartTechnician(job.counterpart_display_name)
                    : copy.counterpartCustomer(job.counterpart_display_name)}
                </Text>
                <Text style={styles.meta}>
                  {copy.appointment(date, job.appointment_time_window)}
                </Text>
                <Text style={styles.meta}>{job.location_label}</Text>
                <Text style={styles.open}>{copy.open}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(fonts: ReturnType<typeof useAppFontFamilies>) {
  return StyleSheet.create({
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
    errorGroup: { gap: spacing.md, marginTop: spacing.xl },
    error: {
      color: colors.danger,
      fontFamily: fonts.regular,
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
    emptyCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      marginTop: spacing.xl,
      padding: spacing.xl,
    },
    emptyText: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.bodySize,
      lineHeight: 24,
      textAlign: 'center',
    },
    list: { gap: spacing.md, marginTop: spacing.xl },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      padding: spacing.lg,
    },
    cardHeader: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: spacing.sm,
      justifyContent: 'space-between',
    },
    jobNumber: {
      color: colors.primary,
      flex: 1,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
    },
    status: {
      color: colors.success,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
      textAlign: 'right',
    },
    cancelled: { color: colors.danger },
    cardTitle: {
      color: colors.text,
      fontFamily: fonts.bold,
      fontSize: typography.bodySize,
      marginTop: spacing.md,
    },
    meta: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      lineHeight: 21,
      marginTop: spacing.xs,
    },
    open: {
      color: colors.action,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
      marginTop: spacing.lg,
    },
    pressed: { opacity: 0.76 },
  });
}
