import { colors, radii, spacing, typography } from '@homecare/design-tokens';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { CalendarBlank, Clock, MapPin } from 'phosphor-react-native';
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
import {
  formatPreferredDateTh,
  parsePreferredDate,
} from '../requests/preferred-date';
import { MobileBottomNav } from '../shared/mobile-bottom-nav';
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
  const [filter, setFilter] = useState<'all' | 'active' | 'history'>('all');
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
  const visibleJobs = jobs.filter((job) => {
    const finished =
      job.job_status === 'completed' || job.job_status === 'cancelled';
    return filter === 'all' || (filter === 'history' ? finished : !finished);
  });

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
        <View style={styles.filters}>
          {(
            [
              { key: 'all', label: 'ทั้งหมด' },
              { key: 'active', label: 'กำลังดำเนินการ' },
              { key: 'history', label: 'ประวัติ' },
            ] as const
          ).map((option) => (
            <Pressable
              key={option.key}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === option.key }}
              onPress={() => setFilter(option.key)}
              style={[
                styles.filter,
                filter === option.key && styles.filterSelected,
              ]}
            >
              <Text
                style={[
                  styles.filterText,
                  filter === option.key && styles.filterTextSelected,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

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
        {state === 'ready' && visibleJobs.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              {jobs.length > 0
                ? filter === 'active'
                  ? 'ยังไม่มีงานที่กำลังดำเนินการ'
                  : 'ยังไม่มีงานในประวัติ'
                : mode === 'customer'
                  ? copy.emptyCustomer
                  : copy.emptyTechnician}
            </Text>
          </View>
        ) : null}

        <View style={styles.list}>
          {visibleJobs.map((job) => {
            const path =
              mode === 'customer' ? '/jobs/detail' : '/technician/jobs/detail';
            const date =
              formatPreferredDateTh(job.appointment_date, 'short') ??
              job.appointment_date;
            const appointment = parsePreferredDate(job.appointment_date);
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
                  <View style={styles.dateTile}>
                    {appointment ? (
                      <>
                        <Text style={styles.dateDay}>
                          {appointment.getDate()}
                        </Text>
                        <Text style={styles.dateMonth}>
                          {new Intl.DateTimeFormat('th-TH', {
                            month: 'short',
                          }).format(appointment)}
                        </Text>
                      </>
                    ) : (
                      <CalendarBlank size={28} color={colors.surface} />
                    )}
                  </View>
                  <Text selectable style={styles.jobNumber}>
                    {job.job_number}
                  </Text>
                  <Text
                    style={[
                      styles.status,
                      job.job_status === 'completed' && styles.completed,
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
                <View style={styles.metaRow}>
                  <Clock size={18} color={colors.primary} />
                  <Text style={styles.meta}>
                    {copy.appointment(date, job.appointment_time_window)}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <MapPin size={18} color={colors.textMuted} />
                  <Text style={styles.meta}>{job.location_label}</Text>
                </View>
                <Text style={styles.open}>{copy.open}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      {mode === 'customer' ? <MobileBottomNav active="jobs" /> : null}
    </SafeAreaView>
  );
}

function createStyles(fonts: ReturnType<typeof useAppFontFamilies>) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: 116 },
    filters: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.lg,
    },
    filter: {
      backgroundColor: colors.surfaceMuted,
      minHeight: 44,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.md,
      justifyContent: 'center',
    },
    filterSelected: { backgroundColor: colors.primary },
    filterText: {
      color: colors.textMuted,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
    },
    filterTextSelected: { color: colors.surface },
    dateTile: {
      minWidth: 52,
      padding: spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radii.button,
      backgroundColor: colors.primary,
    },
    dateDay: {
      color: colors.surface,
      fontFamily: fonts.bold,
      fontSize: typography.sectionTitleSize,
    },
    dateMonth: { color: colors.mint, fontFamily: fonts.regular, fontSize: 12 },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
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
      color: colors.primary,
      backgroundColor: colors.mint,
      borderRadius: radii.button,
      padding: spacing.sm,
      flexShrink: 1,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
      textAlign: 'right',
    },
    cancelled: { color: colors.danger },
    completed: { color: colors.success, backgroundColor: colors.surfaceMuted },
    cardTitle: {
      color: colors.text,
      fontFamily: fonts.bold,
      fontSize: typography.bodySize,
      marginTop: spacing.md,
    },
    meta: {
      flexShrink: 1,
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
