import { colors, radii, spacing, typography } from '@homecare/design-tokens';
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
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
  acknowledgeTechnicianKycNotice,
  listOwnTechnicianDocuments,
  replaceRequiredKycDocument,
  selectCurrentRequiredDocument,
  type TechnicianDocument,
} from './technician-application-api';
import {
  KYC_NOTICE_VERSION,
  prepareKycImage,
  type PreparedKycImage,
  type RequiredTechnicianDocumentType,
} from './technician-kyc';

type SelectedImage = Readonly<{
  previewUri: string;
  prepared: PreparedKycImage;
}>;

export function TechnicianDocumentsScreen() {
  const router = useRouter();
  const { client, session, technicianApplication, refreshAccount } =
    useSession();
  const [documents, setDocuments] = useState<TechnicianDocument[]>([]);
  const [selected, setSelected] = useState<
    Partial<Record<RequiredTechnicianDocumentType, SelectedImage>>
  >({});
  const [busyType, setBusyType] =
    useState<RequiredTechnicianDocumentType | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [acknowledging, setAcknowledging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fonts = useAppFontFamilies();
  const styles = createStyles(fonts);

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
      void refresh();
    }, [refresh]),
  );

  async function chooseImage(
    type: RequiredTechnicianDocumentType,
    source: 'camera' | 'library',
  ) {
    if (busyType) return;
    setBusyType(type);
    setError(null);
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setError(copy.permissionDenied);
          return;
        }
      }
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              base64: true,
              quality: 0.82,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              base64: true,
              quality: 0.82,
            });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.base64) throw new Error('missing_image_data');
      const prepared = prepareKycImage(asset.base64, asset.mimeType);
      setSelected((current) => ({
        ...current,
        [type]: { previewUri: asset.uri, prepared },
      }));
    } catch {
      setError(copy.imageInvalid);
    } finally {
      setBusyType(null);
    }
  }

  async function acknowledgeNotice() {
    if (!client || acknowledging) return;
    setAcknowledging(true);
    setError(null);
    try {
      await acknowledgeTechnicianKycNotice(client);
      await refreshAccount();
    } catch {
      setError(copy.acknowledgementFailed);
    } finally {
      setAcknowledging(false);
    }
  }

  async function upload(type: RequiredTechnicianDocumentType) {
    const image = selected[type];
    if (!client || !session || !image || busyType) return;
    setBusyType(type);
    setError(null);
    try {
      await replaceRequiredKycDocument(
        client,
        session.user.id,
        type,
        image.prepared,
        selectCurrentRequiredDocument(documents, type),
        Crypto.randomUUID(),
      );
      setSelected((current) => ({ ...current, [type]: undefined }));
      await refresh();
    } catch {
      setError(copy.uploadFailed);
      await refresh();
    } finally {
      setBusyType(null);
    }
  }

  const noticeAcknowledged =
    technicianApplication?.kyc_notice_version === KYC_NOTICE_VERSION &&
    technicianApplication.kyc_notice_acknowledged_at !== null;
  const editable =
    technicianApplication?.verification_status === 'draft' &&
    noticeAcknowledged &&
    loadState === 'ready';

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
          <Text style={styles.outlineText}>{copy.back}</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>
          {copy.documentsTitle}
        </Text>
        <Text style={styles.description}>{copy.documentsDescription}</Text>
        <Text style={styles.helper}>{copy.imageRules}</Text>
        {!noticeAcknowledged ? (
          <View style={styles.notice}>
            <Text style={styles.cardTitle}>{copy.retentionTitle}</Text>
            <Text style={styles.noticeBody}>{copy.retentionNotice}</Text>
            <Text style={styles.noticeBody}>
              {copy.acknowledgeBeforeUpload}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ busy: acknowledging }}
              disabled={acknowledging}
              onPress={() => void acknowledgeNotice()}
              style={({ pressed }) => [
                styles.primaryButton,
                acknowledging && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              {acknowledging ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Text style={styles.primaryText}>
                  {copy.acknowledgeAndContinue}
                </Text>
              )}
            </Pressable>
          </View>
        ) : loadState === 'loading' ? (
          <View style={styles.card}>
            <ActivityIndicator color={colors.action} />
            <Text accessibilityLiveRegion="polite" style={styles.helper}>
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
                styles.outlineButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.outlineText}>{copy.retry}</Text>
            </Pressable>
          </View>
        ) : (
          (['national_id', 'selfie'] as const).map((type) => {
            const current = selectCurrentRequiredDocument(documents, type);
            const picked = selected[type];
            const uploaded = current?.is_uploaded === true;
            return (
              <View key={type} style={styles.card}>
                <View style={styles.headingRow}>
                  <Text style={styles.cardTitle}>
                    {type === 'national_id' ? copy.nationalId : copy.selfie}
                  </Text>
                  <Text style={styles.required}>{copy.required}</Text>
                </View>
                <Text style={uploaded ? styles.ready : styles.missing}>
                  {uploaded ? copy.uploaded : copy.missing}
                </Text>
                {picked ? (
                  <Image
                    accessibilityLabel={`ตัวอย่าง${type === 'national_id' ? copy.nationalId : copy.selfie}`}
                    source={{ uri: picked.previewUri }}
                    style={styles.preview}
                  />
                ) : null}
                {editable ? (
                  <>
                    <View style={styles.actionRow}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ disabled: Boolean(busyType) }}
                        disabled={Boolean(busyType)}
                        onPress={() => void chooseImage(type, 'camera')}
                        style={({ pressed }) => [
                          styles.outlineButton,
                          busyType && styles.disabled,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={styles.outlineText}>{copy.takePhoto}</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ disabled: Boolean(busyType) }}
                        disabled={Boolean(busyType)}
                        onPress={() => void chooseImage(type, 'library')}
                        style={({ pressed }) => [
                          styles.outlineButton,
                          busyType && styles.disabled,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={styles.outlineText}>
                          {uploaded ? copy.replacePhoto : copy.choosePhoto}
                        </Text>
                      </Pressable>
                    </View>
                    {picked ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ disabled: Boolean(busyType) }}
                        disabled={Boolean(busyType)}
                        onPress={() => void upload(type)}
                        style={({ pressed }) => [
                          styles.primaryButton,
                          busyType && styles.disabled,
                          pressed && styles.pressed,
                        ]}
                      >
                        {busyType === type ? (
                          <ActivityIndicator color={colors.surface} />
                        ) : (
                          <Text style={styles.primaryText}>
                            {copy.uploadPhoto}
                          </Text>
                        )}
                      </Pressable>
                    ) : null}
                  </>
                ) : null}
              </View>
            );
          })
        )}
        {error && loadState !== 'error' ? (
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {error}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.outlineText}>{copy.back}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
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
    helper: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
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
    headingRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    cardTitle: {
      color: colors.text,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
    },
    required: {
      color: colors.action,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
    },
    ready: {
      color: colors.success,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
      marginTop: spacing.sm,
    },
    missing: {
      color: colors.warning,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
      marginTop: spacing.sm,
    },
    preview: {
      aspectRatio: 4 / 3,
      borderRadius: radii.button,
      marginTop: spacing.lg,
      width: '100%',
    },
    actionRow: {
      flexDirection: Platform.OS === 'web' ? 'row' : 'column',
      gap: spacing.sm,
      marginTop: spacing.lg,
    },
    outlineButton: {
      alignItems: 'center',
      borderColor: colors.action,
      borderRadius: radii.button,
      borderWidth: 1,
      flex: 1,
      justifyContent: 'center',
      minHeight: 48,
      paddingHorizontal: spacing.md,
    },
    outlineText: {
      color: colors.action,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
    },
    primaryButton: {
      alignItems: 'center',
      backgroundColor: colors.action,
      borderRadius: radii.button,
      justifyContent: 'center',
      marginTop: spacing.md,
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
      marginTop: spacing.xl,
      minHeight: 48,
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
