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
import { technicianApplicationCopyTh as copy } from '../../locales/th';
import { useSession } from '../../providers/session-provider';
import {
  listOwnTechnicianDocuments,
  selectCurrentRequiredDocument,
  submitTechnicianProfile,
  type TechnicianDocument,
} from './technician-application-api';
import { KYC_NOTICE_VERSION } from './technician-kyc';

export function TechnicianReviewScreen() {
  const router = useRouter();
  const { client, session, technicianApplication, refreshAccount } =
    useSession();
  const [documents, setDocuments] = useState<TechnicianDocument[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [error, setError] = useState<string | null>(null);
  const styles = createStyles(useAppFontFamilies());

  const refresh = useCallback(async () => {
    if (!client || !session) return;
    setLoadState('loading');
    try {
      setDocuments(await listOwnTechnicianDocuments(client, session.user.id));
      setError(null);
      setLoadState('ready');
    } catch {
      setError(copy.refreshFailed);
      setLoadState('error');
    }
  }, [client, session]);

  useFocusEffect(
    useCallback(() => {
      setAcknowledged(false);
      void refresh();
    }, [refresh]),
  );

  const nationalId = selectCurrentRequiredDocument(documents, 'national_id');
  const selfie = selectCurrentRequiredDocument(documents, 'selfie');
  const documentsReady =
    nationalId?.is_uploaded === true && selfie?.is_uploaded === true;
  const noticeAcknowledged =
    technicianApplication?.kyc_notice_version === KYC_NOTICE_VERSION &&
    technicianApplication.kyc_notice_acknowledged_at !== null;
  const canSubmit =
    technicianApplication?.verification_status === 'draft' &&
    noticeAcknowledged &&
    loadState === 'ready' &&
    documentsReady &&
    acknowledged &&
    !loading;

  async function submit() {
    if (!client || !canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      await submitTechnicianProfile(client);
      await refreshAccount();
      router.replace('/technician/application');
    } catch {
      setError(copy.submitFailed);
      await refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.topBackButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.backText}>{copy.back}</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>
          {copy.reviewTitle}
        </Text>
        <Text style={styles.description}>{copy.reviewDescription}</Text>
        {loadState === 'loading' ? (
          <View style={styles.card}>
            <ActivityIndicator color={colors.action} />
            <Text accessibilityLiveRegion="polite" style={styles.noticeBody}>
              {copy.loadingDocuments}
            </Text>
          </View>
        ) : loadState === 'error' ? (
          <View style={styles.card}>
            <Text accessibilityLiveRegion="polite" style={styles.error}>
              {copy.refreshFailed}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void refresh()}
              style={({ pressed }) => [
                styles.retryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.backText}>{copy.retry}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <DocumentState
                label={copy.nationalId}
                ready={nationalId?.is_uploaded === true}
                styles={styles}
              />
              <DocumentState
                label={copy.selfie}
                ready={selfie?.is_uploaded === true}
                styles={styles}
              />
              {!documentsReady ? (
                <Text style={styles.warning}>{copy.notReady}</Text>
              ) : null}
            </View>
            <View style={styles.notice}>
              <Text style={styles.cardTitle}>{copy.retentionTitle}</Text>
              <Text style={styles.noticeBody}>{copy.retentionNotice}</Text>
            </View>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: acknowledged }}
              disabled={!documentsReady || loading}
              onPress={() => setAcknowledged((value) => !value)}
              style={({ pressed }) => [
                styles.acknowledgement,
                (!documentsReady || loading) && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.ackStatus}>
                {acknowledged ? copy.acknowledged : copy.notAcknowledged}
              </Text>
              <Text style={styles.ackBody}>{copy.acknowledgement}</Text>
            </Pressable>
          </>
        )}
        {error && loadState !== 'error' ? (
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {error}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          disabled={!canSubmit}
          onPress={() => void submit()}
          style={({ pressed }) => [
            styles.primaryButton,
            !canSubmit && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          {loading ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Text style={styles.primaryText}>{copy.submit}</Text>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.backText}>{copy.back}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function DocumentState({
  label,
  ready,
  styles,
}: {
  label: string;
  ready: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.documentRow}>
      <Text style={styles.documentLabel}>{label}</Text>
      <Text style={ready ? styles.ready : styles.missing}>
        {ready ? copy.uploaded : copy.missing}
      </Text>
    </View>
  );
}

function createStyles(fonts: ReturnType<typeof useAppFontFamilies>) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl },
    topBackButton: {
      alignItems: 'flex-start',
      justifyContent: 'center',
      minHeight: 44,
      marginBottom: spacing.sm,
    },
    title: {
      color: colors.text,
      fontFamily: fonts.bold,
      fontSize: typography.pageTitleSize,
      lineHeight: 42,
    },
    description: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.bodySize,
      lineHeight: 24,
      marginTop: spacing.sm,
    },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      marginTop: spacing.xl,
      padding: spacing.lg,
    },
    cardTitle: {
      color: colors.text,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
    },
    documentRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      minHeight: 44,
    },
    documentLabel: {
      color: colors.text,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
    },
    ready: {
      color: colors.success,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
    },
    missing: {
      color: colors.warning,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
    },
    warning: {
      color: colors.warning,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      lineHeight: 21,
      marginTop: spacing.sm,
    },
    notice: {
      backgroundColor: colors.surface,
      borderColor: colors.warning,
      borderRadius: radii.card,
      borderWidth: 1,
      marginTop: spacing.xl,
      padding: spacing.lg,
    },
    noticeBody: {
      color: colors.text,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      lineHeight: 21,
      marginTop: spacing.sm,
    },
    acknowledgement: {
      backgroundColor: colors.surface,
      borderColor: colors.action,
      borderRadius: radii.button,
      borderWidth: 1,
      marginTop: spacing.lg,
      minHeight: 72,
      padding: spacing.lg,
    },
    ackStatus: {
      color: colors.action,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
    },
    ackBody: {
      color: colors.text,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      lineHeight: 21,
      marginTop: spacing.xs,
    },
    primaryButton: {
      alignItems: 'center',
      backgroundColor: colors.action,
      borderRadius: radii.button,
      justifyContent: 'center',
      marginTop: spacing.xl,
      minHeight: 52,
    },
    primaryText: {
      color: colors.surface,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
    },
    backButton: {
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.md,
      minHeight: 48,
    },
    retryButton: {
      alignItems: 'center',
      borderColor: colors.action,
      borderRadius: radii.button,
      borderWidth: 1,
      justifyContent: 'center',
      marginTop: spacing.md,
      minHeight: 48,
    },
    backText: {
      color: colors.action,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
    },
    error: {
      color: colors.danger,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      lineHeight: 21,
      marginTop: spacing.md,
    },
    disabled: { opacity: 0.46 },
    pressed: { opacity: 0.76 },
  });
}
