import { colors, radii, spacing, typography } from '@homecare/design-tokens';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppFontFamilies } from '../../foundation/font-runtime';
import { serviceRequestCopyTh as copy } from '../../locales/th';
import { useSession } from '../../providers/session-provider';
import { goBackOrReplace } from '../shared/navigation';
import { formatDraftScheduleTh } from './preferred-date';
import {
  cancelOwnMatchingRequest,
  listOwnServiceRequests,
  submitOwnServiceRequest,
  type ServiceRequestDraft,
} from './service-request-api';

export function RequestDraftsScreen() {
  const router = useRouter();
  const { client } = useSession();
  const [drafts, setDrafts] = useState<readonly ServiceRequestDraft[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);
  const styles = createStyles(useAppFontFamilies());

  const load = useCallback(() => {
    if (!client) return;
    setState('loading');
    void listOwnServiceRequests(client)
      .then((data) => {
        setDrafts(data);
        setState('ready');
      })
      .catch(() => setState('error'));
  }, [client]);

  useFocusEffect(useCallback(() => load(), [load]));

  function confirmSubmit(requestId: string) {
    Alert.alert(copy.submitTitle, copy.submitBody, [
      { text: copy.cancel, style: 'cancel' },
      {
        text: copy.confirmSubmit,
        onPress: () => void changeRequestStatus(requestId, 'submit'),
      },
    ]);
  }

  function confirmCancel(requestId: string) {
    Alert.alert(copy.cancelRequestTitle, copy.cancelRequestBody, [
      { text: copy.keepRequest, style: 'cancel' },
      {
        text: copy.confirmCancelRequest,
        style: 'destructive',
        onPress: () => void changeRequestStatus(requestId, 'cancel'),
      },
    ]);
  }

  async function changeRequestStatus(
    requestId: string,
    action: 'submit' | 'cancel',
  ) {
    if (!client || busyRequestId) return;
    setBusyRequestId(requestId);
    try {
      if (action === 'submit') {
        await submitOwnServiceRequest(client, requestId);
      } else {
        await cancelOwnMatchingRequest(client, requestId);
      }
      load();
    } catch {
      Alert.alert(copy.actionFailedTitle, copy.actionFailedBody);
    } finally {
      setBusyRequestId(null);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          accessibilityRole="button"
          onPress={() => goBackOrReplace(router, '/')}
          style={styles.backButton}
        >
          <Text style={styles.backText}>{copy.back}</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>
          {copy.draftsTitle}
        </Text>
        <Text style={styles.description}>{copy.draftsDescription}</Text>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/requests/catalog')}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryText}>{copy.newCatalogRequest}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.push({
                pathname: '/requests/catalog',
                params: { entryPoint: 'symptom' },
              })
            }
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryText}>{copy.newSymptomRequest}</Text>
          </Pressable>
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
              onPress={load}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryText}>{copy.retry}</Text>
            </Pressable>
          </View>
        ) : null}
        {state === 'ready' && drafts.length === 0 ? (
          <Text style={styles.empty}>{copy.emptyDrafts}</Text>
        ) : null}
        <View style={styles.list}>
          {drafts.map((draft) => {
            const schedule = formatDraftScheduleTh(
              draft.preferred_date,
              draft.preferred_time_window,
            );
            return (
              <View key={draft.id} style={styles.card}>
                <Text style={styles.cardTitle}>
                  {draft.service_items?.name_th ??
                    draft.service_categories?.name_th ??
                    copy.newSymptomRequest}
                </Text>
                <Text numberOfLines={2} style={styles.cardDescription}>
                  {draft.problem_description}
                </Text>
                <Text style={styles.meta}>
                  {draft.service_locations?.label ?? ''} ·{' '}
                  {copy.urgency[draft.urgency]}
                </Text>
                {schedule ? (
                  <Text style={styles.schedule}>{schedule}</Text>
                ) : null}
                {draft.safety_status === 'stopped' ? (
                  <Text style={styles.safetyBadge}>{copy.safetyStopTitle}</Text>
                ) : null}
                <Text
                  accessibilityRole="text"
                  style={
                    draft.status === 'technician_selected'
                      ? styles.selectedBadge
                      : draft.status === 'matching'
                        ? styles.matchingBadge
                        : styles.draftBadge
                  }
                >
                  {draft.status === 'technician_selected'
                    ? copy.technicianSelectedStatus
                    : draft.status === 'matching'
                      ? copy.matchingStatus
                      : copy.draftStatus}
                </Text>
                <View style={styles.cardActions}>
                  {draft.status === 'draft' ? (
                    <>
                      <Pressable
                        accessibilityRole="button"
                        disabled={busyRequestId !== null}
                        onPress={() =>
                          router.push({
                            pathname: '/requests/edit',
                            params: { requestId: draft.id },
                          })
                        }
                        style={({ pressed }) => [
                          styles.cardSecondaryButton,
                          busyRequestId !== null && styles.disabled,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={styles.edit}>{copy.editDraft}</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        disabled={busyRequestId !== null}
                        onPress={() => confirmSubmit(draft.id)}
                        style={({ pressed }) => [
                          styles.cardPrimaryButton,
                          busyRequestId !== null && styles.disabled,
                          pressed && styles.pressed,
                        ]}
                      >
                        {busyRequestId === draft.id ? (
                          <ActivityIndicator color={colors.surface} />
                        ) : (
                          <Text style={styles.cardPrimaryText}>
                            {copy.submitRequest}
                          </Text>
                        )}
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <Pressable
                        accessibilityRole="button"
                        disabled={busyRequestId !== null}
                        onPress={() =>
                          router.push({
                            pathname: '/requests/shortlist' as never,
                            params: { requestId: draft.id },
                          })
                        }
                        style={({ pressed }) => [
                          styles.cardPrimaryButton,
                          busyRequestId !== null && styles.disabled,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={styles.cardPrimaryText}>
                          {draft.status === 'technician_selected'
                            ? copy.viewSelectedTechnician
                            : copy.viewShortlist}
                        </Text>
                      </Pressable>
                      {draft.status === 'matching' ? (
                        <Pressable
                          accessibilityRole="button"
                          disabled={busyRequestId !== null}
                          onPress={() => confirmCancel(draft.id)}
                          style={({ pressed }) => [
                            styles.cardSecondaryButton,
                            busyRequestId !== null && styles.disabled,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text style={styles.cancelRequestText}>
                            {copy.cancelRequest}
                          </Text>
                        </Pressable>
                      ) : null}
                    </>
                  )}
                </View>
              </View>
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
      minHeight: 44,
      justifyContent: 'center',
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
    actions: { gap: spacing.md, marginTop: spacing.xl },
    primaryButton: {
      alignItems: 'center',
      backgroundColor: colors.action,
      borderRadius: radii.button,
      justifyContent: 'center',
      minHeight: 52,
      padding: spacing.md,
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
      minHeight: 52,
      padding: spacing.md,
    },
    secondaryText: {
      color: colors.action,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
    },
    loader: { marginTop: spacing.xxl },
    error: {
      color: colors.danger,
      fontFamily: fonts.regular,
      fontSize: typography.bodySize,
      marginTop: spacing.xl,
    },
    errorGroup: { gap: spacing.md, marginTop: spacing.xl },
    empty: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.bodySize,
      marginTop: spacing.xl,
    },
    list: { gap: spacing.md, marginTop: spacing.xl },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      padding: spacing.lg,
    },
    cardTitle: {
      color: colors.text,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
    },
    cardDescription: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      lineHeight: 20,
      marginTop: spacing.sm,
    },
    meta: {
      color: colors.primary,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
      marginTop: spacing.md,
    },
    schedule: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      marginTop: spacing.xs,
    },
    safetyBadge: {
      color: colors.danger,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
      marginTop: spacing.sm,
    },
    edit: {
      color: colors.action,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
    },
    draftBadge: {
      alignSelf: 'flex-start',
      color: colors.textMuted,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
      marginTop: spacing.md,
    },
    matchingBadge: {
      alignSelf: 'flex-start',
      color: colors.success,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
      marginTop: spacing.md,
    },
    selectedBadge: {
      alignSelf: 'flex-start',
      color: colors.action,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
      marginTop: spacing.md,
    },
    cardActions: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    cardSecondaryButton: {
      alignItems: 'center',
      borderColor: colors.border,
      borderRadius: radii.button,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: spacing.lg,
    },
    cardPrimaryButton: {
      alignItems: 'center',
      backgroundColor: colors.action,
      borderRadius: radii.button,
      flex: 1,
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: spacing.lg,
    },
    cardPrimaryText: {
      color: colors.surface,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
    },
    cancelRequestText: {
      color: colors.danger,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
    },
    disabled: { opacity: 0.5 },
    pressed: { opacity: 0.76 },
  });
}
