import { colors, radii, spacing, typography } from '@homecare/design-tokens';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import {
  ArrowRight,
  Drop,
  Lightning,
  MagnifyingGlass,
  Snowflake,
  Wrench,
  type IconProps,
} from 'phosphor-react-native';
import type { ComponentType } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { MobileHomeScaffold } from '../../data/mobile-home-scaffold';
import { useAppFontFamilies } from '../../foundation/font-runtime';
import type { MobileHomeCopy } from '../../locales/th';
import { NotificationInboxLink } from '../notifications/notification-inbox-link';
import { MobileBottomNav } from '../shared/mobile-bottom-nav';

const categoryAppearance = {
  'AIR-CONDITIONING': { Icon: Snowflake, color: colors.sky },
  PLUMBING: { Icon: Drop, color: colors.mint },
  ELECTRICAL: { Icon: Lightning, color: colors.blush },
} satisfies Record<
  MobileHomeScaffold['serviceCategoryCodes'][number],
  { Icon: ComponentType<IconProps>; color: string }
>;

export function HomeScreen({
  copy,
  model,
}: Readonly<{ copy: MobileHomeCopy; model: MobileHomeScaffold }>) {
  const availabilityNotice = copy.availability[model.availabilityStatus];
  const router = useRouter();
  const styles = createStyles(useAppFontFamilies());

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <View>
            <Text style={styles.eyebrow}>{copy.brand}</Text>
            <Text style={styles.greeting}>{copy.greeting}</Text>
          </View>
          <NotificationInboxLink compact mode="customer" />
        </View>

        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.description}>{copy.description}</Text>

        <Pressable
          accessibilityLabel={copy.searchPlaceholder}
          accessibilityRole="button"
          onPress={() => router.push('/requests/catalog')}
          style={({ pressed }) => [styles.search, pressed && styles.pressed]}
        >
          <MagnifyingGlass color={colors.textMuted} size={21} />
          <Text style={styles.searchText}>{copy.searchPlaceholder}</Text>
        </Pressable>

        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Wrench color={colors.surface} size={26} weight="fill" />
          </View>
          <Text style={styles.heroTitle}>{copy.requestService}</Text>
          <Text style={styles.heroBody}>{copy.requestServiceDescription}</Text>
          <Pressable
            accessibilityLabel={copy.requestService}
            accessibilityRole="button"
            onPress={() => router.push('/requests')}
            style={({ pressed }) => [
              styles.heroButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.heroButtonText}>{copy.requestService}</Text>
            <ArrowRight color={colors.primary} size={21} weight="bold" />
          </Pressable>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{copy.popularServices}</Text>
          <Pressable
            accessibilityLabel={copy.viewAll}
            onPress={() => router.push('/requests/catalog')}
          >
            <Text style={styles.sectionAction}>{copy.viewAll}</Text>
          </Pressable>
        </View>

        <View style={styles.categoryGrid}>
          {model.serviceCategoryCodes.map((categoryCode) => {
            const categoryLabel = copy.categoryLabels[categoryCode];
            const { Icon, color } = categoryAppearance[categoryCode];
            return (
              <Pressable
                accessibilityLabel={copy.viewServiceAccessibilityLabel(
                  categoryLabel,
                )}
                accessibilityRole="button"
                key={categoryCode}
                onPress={() =>
                  router.push({
                    pathname: '/requests/catalog',
                    params: { categoryCode },
                  })
                }
                style={({ pressed }) => [
                  styles.categoryCard,
                  { backgroundColor: color },
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.categoryIcon}>
                  <Icon color={colors.primary} size={27} weight="fill" />
                </View>
                <Text numberOfLines={2} style={styles.categoryLabel}>
                  {categoryLabel}
                </Text>
                <Text style={styles.categoryAction}>{copy.viewService}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          accessibilityLabel={copy.serviceJobs}
          accessibilityRole="button"
          onPress={() => router.push('/jobs' as never)}
          style={({ pressed }) => [styles.jobsCard, pressed && styles.pressed]}
        >
          <View style={styles.jobsIcon}>
            <Wrench color={colors.action} size={24} weight="duotone" />
          </View>
          <View style={styles.jobsCopy}>
            <Text style={styles.jobsTitle}>{copy.serviceJobs}</Text>
            <Text style={styles.jobsBody}>{availabilityNotice.title}</Text>
          </View>
          <ArrowRight color={colors.action} size={22} weight="bold" />
        </Pressable>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>{availabilityNotice.title}</Text>
          <Text style={styles.noticeBody}>
            {availabilityNotice.description}
          </Text>
        </View>
      </ScrollView>
      <MobileBottomNav active="home" />
    </SafeAreaView>
  );
}

function createStyles(fonts: ReturnType<typeof useAppFontFamilies>) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: 116, width: '100%' },
    topBar: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    eyebrow: {
      color: colors.primary,
      fontFamily: fonts.bold,
      fontSize: typography.supportSize,
      letterSpacing: 1.8,
    },
    greeting: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      marginTop: 2,
    },
    title: {
      color: colors.text,
      fontFamily: fonts.bold,
      fontSize: typography.pageTitleSize,
      lineHeight: 42,
      marginTop: spacing.lg,
    },
    description: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.bodySize,
      lineHeight: 24,
      marginTop: spacing.xs,
    },
    search: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.button,
      borderWidth: 1,
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.lg,
      minHeight: 52,
      paddingHorizontal: spacing.md,
    },
    searchText: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
    },
    heroCard: {
      backgroundColor: colors.primary,
      borderRadius: radii.card,
      marginTop: spacing.lg,
      overflow: 'hidden',
      padding: spacing.lg,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.16,
      shadowRadius: 22,
    },
    heroIcon: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: colors.action,
      borderRadius: radii.pill,
      height: 48,
      justifyContent: 'center',
      width: 48,
    },
    heroTitle: {
      color: colors.surface,
      fontFamily: fonts.bold,
      fontSize: typography.sectionTitleSize,
      marginTop: spacing.md,
    },
    heroBody: {
      color: colors.mint,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      lineHeight: 21,
      marginTop: spacing.xs,
    },
    heroButton: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: radii.button,
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: spacing.lg,
      minHeight: 52,
      paddingHorizontal: spacing.md,
    },
    heroButtonText: {
      color: colors.primary,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
    },
    sectionHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: spacing.xxl,
    },
    sectionTitle: {
      color: colors.text,
      fontFamily: fonts.bold,
      fontSize: typography.sectionTitleSize,
    },
    sectionAction: {
      color: colors.action,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
    },
    categoryGrid: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    categoryCard: {
      borderRadius: radii.card,
      flex: 1,
      minHeight: 154,
      padding: spacing.md,
    },
    categoryIcon: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: radii.pill,
      height: 44,
      justifyContent: 'center',
      width: 44,
    },
    categoryLabel: {
      color: colors.text,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
      lineHeight: 20,
      marginTop: spacing.sm,
    },
    categoryAction: {
      color: colors.primary,
      fontFamily: fonts.regular,
      fontSize: 12,
      marginTop: 'auto',
    },
    jobsCard: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      flexDirection: 'row',
      marginTop: spacing.xxl,
      padding: spacing.md,
    },
    jobsIcon: {
      alignItems: 'center',
      backgroundColor: colors.mint,
      borderRadius: radii.button,
      height: 48,
      justifyContent: 'center',
      width: 48,
    },
    jobsCopy: { flex: 1, marginHorizontal: spacing.md },
    jobsTitle: {
      color: colors.text,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
    },
    jobsBody: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: 12,
      marginTop: 2,
    },
    notice: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radii.card,
      marginTop: spacing.md,
      padding: spacing.lg,
    },
    noticeTitle: {
      color: colors.text,
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
    pressed: { opacity: 0.76 },
  });
}
