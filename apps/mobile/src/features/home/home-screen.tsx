import { colors, radii, spacing, typography } from '@homecare/design-tokens';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { MobileHomeScaffold } from '../../data/mobile-home-scaffold';
import { useAppFontFamilies } from '../../foundation/font-runtime';
import type { MobileHomeCopy } from '../../locales/th';

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
        <Text style={styles.eyebrow}>{copy.brand}</Text>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.description}>{copy.description}</Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.account}
          onPress={() => router.push('/account')}
          style={({ pressed }) => [
            styles.accountButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.accountButtonText}>{copy.account}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.requestService}
          onPress={() => router.push('/requests')}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>{copy.requestService}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.serviceJobs}
          onPress={() => router.push('/jobs' as never)}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.secondaryButtonText}>{copy.serviceJobs}</Text>
        </Pressable>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{copy.pilotServicesTitle}</Text>
          {model.serviceCategoryCodes.map((categoryCode) => {
            const categoryLabel = copy.categoryLabels[categoryCode];

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={copy.viewServiceAccessibilityLabel(
                  categoryLabel,
                )}
                key={categoryCode}
                onPress={() =>
                  router.push({
                    pathname: '/requests/catalog',
                    params: { categoryCode },
                  })
                }
                style={({ pressed }) => [
                  styles.card,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.cardTitle}>{categoryLabel}</Text>
                <Text style={styles.cardAction}>{copy.viewService}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>{availabilityNotice.title}</Text>
          <Text style={styles.noticeBody}>
            {availabilityNotice.description}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(fonts: ReturnType<typeof useAppFontFamilies>) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl },
    eyebrow: {
      color: colors.primary,
      fontFamily: fonts.bold,
      fontSize: typography.supportSize,
      letterSpacing: 1.2,
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
      minHeight: 52,
      justifyContent: 'center',
      marginTop: spacing.xl,
      paddingHorizontal: spacing.lg,
    },
    accountButton: {
      alignItems: 'center',
      alignSelf: 'flex-end',
      borderRadius: radii.button,
      justifyContent: 'center',
      minHeight: 48,
      marginTop: spacing.lg,
      paddingHorizontal: spacing.lg,
    },
    accountButtonText: {
      color: colors.action,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
    },
    primaryButtonText: {
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
      marginTop: spacing.md,
      minHeight: 52,
      paddingHorizontal: spacing.lg,
    },
    secondaryButtonText: {
      color: colors.action,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
    },
    pressed: { opacity: 0.76 },
    section: { gap: spacing.md, marginTop: spacing.xxl },
    sectionTitle: {
      color: colors.text,
      fontFamily: fonts.bold,
      fontSize: typography.sectionTitleSize,
    },
    card: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      flexDirection: 'row',
      minHeight: 72,
      padding: spacing.lg,
    },
    cardTitle: {
      color: colors.text,
      flex: 1,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
    },
    cardAction: {
      color: colors.action,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
    },
    notice: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      marginTop: spacing.xxl,
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
  });
}
