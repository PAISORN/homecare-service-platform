import { colors, radii, spacing, typography } from '@homecare/design-tokens';
import {
  Redirect,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
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
import { requestShortlistCopyTh as copy } from '../../locales/th';
import { useSession } from '../../providers/session-provider';
import { goBackOrReplace } from '../shared/navigation';
import {
  formatLaborAmount,
  getShortlistPrice,
  listCustomerRequestShortlist,
  selectTechnicianForRequest,
  type CustomerRequestShortlistItem,
} from './service-request-api';

export function RequestShortlistScreen() {
  const router = useRouter();
  const { requestId } = useLocalSearchParams<{ requestId?: string }>();
  const { client } = useSession();
  const [items, setItems] = useState<readonly CustomerRequestShortlistItem[]>(
    [],
  );
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busyId, setBusyId] = useState<string | null>(null);
  const styles = createStyles(useAppFontFamilies());

  const load = useCallback(async () => {
    if (!client || !requestId) return;
    setState('loading');
    try {
      setItems(await listCustomerRequestShortlist(client, requestId));
      setState('ready');
    } catch {
      setState('error');
    }
  }, [client, requestId]);

  useFocusEffect(useCallback(() => void load(), [load]));

  if (!requestId) return <Redirect href="/requests" />;

  function confirmSelection(item: CustomerRequestShortlistItem) {
    const price = getShortlistPrice(item);
    if (!price.ready || price.amount === null) return;
    Alert.alert(
      copy.confirmTitle,
      copy.confirmBody(
        item.display_name,
        formatLaborAmount(price.amount, price.currency),
      ),
      [
        { text: copy.keepComparing, style: 'cancel' },
        {
          text: copy.confirm,
          onPress: () => void selectTechnician(item),
        },
      ],
    );
  }

  async function selectTechnician(item: CustomerRequestShortlistItem) {
    if (!client || !requestId || busyId) return;
    setBusyId(item.technician_id);
    try {
      await selectTechnicianForRequest(client, requestId, item.technician_id);
      await load();
      Alert.alert(copy.selectedTitle, copy.selectedBody);
    } catch {
      Alert.alert(copy.selectFailedTitle, copy.selectFailedBody);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          accessibilityRole="button"
          onPress={() => goBackOrReplace(router, '/requests')}
          style={styles.backButton}
        >
          <Text style={styles.backText}>{copy.back}</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>
          {copy.title}
        </Text>
        <Text style={styles.description}>{copy.description}</Text>

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
        {state === 'ready' && items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>{copy.emptyTitle}</Text>
            <Text style={styles.emptyBody}>{copy.emptyBody}</Text>
          </View>
        ) : null}

        <View style={styles.list}>
          {items.map((item) => {
            const price = getShortlistPrice(item);
            const selected = item.is_selected;
            return (
              <View key={item.technician_id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.nameGroup}>
                    <Text style={styles.rank}>
                      {copy.rank(item.shortlist_rank)}
                    </Text>
                    <Text style={styles.name}>{item.display_name}</Text>
                  </View>
                  <Text
                    style={
                      selected ? styles.selectedBadge : styles.verifiedBadge
                    }
                  >
                    {selected ? copy.selectedBadge : copy.verifiedBadge}
                  </Text>
                </View>
                {item.years_experience !== null ? (
                  <Text style={styles.experience}>
                    {copy.experience(item.years_experience)}
                  </Text>
                ) : null}
                {item.technician_bio ? (
                  <Text style={styles.bio}>{item.technician_bio}</Text>
                ) : null}

                <View style={styles.quoteBox}>
                  <Text style={styles.quoteTitle}>
                    {item.price_model === 'evidence_quote'
                      ? copy.quotationTitle
                      : copy.catalogPriceTitle}
                  </Text>
                  {price.ready && price.amount !== null ? (
                    <>
                      <Text style={styles.amount}>
                        {formatLaborAmount(price.amount, price.currency)}
                      </Text>
                      {item.quotation_scope_description ? (
                        <Text style={styles.scope}>
                          {item.quotation_scope_description}
                        </Text>
                      ) : null}
                    </>
                  ) : (
                    <Text style={styles.pending}>
                      {item.price_model === 'evidence_quote'
                        ? copy.waitingForQuotation
                        : copy.waitingForCatalogPrice}
                    </Text>
                  )}
                </View>

                {selected ? (
                  <Text
                    accessibilityLiveRegion="polite"
                    style={styles.selectedNotice}
                  >
                    {copy.selectedNotice}
                  </Text>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    disabled={!price.ready || busyId !== null}
                    onPress={() => confirmSelection(item)}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      (!price.ready || busyId !== null) && styles.disabled,
                      pressed && styles.pressed,
                    ]}
                  >
                    {busyId === item.technician_id ? (
                      <ActivityIndicator color={colors.surface} />
                    ) : (
                      <Text style={styles.primaryText}>
                        {copy.chooseTechnician}
                      </Text>
                    )}
                  </Pressable>
                )}
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
    emptyTitle: {
      color: colors.text,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
      textAlign: 'center',
    },
    emptyBody: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      lineHeight: 21,
      marginTop: spacing.sm,
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
    nameGroup: { flex: 1 },
    rank: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
    },
    name: {
      color: colors.text,
      fontFamily: fonts.bold,
      fontSize: typography.sectionTitleSize,
      marginTop: spacing.xs,
    },
    verifiedBadge: {
      color: colors.success,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
    },
    selectedBadge: {
      color: colors.action,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
    },
    experience: {
      color: colors.primary,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
      marginTop: spacing.sm,
    },
    bio: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      lineHeight: 21,
      marginTop: spacing.sm,
    },
    quoteBox: {
      borderColor: colors.border,
      borderRadius: radii.button,
      borderWidth: 1,
      marginTop: spacing.lg,
      padding: spacing.md,
    },
    quoteTitle: {
      color: colors.textMuted,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
    },
    amount: {
      color: colors.text,
      fontFamily: fonts.bold,
      fontSize: typography.sectionTitleSize,
      marginTop: spacing.xs,
    },
    scope: {
      color: colors.text,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      lineHeight: 21,
      marginTop: spacing.sm,
    },
    pending: {
      color: colors.warning,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
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
    selectedNotice: {
      color: colors.success,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
      marginTop: spacing.lg,
    },
    disabled: { opacity: 0.5 },
    pressed: { opacity: 0.76 },
  });
}
