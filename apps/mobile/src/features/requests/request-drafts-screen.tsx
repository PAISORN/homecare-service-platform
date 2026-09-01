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
import { serviceRequestCopyTh as copy } from '../../locales/th';
import { useSession } from '../../providers/session-provider';
import {
  listOwnRequestDrafts,
  type ServiceRequestDraft,
} from './service-request-api';

export function RequestDraftsScreen() {
  const router = useRouter();
  const { client } = useSession();
  const [drafts, setDrafts] = useState<readonly ServiceRequestDraft[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const styles = createStyles(useAppFontFamilies());

  const load = useCallback(() => {
    if (!client) return;
    setState('loading');
    void listOwnRequestDrafts(client)
      .then((data) => {
        setDrafts(data);
        setState('ready');
      })
      .catch(() => setState('error'));
  }, [client]);

  useFocusEffect(useCallback(() => load(), [load]));

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
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
          {drafts.map((draft) => (
            <Pressable
              accessibilityRole="button"
              key={draft.id}
              onPress={() =>
                router.push({
                  pathname: '/requests/edit',
                  params: { requestId: draft.id },
                })
              }
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
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
              {draft.safety_status === 'stopped' ? (
                <Text style={styles.safetyBadge}>{copy.safetyStopTitle}</Text>
              ) : null}
              <Text style={styles.edit}>{copy.editDraft}</Text>
            </Pressable>
          ))}
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
      marginTop: spacing.md,
    },
    pressed: { opacity: 0.76 },
  });
}
