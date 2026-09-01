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
import { serviceLocationCopyTh as copy } from '../../locales/th';
import { useSession } from '../../providers/session-provider';
import {
  deleteOwnServiceLocation,
  listOwnServiceLocations,
  setOwnDefaultServiceLocation,
  type ServiceLocation,
} from './service-location-api';

export function ServiceLocationsScreen() {
  const router = useRouter();
  const { client } = useSession();
  const [locations, setLocations] = useState<readonly ServiceLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const styles = createStyles(useAppFontFamilies());

  const load = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    setError(null);
    try {
      setLocations(await listOwnServiceLocations(client));
    } catch {
      setError(copy.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [client]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function makeDefault(locationId: string) {
    if (!client || busyId) return;
    setBusyId(locationId);
    setError(null);
    try {
      await setOwnDefaultServiceLocation(client, locationId);
      await load();
    } catch {
      setError(copy.actionFailed);
    } finally {
      setBusyId(null);
    }
  }

  function confirmDelete(location: ServiceLocation) {
    if (!client || busyId) return;
    Alert.alert(copy.removeTitle, copy.removeBody(location.label), [
      { text: copy.cancel, style: 'cancel' },
      {
        text: copy.confirmRemove,
        style: 'destructive',
        onPress: () => {
          setBusyId(location.id);
          setError(null);
          void deleteOwnServiceLocation(client, location.id)
            .then(load)
            .catch(() => setError(copy.actionFailed))
            .finally(() => setBusyId(null));
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
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
        <Text accessibilityRole="header" style={styles.title}>
          {copy.title}
        </Text>
        <Text style={styles.description}>{copy.description}</Text>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/account/locations/new')}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>{copy.add}</Text>
        </Pressable>

        {error ? (
          <View accessibilityLiveRegion="polite" style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void load()}
              style={({ pressed }) => [
                styles.inlineButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.inlineButtonText}>{copy.retry}</Text>
            </Pressable>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color={colors.action} />
            <Text style={styles.stateBody}>{copy.loading}</Text>
          </View>
        ) : locations.length === 0 ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>{copy.emptyTitle}</Text>
            <Text style={styles.stateBody}>{copy.emptyBody}</Text>
          </View>
        ) : (
          <View style={styles.locationList}>
            {locations.map((location) => {
              const busy = busyId === location.id;
              return (
                <View key={location.id} style={styles.locationCard}>
                  <View style={styles.cardHeading}>
                    <Text style={styles.locationLabel}>{location.label}</Text>
                    {location.is_default ? (
                      <Text style={styles.defaultBadge}>
                        {copy.defaultBadge}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.address}>{location.address_line}</Text>
                  {[location.building, location.floor, location.unit].filter(
                    Boolean,
                  ).length > 0 ? (
                    <Text style={styles.details}>
                      {[location.building, location.floor, location.unit]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  ) : null}
                  <View style={styles.actions}>
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={() =>
                        router.push({
                          pathname: '/account/locations/edit',
                          params: { locationId: location.id },
                        })
                      }
                      style={({ pressed }) => [
                        styles.actionButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.actionText}>{copy.edit}</Text>
                    </Pressable>
                    {!location.is_default ? (
                      <Pressable
                        accessibilityRole="button"
                        disabled={busy}
                        onPress={() => void makeDefault(location.id)}
                        style={({ pressed }) => [
                          styles.actionButton,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={styles.actionText}>{copy.setDefault}</Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={() => confirmDelete(location)}
                      style={({ pressed }) => [
                        styles.actionButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      {busy ? (
                        <ActivityIndicator color={colors.action} />
                      ) : (
                        <Text style={styles.removeText}>{copy.remove}</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(fonts: ReturnType<typeof useAppFontFamilies>) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl },
    backButton: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      justifyContent: 'center',
      minHeight: 44,
      paddingRight: spacing.lg,
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
      marginTop: spacing.sm,
    },
    description: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.bodySize,
      lineHeight: 24,
      marginTop: spacing.sm,
    },
    primaryButton: {
      alignItems: 'center',
      backgroundColor: colors.action,
      borderRadius: radii.button,
      justifyContent: 'center',
      marginTop: spacing.xl,
      minHeight: 52,
      paddingHorizontal: spacing.lg,
    },
    primaryButtonText: {
      color: colors.surface,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
    },
    locationList: { gap: spacing.md, marginTop: spacing.xl },
    locationCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      padding: spacing.lg,
    },
    cardHeading: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.sm,
    },
    locationLabel: {
      color: colors.text,
      flex: 1,
      fontFamily: fonts.bold,
      fontSize: typography.sectionTitleSize,
    },
    defaultBadge: {
      backgroundColor: colors.background,
      borderRadius: radii.pill,
      color: colors.primary,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    address: {
      color: colors.text,
      fontFamily: fonts.regular,
      fontSize: typography.bodySize,
      lineHeight: 24,
      marginTop: spacing.md,
    },
    details: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      lineHeight: 21,
      marginTop: spacing.xs,
    },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.lg,
    },
    actionButton: {
      alignItems: 'center',
      borderColor: colors.border,
      borderRadius: radii.button,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: spacing.md,
    },
    actionText: {
      color: colors.action,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
    },
    removeText: {
      color: colors.danger,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
    },
    stateCard: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      marginTop: spacing.xl,
      padding: spacing.xl,
    },
    stateTitle: {
      color: colors.text,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
      textAlign: 'center',
    },
    stateBody: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      lineHeight: 21,
      marginTop: spacing.sm,
      textAlign: 'center',
    },
    errorCard: {
      backgroundColor: colors.surface,
      borderColor: colors.danger,
      borderRadius: radii.card,
      borderWidth: 1,
      marginTop: spacing.lg,
      padding: spacing.lg,
    },
    errorText: {
      color: colors.danger,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      lineHeight: 21,
    },
    inlineButton: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      justifyContent: 'center',
      marginTop: spacing.sm,
      minHeight: 44,
      paddingRight: spacing.lg,
    },
    inlineButtonText: {
      color: colors.action,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
    },
    pressed: { opacity: 0.76 },
  });
}
