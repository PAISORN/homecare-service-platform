import { colors, radii, spacing, typography } from '@homecare/design-tokens';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
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
import { technicianMatchingCopyTh as copy } from '../../locales/th';
import { useSession } from '../../providers/session-provider';
import { canUseTechnicianMode } from '../account/account-api';
import {
  listTechnicianSelectedRequests,
  type TechnicianSelectedRequest,
} from '../agreements/service-agreement-api';
import {
  formatDraftScheduleTh,
  formatPreferredDateTh,
} from '../requests/preferred-date';
import { goBackOrReplace } from '../shared/navigation';
import {
  expressTechnicianInterest,
  getMatchingPriceLabel,
  listTechnicianMatchingRequests,
  listTechnicianSkillCategories,
  setTechnicianSkillCategory,
  type TechnicianMatchingRequest,
  type TechnicianSkillCategory,
  withdrawTechnicianInterest,
} from './technician-matching-api';

export function TechnicianMatchingScreen() {
  const router = useRouter();
  const { client, session, technicianApplication } = useSession();
  const [requests, setRequests] = useState<
    readonly TechnicianMatchingRequest[]
  >([]);
  const [categories, setCategories] = useState<
    readonly TechnicianSkillCategory[]
  >([]);
  const [selectedRequests, setSelectedRequests] = useState<
    readonly TechnicianSelectedRequest[]
  >([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busyId, setBusyId] = useState<string | null>(null);
  const styles = createStyles(useAppFontFamilies());

  const load = useCallback(async () => {
    if (!client || !session) return;
    setState('loading');
    try {
      const [nextRequests, nextCategories, nextSelectedRequests] =
        await Promise.all([
          listTechnicianMatchingRequests(client),
          listTechnicianSkillCategories(client, session.user.id),
          listTechnicianSelectedRequests(client),
        ]);
      setRequests(nextRequests);
      setCategories(nextCategories);
      setSelectedRequests(nextSelectedRequests);
      setState('ready');
    } catch {
      setState('error');
    }
  }, [client, session]);

  useFocusEffect(
    useCallback(() => {
      if (canUseTechnicianMode(technicianApplication)) void load();
    }, [load, technicianApplication]),
  );

  if (!canUseTechnicianMode(technicianApplication)) {
    return <Redirect href="/account" />;
  }

  async function toggleCategory(category: TechnicianSkillCategory) {
    if (!client || !session || busyId) return;
    setBusyId(category.id);
    try {
      await setTechnicianSkillCategory(
        client,
        session.user.id,
        category.id,
        !category.selected,
      );
      await load();
    } catch {
      setState('error');
    } finally {
      setBusyId(null);
    }
  }

  async function toggleInterest(request: TechnicianMatchingRequest) {
    if (!client || busyId) return;
    setBusyId(request.request_id);
    try {
      if (request.interest_status === 'active') {
        await withdrawTechnicianInterest(client, request.request_id);
      } else {
        await expressTechnicianInterest(client, request.request_id);
      }
      await load();
    } catch {
      setState('error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          accessibilityRole="button"
          onPress={() => goBackOrReplace(router, '/account')}
          style={styles.backButton}
        >
          <Text style={styles.backText}>{copy.back}</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>
          {copy.title}
        </Text>
        <Text style={styles.description}>{copy.description}</Text>
        <View style={styles.privacyNotice}>
          <Text style={styles.noticeTitle}>{copy.privacyTitle}</Text>
          <Text style={styles.noticeBody}>{copy.privacyBody}</Text>
        </View>

        <Text style={styles.sectionTitle}>{copy.selectedTitle}</Text>
        {state === 'ready' && selectedRequests.length === 0 ? (
          <Text style={styles.empty}>{copy.selectedEmpty}</Text>
        ) : null}
        <View style={styles.requestList}>
          {selectedRequests.map((request) => {
            const date = request.appointment_date
              ? formatPreferredDateTh(request.appointment_date, 'short')
              : null;
            return (
              <View key={request.request_id} style={styles.card}>
                <Text style={styles.cardCategory}>
                  {request.category_name_th}
                </Text>
                <Text style={styles.cardTitle}>
                  {request.item_name_th ?? copy.symptomRequest}
                </Text>
                <Text style={styles.meta}>
                  {copy.selectedCustomer(request.customer_display_name)}
                </Text>
                <Text style={styles.meta}>
                  {date && request.appointment_time_window
                    ? copy.selectedAppointment(
                        date,
                        request.appointment_time_window,
                      )
                    : copy.selectedNoAppointment}
                </Text>
                <Text
                  style={
                    request.fully_confirmed_at
                      ? styles.confirmedText
                      : styles.waitingText
                  }
                >
                  {request.fully_confirmed_at
                    ? copy.selectedCompleted
                    : copy.selectedWaiting}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: '/technician/agreement' as never,
                      params: { requestId: request.request_id },
                    })
                  }
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.primaryText}>{copy.openAgreement}</Text>
                </Pressable>
              </View>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>{copy.skillsTitle}</Text>
        <Text style={styles.sectionDescription}>{copy.skillsDescription}</Text>
        <View style={styles.categoryList}>
          {categories.map((category) => (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: category.selected }}
              disabled={busyId !== null}
              key={category.id}
              onPress={() => void toggleCategory(category)}
              style={({ pressed }) => [
                styles.categoryButton,
                category.selected && styles.categorySelected,
                busyId !== null && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={
                  category.selected
                    ? styles.categoryTextSelected
                    : styles.categoryText
                }
              >
                {category.name_th}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>{copy.feedTitle}</Text>
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
        {state === 'ready' && requests.length === 0 ? (
          <Text style={styles.empty}>
            {categories.some(({ selected }) => selected)
              ? copy.empty
              : copy.selectSkillFirst}
          </Text>
        ) : null}
        <View style={styles.requestList}>
          {requests.map((request) => {
            const schedule = formatDraftScheduleTh(
              request.preferred_date,
              request.preferred_time_window,
            );
            const interested = request.interest_status === 'active';
            return (
              <View key={request.request_id} style={styles.card}>
                <Text style={styles.cardCategory}>
                  {request.category_name_th}
                </Text>
                <Text style={styles.cardTitle}>
                  {request.item_name_th ?? copy.symptomRequest}
                </Text>
                <Text style={styles.meta}>
                  {copy.quantity(request.quantity)} ·{' '}
                  {copy.urgency[request.urgency]}
                </Text>
                {schedule ? <Text style={styles.meta}>{schedule}</Text> : null}
                <Text style={styles.price}>
                  {getMatchingPriceLabel(request.price_model)}
                </Text>
                {request.quotation_status === 'submitted' ? (
                  <View style={styles.quoteSummary}>
                    <Text style={styles.quoteSummaryTitle}>
                      {copy.quotationSubmitted}
                    </Text>
                    <Text style={styles.quoteSummaryText}>
                      {copy.quotationAmount(
                        request.quotation_labor_amount ?? 0,
                      )}
                    </Text>
                    {request.quotation_scope_description ? (
                      <Text numberOfLines={3} style={styles.quoteSummaryText}>
                        {request.quotation_scope_description}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
                {interested && request.price_model === 'evidence_quote' ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={busyId !== null}
                    onPress={() =>
                      router.push({
                        pathname: '/technician/quote' as never,
                        params: {
                          requestId: request.request_id,
                          scope: request.quotation_scope_description ?? '',
                          amount:
                            request.quotation_labor_amount?.toString() ?? '',
                        },
                      })
                    }
                    style={({ pressed }) => [
                      styles.primaryButton,
                      busyId !== null && styles.disabled,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.primaryText}>
                      {request.quotation_status === 'submitted'
                        ? copy.editQuotation
                        : copy.createQuotation}
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: interested }}
                  disabled={busyId !== null}
                  onPress={() => void toggleInterest(request)}
                  style={({ pressed }) => [
                    interested ? styles.secondaryButton : styles.primaryButton,
                    busyId !== null && styles.disabled,
                    pressed && styles.pressed,
                  ]}
                >
                  {busyId === request.request_id ? (
                    <ActivityIndicator
                      color={interested ? colors.action : colors.surface}
                    />
                  ) : (
                    <Text
                      style={
                        interested ? styles.secondaryText : styles.primaryText
                      }
                    >
                      {interested
                        ? copy.withdrawInterest
                        : copy.expressInterest}
                    </Text>
                  )}
                </Pressable>
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
    privacyNotice: {
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
    categoryList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    categoryButton: {
      borderColor: colors.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: spacing.lg,
    },
    categorySelected: { borderColor: colors.action },
    categoryText: {
      color: colors.text,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
    },
    categoryTextSelected: {
      color: colors.action,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
    },
    loader: { marginTop: spacing.xl },
    errorGroup: { gap: spacing.md, marginTop: spacing.xl },
    error: {
      color: colors.danger,
      fontFamily: fonts.regular,
      fontSize: typography.bodySize,
    },
    empty: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.bodySize,
      lineHeight: 24,
      marginTop: spacing.xl,
    },
    requestList: { gap: spacing.md, marginTop: spacing.lg },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      padding: spacing.lg,
    },
    cardCategory: {
      color: colors.primary,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
    },
    cardTitle: {
      color: colors.text,
      fontFamily: fonts.bold,
      fontSize: typography.bodySize,
      marginTop: spacing.xs,
    },
    meta: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      marginTop: spacing.sm,
    },
    price: {
      color: colors.text,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
      marginTop: spacing.md,
    },
    confirmedText: {
      color: colors.success,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
      marginTop: spacing.md,
    },
    waitingText: {
      color: colors.warning,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
      marginTop: spacing.md,
    },
    quoteSummary: {
      borderColor: colors.border,
      borderRadius: radii.button,
      borderWidth: 1,
      marginTop: spacing.md,
      padding: spacing.md,
    },
    quoteSummaryTitle: {
      color: colors.success,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
    },
    quoteSummaryText: {
      color: colors.text,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      lineHeight: 20,
      marginTop: spacing.xs,
    },
    primaryButton: {
      alignItems: 'center',
      backgroundColor: colors.action,
      borderRadius: radii.button,
      justifyContent: 'center',
      marginTop: spacing.lg,
      minHeight: 48,
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
      marginTop: spacing.lg,
      minHeight: 48,
      paddingHorizontal: spacing.lg,
    },
    secondaryText: {
      color: colors.action,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
    },
    disabled: { opacity: 0.5 },
    pressed: { opacity: 0.76 },
  });
}
