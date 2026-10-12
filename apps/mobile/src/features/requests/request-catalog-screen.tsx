import { colors, radii, spacing, typography } from '@homecare/design-tokens';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Drop,
  Lightning,
  MagnifyingGlass,
  Snowflake,
} from 'phosphor-react-native';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppFontFamilies } from '../../foundation/font-runtime';
import { serviceRequestCopyTh as copy } from '../../locales/th';
import { useSession } from '../../providers/session-provider';
import { goBackOrReplace } from '../shared/navigation';
import {
  formatCatalogPrice,
  listPilotCatalog,
  type CatalogCategory,
} from './service-request-api';

export function RequestCatalogScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    categoryCode?: string;
    entryPoint?: string;
  }>();
  const { client } = useSession();
  const [categories, setCategories] = useState<readonly CatalogCategory[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(
    params.categoryCode ?? 'all',
  );
  const styles = createStyles(useAppFontFamilies());
  const entryPoint =
    params.entryPoint === 'symptom' ? 'symptom' : 'service_catalog';

  useEffect(() => {
    if (!client) return;
    let current = true;
    void listPilotCatalog(client)
      .then((data) => {
        if (!current) return;
        setCategories(data);
        setState('ready');
      })
      .catch(() => current && setState('error'));
    return () => {
      current = false;
    };
  }, [client]);

  function retry() {
    setState('loading');
    if (!client) return;
    void listPilotCatalog(client)
      .then((data) => {
        setCategories(data);
        setState('ready');
      })
      .catch(() => setState('error'));
  }

  const visibleCategories = useMemo(
    () =>
      categories
        .filter(
          (category) =>
            selectedCategory === 'all' || category.code === selectedCategory,
        )
        .map((category) => ({
          ...category,
          service_items: category.service_items.filter((item) =>
            `${category.name_th} ${item.name_th} ${item.description_th ?? ''}`
              .toLocaleLowerCase('th')
              .includes(query.trim().toLocaleLowerCase('th')),
          ),
        }))
        .filter((category) =>
          entryPoint === 'symptom'
            ? `${category.name_th} ${category.description_th ?? ''}`
                .toLocaleLowerCase('th')
                .includes(query.trim().toLocaleLowerCase('th'))
            : category.service_items.length > 0,
        ),
    [categories, selectedCategory, query, entryPoint],
  );

  function openSymptom(category: CatalogCategory) {
    router.push({
      pathname: '/requests/new',
      params: { categoryId: category.id, entryPoint: 'symptom' },
    });
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
          {entryPoint === 'symptom'
            ? copy.symptomCatalogTitle
            : copy.catalogTitle}
        </Text>

        <View style={styles.search}>
          <MagnifyingGlass size={21} color={colors.textMuted} />
          <TextInput
            accessibilityLabel="ค้นหารายการบริการ"
            placeholder="ค้นหาบริการหรืออาการ"
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            style={styles.searchInput}
          />
        </View>
        <View style={styles.filters}>
          {[{ code: 'all', name_th: 'ทั้งหมด' }, ...categories].map(
            (category) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{
                  selected: selectedCategory === category.code,
                }}
                key={category.code}
                onPress={() => setSelectedCategory(category.code)}
                style={[
                  styles.filter,
                  selectedCategory === category.code && styles.filterSelected,
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    selectedCategory === category.code &&
                      styles.filterTextSelected,
                  ]}
                >
                  {category.name_th}
                </Text>
              </Pressable>
            ),
          )}
        </View>
        <Text style={styles.description}>
          {entryPoint === 'symptom'
            ? copy.symptomCatalogDescription
            : copy.catalogDescription}
        </Text>

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
              onPress={retry}
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>{copy.retry}</Text>
            </Pressable>
          </View>
        ) : null}
        {state === 'ready' && visibleCategories.length === 0 ? (
          <Text accessibilityLiveRegion="polite" style={styles.empty}>
            {query.trim() || selectedCategory !== 'all'
              ? 'ไม่พบบริการที่ตรงกับการค้นหา ลองเปลี่ยนคำค้นหรือหมวดบริการ'
              : copy.noCatalog}
          </Text>
        ) : null}

        {visibleCategories.map((category) => (
          <View key={category.id} style={styles.categorySection}>
            <Text style={styles.categoryTitle}>{category.name_th}</Text>
            {category.description_th ? (
              <Text style={styles.categoryDescription}>
                {category.description_th}
              </Text>
            ) : null}
            {entryPoint === 'symptom' ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => openSymptom(category)}
                style={styles.actionCard}
              >
                <Text style={styles.itemTitle}>{copy.newSymptomRequest}</Text>
                <Text style={styles.choose}>{copy.choose}</Text>
              </Pressable>
            ) : (
              category.service_items.map((item) => (
                <Pressable
                  accessibilityRole="button"
                  key={item.id}
                  onPress={() =>
                    router.push({
                      pathname: '/requests/new',
                      params: {
                        categoryId: category.id,
                        itemId: item.id,
                        entryPoint,
                      },
                    })
                  }
                  style={({ pressed }) => [
                    styles.itemCard,
                    pressed && styles.pressed,
                  ]}
                >
                  <View
                    style={[
                      styles.serviceIcon,
                      {
                        backgroundColor:
                          category.code === 'AIR-CONDITIONING'
                            ? colors.sky
                            : category.code === 'PLUMBING'
                              ? colors.mint
                              : colors.blush,
                      },
                    ]}
                  >
                    {category.code === 'AIR-CONDITIONING' ? (
                      <Snowflake size={26} color={colors.primary} />
                    ) : category.code === 'PLUMBING' ? (
                      <Drop size={26} color={colors.primary} />
                    ) : (
                      <Lightning size={26} color={colors.primary} />
                    )}
                  </View>
                  <View style={styles.itemBody}>
                    <Text style={styles.itemTitle}>{item.name_th}</Text>
                    {item.description_th ? (
                      <Text style={styles.itemDescription}>
                        {item.description_th}
                      </Text>
                    ) : null}
                    <Text style={styles.price}>{formatCatalogPrice(item)}</Text>
                  </View>
                  <ArrowRight size={22} color={colors.action} />
                </Pressable>
              ))
            )}
          </View>
        ))}
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
    serviceIcon: {
      width: 48,
      height: 56,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radii.button,
      marginRight: spacing.md,
    },
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
    loader: { marginTop: spacing.xxl },
    error: {
      color: colors.danger,
      fontFamily: fonts.regular,
      fontSize: typography.bodySize,
      marginTop: spacing.xl,
    },
    errorGroup: { gap: spacing.md, marginTop: spacing.xl },
    retryButton: {
      alignItems: 'center',
      borderColor: colors.action,
      borderRadius: radii.button,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 48,
      paddingHorizontal: spacing.lg,
    },
    retryText: {
      color: colors.action,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
    },
    empty: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.bodySize,
      marginTop: spacing.xl,
    },
    categorySection: { gap: spacing.md, marginTop: spacing.xxl },
    categoryTitle: {
      color: colors.text,
      fontFamily: fonts.bold,
      fontSize: typography.sectionTitleSize,
    },
    categoryDescription: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
    },
    itemCard: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      flexDirection: 'row',
      minHeight: 104,
      padding: spacing.md,
    },
    actionCard: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      flexDirection: 'row',
      minHeight: 72,
      padding: spacing.lg,
    },
    itemBody: { flex: 1, gap: spacing.xs },
    itemTitle: {
      color: colors.text,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
    },
    itemDescription: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      lineHeight: 20,
    },
    price: {
      color: colors.primary,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
    },
    choose: {
      color: colors.action,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
      marginLeft: spacing.md,
    },
    pressed: { opacity: 0.76 },
  });
}
