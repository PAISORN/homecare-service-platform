import { colors, radii, spacing, typography } from '@homecare/design-tokens';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAppFontFamilies } from '../../foundation/font-runtime';
import { serviceJobTravelCopyTh as copy } from '../../locales/th';
import type { MobileSupabaseClient } from '../../lib/supabase';
import {
  getCurrentForegroundCoordinates,
  watchForegroundCoordinates,
} from '../location/foreground-location';
import {
  formatTravelDistanceTh,
  formatTravelEtaTh,
  formatTravelFreshnessTh,
  getServiceJobTravelProgress,
  publishServiceJobTravelLocation,
  stopServiceJobTravelSharing,
  type ServiceJobTravelProgress,
} from './service-job-travel-api';
import type { ServiceJobActorRole } from './service-jobs-api';

export function ServiceJobTravelPanel({
  client,
  jobId,
  mode,
}: Readonly<{
  client: MobileSupabaseClient;
  jobId: string;
  mode: ServiceJobActorRole;
}>) {
  const [progress, setProgress] = useState<ServiceJobTravelProgress | null>(
    null,
  );
  const [loadError, setLoadError] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const publishingRef = useRef(false);
  const styles = createStyles(useAppFontFamilies());

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function refresh() {
      try {
        const next = await getServiceJobTravelProgress(client, jobId);
        if (!active) return;
        setProgress(next);
        setLoadError(false);
        timer = setTimeout(refresh, next.refresh_interval_seconds * 1000);
      } catch {
        if (!active) return;
        setLoadError(true);
        timer = setTimeout(refresh, 15_000);
      }
    }

    void refresh();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [client, jobId]);

  useEffect(() => {
    if (mode !== 'technician' || !sharing) return;
    let active = true;
    let subscription: Awaited<
      ReturnType<typeof watchForegroundCoordinates>
    > | null = null;

    async function publishCurrent() {
      if (publishingRef.current) return false;
      publishingRef.current = true;
      try {
        const coordinates = await getCurrentForegroundCoordinates();
        await publishServiceJobTravelLocation(client, jobId, coordinates);
        if (active) setShareError(null);
        return true;
      } catch {
        if (active) {
          setShareError(copy.shareFailed);
          setSharing(false);
        }
        return false;
      } finally {
        publishingRef.current = false;
      }
    }

    async function startWatching() {
      if (!active || subscription || AppState.currentState !== 'active') return;
      const published = await publishCurrent();
      if (!active || !published) return;
      try {
        subscription = await watchForegroundCoordinates((coordinates) => {
          if (publishingRef.current) return;
          publishingRef.current = true;
          void publishServiceJobTravelLocation(client, jobId, coordinates)
            .then(() => {
              if (active) setShareError(null);
            })
            .catch(() => {
              if (active) setShareError(copy.publishFailed);
            })
            .finally(() => {
              publishingRef.current = false;
            });
        });
      } catch {
        if (active) {
          setShareError(copy.shareFailed);
          setSharing(false);
        }
      }
    }

    function stopWatching() {
      subscription?.remove();
      subscription = null;
    }

    const appStateSubscription = AppState.addEventListener(
      'change',
      (state) => {
        if (state === 'active') void startWatching();
        else {
          stopWatching();
          void stopServiceJobTravelSharing(client, jobId).catch(
            () => undefined,
          );
        }
      },
    );
    void startWatching();

    return () => {
      active = false;
      stopWatching();
      appStateSubscription.remove();
      void stopServiceJobTravelSharing(client, jobId).catch(() => undefined);
    };
  }, [client, jobId, mode, sharing]);

  const eta = formatTravelEtaTh(progress?.estimated_minutes ?? null);
  const distance = formatTravelDistanceTh(
    progress?.straight_line_distance_km ?? null,
  );
  const freshness = formatTravelFreshnessTh(progress?.captured_at ?? null);

  return (
    <View>
      <Text style={styles.title}>{copy.title}</Text>
      <View style={styles.card}>
        {mode === 'technician' ? (
          <>
            <Text style={styles.heading}>
              {sharing ? copy.sharingTitle : copy.readyTitle}
            </Text>
            <Text style={styles.body}>
              {sharing ? copy.sharingBody : copy.readyBody}
            </Text>
            {shareError ? (
              <Text accessibilityLiveRegion="polite" style={styles.error}>
                {shareError}
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setShareError(null);
                setSharing((current) => !current);
              }}
              style={({ pressed }) => [
                sharing ? styles.secondaryButton : styles.primaryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={sharing ? styles.secondaryText : styles.primaryText}>
                {sharing ? copy.stopSharing : copy.startSharing}
              </Text>
            </Pressable>
          </>
        ) : progress && !progress.destination_ready ? (
          <>
            <Text style={styles.heading}>{copy.destinationMissingTitle}</Text>
            <Text style={styles.body}>{copy.destinationMissingBody}</Text>
          </>
        ) : progress?.sharing_active ? (
          <>
            <Text style={styles.heading}>{copy.customerActiveTitle}</Text>
            {eta ? <Text style={styles.eta}>{eta}</Text> : null}
            {distance ? <Text style={styles.body}>{distance}</Text> : null}
            {freshness ? <Text style={styles.support}>{freshness}</Text> : null}
          </>
        ) : (
          <>
            <Text style={styles.heading}>{copy.customerWaitingTitle}</Text>
            <Text style={styles.body}>{copy.customerWaitingBody}</Text>
          </>
        )}

        {!progress && !loadError ? (
          <ActivityIndicator color={colors.action} style={styles.loader} />
        ) : null}
        {loadError ? (
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {copy.loadFailed}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function createStyles(fonts: ReturnType<typeof useAppFontFamilies>) {
  return StyleSheet.create({
    title: {
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
    heading: {
      color: colors.text,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
    },
    eta: {
      color: colors.primary,
      fontFamily: fonts.bold,
      fontSize: typography.sectionTitleSize,
      marginTop: spacing.sm,
    },
    body: {
      color: colors.text,
      fontFamily: fonts.regular,
      fontSize: typography.bodySize,
      lineHeight: 24,
      marginTop: spacing.sm,
    },
    support: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      marginTop: spacing.sm,
    },
    error: {
      color: colors.danger,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      lineHeight: 21,
      marginTop: spacing.sm,
    },
    loader: { marginTop: spacing.md },
    primaryButton: {
      alignItems: 'center',
      backgroundColor: colors.action,
      borderRadius: radii.button,
      justifyContent: 'center',
      marginTop: spacing.lg,
      minHeight: 48,
      paddingHorizontal: spacing.lg,
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
    primaryText: {
      color: colors.surface,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
    },
    secondaryText: {
      color: colors.action,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
    },
    pressed: { opacity: 0.76 },
  });
}
