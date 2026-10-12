import { colors, radii, spacing, typography } from '@homecare/design-tokens';
import {
  Redirect,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { Check, MapPin, CalendarBlank } from 'phosphor-react-native';
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
import {
  serviceRequestCopyTh as requestCopy,
  requestSavedCopyTh as copy,
} from '../../locales/th';
import { useSession } from '../../providers/session-provider';
import { formatDraftScheduleTh } from './preferred-date';
import {
  getOwnRequestDraft,
  type ServiceRequestDraft,
} from './service-request-api';

export function RequestSavedScreen() {
  const { requestId } = useLocalSearchParams<{ requestId?: string }>();
  const { client } = useSession();
  const router = useRouter();
  const [draft, setDraft] = useState<ServiceRequestDraft | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const styles = createStyles(useAppFontFamilies());
  useFocusEffect(
    useCallback(() => {
      if (!client || !requestId) return;
      let current = true;
      setState('loading');
      void getOwnRequestDraft(client, requestId)
        .then((data) => {
          if (current) {
            setDraft(data);
            setState(data ? 'ready' : 'error');
          }
        })
        .catch(() => {
          if (current) setState('error');
        });
      return () => {
        current = false;
      };
    }, [client, requestId]),
  );
  if (!requestId) return <Redirect href="/requests" />;
  const schedule = draft
    ? formatDraftScheduleTh(draft.preferred_date, draft.preferred_time_window)
    : null;
  return (
    <SafeAreaView testID="request-saved" style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        {state === 'loading' ? (
          <ActivityIndicator
            accessibilityLabel="กำลังตรวจสอบแบบร่างที่บันทึก"
            color={colors.action}
          />
        ) : null}
        {state === 'error' ? (
          <Text accessibilityLiveRegion="polite" style={styles.body}>
            {copy.loadFailed}
          </Text>
        ) : null}
        {state === 'ready' && draft ? (
          <>
            <View style={styles.check}>
              <Check size={48} weight="bold" color={colors.surface} />
            </View>
            <Text accessibilityRole="header" style={styles.title}>
              {draft.status === 'draft' ? copy.title : copy.updatedTitle}
            </Text>
            <Text style={styles.body}>
              {draft.status === 'draft'
                ? copy.description
                : copy.updatedDescription}
            </Text>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {draft.service_items?.name_th ??
                  draft.service_categories?.name_th}
              </Text>
              <Text style={styles.cardBody}>{draft.problem_description}</Text>
              <Text style={styles.cardBody}>
                จำนวน {draft.quantity} · {requestCopy.urgency[draft.urgency]}
              </Text>
              <View style={styles.row}>
                <MapPin size={20} color={colors.primary} />
                <Text style={styles.meta}>
                  {draft.service_locations?.label}
                </Text>
              </View>
              {schedule ? (
                <View style={styles.row}>
                  <CalendarBlank size={20} color={colors.primary} />
                  <Text style={styles.meta}>{schedule}</Text>
                </View>
              ) : null}
            </View>
            {draft.status === 'draft' ? (
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  router.replace({
                    pathname: '/requests/edit',
                    params: { requestId },
                  })
                }
                style={styles.secondary}
              >
                <Text style={styles.secondaryText}>
                  {requestCopy.editDraft}
                </Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
        {state !== 'loading' ? (
          <>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace('/requests')}
              style={styles.primary}
            >
              <Text style={styles.primaryText}>{copy.viewRequests}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace('/')}
              style={styles.home}
            >
              <Text style={styles.secondaryText}>{copy.backHome}</Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(fonts: ReturnType<typeof useAppFontFamilies>) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    content: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: spacing.lg,
      paddingVertical: spacing.xxl,
    },
    check: {
      alignSelf: 'center',
      width: 100,
      height: 100,
      backgroundColor: colors.primary,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.lg,
    },
    title: {
      color: colors.text,
      fontFamily: fonts.bold,
      fontSize: typography.pageTitleSize,
      textAlign: 'center',
    },
    body: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.bodySize,
      lineHeight: 24,
      textAlign: 'center',
      marginTop: spacing.sm,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      marginVertical: spacing.xl,
      gap: spacing.sm,
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
    },
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
    meta: {
      flex: 1,
      color: colors.primary,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      lineHeight: 21,
    },
    primary: {
      backgroundColor: colors.action,
      borderRadius: radii.button,
      minHeight: 52,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.md,
      padding: spacing.md,
    },
    primaryText: {
      color: colors.surface,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
    },
    secondary: {
      borderWidth: 1,
      borderColor: colors.action,
      borderRadius: radii.button,
      minHeight: 52,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.md,
    },
    secondaryText: {
      color: colors.primary,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
    },
    home: {
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.sm,
    },
  });
}
