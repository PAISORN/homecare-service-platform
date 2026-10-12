import { colors, radii, spacing, typography } from '@homecare/design-tokens';
import {
  Redirect,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { MagnifyingGlass, SealCheck, UserCircle } from 'phosphor-react-native';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
  const [query, setQuery] = useState('');
  const [readyOnly, setReadyOnly] = useState(false);
  const styles = createStyles(useAppFontFamilies());
  const visibleItems = useMemo(
    () =>
      items.filter(
        (item) =>
          `${item.display_name} ${item.technician_bio ?? ''}`
            .toLocaleLowerCase('th')
            .includes(query.trim().toLocaleLowerCase('th')) &&
          (!readyOnly || getShortlistPrice(item).ready),
      ),
    [items, query, readyOnly],
  );

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
        <View style={styles.search}>
          <MagnifyingGlass size={21} color={colors.textMuted} />
          <TextInput
            accessibilityLabel="ค้นหาช่างในรายชื่อ"
            placeholder="ค้นหาชื่อหรือทักษะของช่าง"
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            style={styles.searchInput}
          />
        </View>
        <View style={styles.filters}>
          {[
            { label: 'ทั้งหมด', value: false },
            { label: 'มีราคาพร้อมเลือก', value: true },
          ].map((filter) => (
            <Pressable
              key={filter.label}
              accessibilityRole="button"
              accessibilityState={{ selected: readyOnly === filter.value }}
              onPress={() => setReadyOnly(filter.value)}
              style={[
                styles.filter,
                readyOnly === filter.value && styles.filterSelected,
              ]}
            >
              <Text
                style={[
                  styles.filterText,
                  readyOnly === filter.value && styles.filterTextSelected,
                ]}
              >
                {filter.label}
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
        {state === 'ready' && items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>{copy.emptyTitle}</Text>
            <Text style={styles.emptyBody}>{copy.emptyBody}</Text>
          </View>
        ) : null}

        {state === 'ready' && items.length > 0 && visibleItems.length === 0 ? (
          <Text accessibilityLiveRegion="polite" style={styles.emptyBody}>
            ไม่พบช่างที่ตรงกับตัวกรอง ลองเปลี่ยนคำค้นหรือเลือกทั้งหมด
          </Text>
        ) : null}

        <View style={styles.list}>
          {visibleItems.map((item) => {
            const price = getShortlistPrice(item);
            const selected = item.is_selected;
            return (
              <View key={item.technician_id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.avatar}>
                    <UserCircle
                      size={44}
                      color={colors.primary}
                      weight="duotone"
                    />
                  </View>
                  <View style={styles.nameGroup}>
                    <Text style={styles.rank}>
                      {copy.rank(item.shortlist_rank)}
                    </Text>
                    <Text style={styles.name}>{item.display_name}</Text>
                  </View>
                  <View style={styles.verification}>
                    <SealCheck size={18} color={colors.success} />
                    <Text
                      style={
                        selected ? styles.selectedBadge : styles.verifiedBadge
                      }
                    >
                      {selected ? copy.selectedBadge : copy.verifiedBadge}
                    </Text>
                  </View>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${copy.viewProfile} ${item.display_name}`}
                  onPress={() =>
                    router.push({
                      pathname: '/requests/technician',
                      params: { requestId, technicianId: item.technician_id },
                    })
                  }
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    styles.profileButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.secondaryText}>{copy.viewProfile}</Text>
                </Pressable>
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
                  <View>
                    <Text
                      accessibilityLiveRegion="polite"
                      style={styles.selectedNotice}
                    >
                      {copy.selectedNotice}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        router.push({
                          pathname: '/requests/agreement',
                          params: { requestId },
                        })
                      }
                      style={({ pressed }) => [
                        styles.primaryButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.primaryText}>
                        ตรวจและยืนยันข้อตกลง
                      </Text>
                    </Pressable>
                  </View>
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
    search: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radii.button,
      paddingHorizontal: spacing.md,
      marginTop: spacing.lg,
      minHeight: 52,
    },
    searchInput: {
      flex: 1,
      minWidth: 0,
      color: colors.text,
      fontFamily: fonts.regular,
      fontSize: typography.bodySize,
      minHeight: 52,
    },
    filters: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    filter: {
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
      borderRadius: radii.pill,
      backgroundColor: colors.surfaceMuted,
    },
    filterSelected: { backgroundColor: colors.primary },
    filterText: {
      color: colors.textMuted,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
    },
    filterTextSelected: { color: colors.surface },
    avatar: {
      width: 56,
      height: 64,
      borderRadius: radii.button,
      backgroundColor: colors.mint,
      alignItems: 'center',
      justifyContent: 'center',
    },
    verification: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: spacing.xs,
      maxWidth: 100,
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
    profileButton: { marginTop: spacing.md },
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
      backgroundColor: colors.surfaceMuted,
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
