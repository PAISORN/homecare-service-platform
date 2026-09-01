import { colors, radii, spacing, typography } from '@homecare/design-tokens';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppFontFamilies } from '../../foundation/font-runtime';
import { accountCopyTh } from '../../locales/th';
import { useSession } from '../../providers/session-provider';
import { formatThaiPhoneForDisplay } from '../auth/phone';
import { canUseTechnicianMode } from './account-api';

export function AccountScreen() {
  const router = useRouter();
  const { client, profile, technicianApplication } = useSession();
  const fonts = useAppFontFamilies();
  const styles = createStyles(fonts);
  const applicationStatus = technicianApplication?.verification_status;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          {accountCopyTh.title}
        </Text>
        <View style={styles.card}>
          <Text style={styles.label}>{accountCopyTh.displayNameLabel}</Text>
          <Text style={styles.value}>{profile?.display_name}</Text>
          <Text style={styles.label}>{accountCopyTh.phoneLabel}</Text>
          <Text style={styles.value}>
            {profile?.phone ? formatThaiPhoneForDisplay(profile.phone) : ''}
          </Text>
          <Text style={styles.role}>{accountCopyTh.customerRole}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/account/edit-name')}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.secondaryButtonText}>
              {accountCopyTh.editName}
            </Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {accountCopyTh.serviceLocationsTitle}
          </Text>
          <Text style={styles.supporting}>
            {accountCopyTh.serviceLocationsDescription}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/account/locations')}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {accountCopyTh.manageServiceLocations}
            </Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{accountCopyTh.technicianTitle}</Text>
          {applicationStatus ? (
            <>
              <Text style={styles.label}>
                {accountCopyTh.applicationStatusLabel}
              </Text>
              <Text style={styles.value}>
                {accountCopyTh.applicationStatuses[applicationStatus]}
              </Text>
              <Text style={styles.supporting}>
                {canUseTechnicianMode(technicianApplication)
                  ? accountCopyTh.technicianModeReady
                  : accountCopyTh.technicianModeLocked}
              </Text>
            </>
          ) : (
            <Text style={styles.supporting}>
              {accountCopyTh.technicianDescription}
            </Text>
          )}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/technician/application')}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {applicationStatus
                ? accountCopyTh.applicationStatusLabel
                : accountCopyTh.startApplication}
            </Text>
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/(app)')}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.secondaryButtonText}>
            {accountCopyTh.backHome}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => void client?.auth.signOut()}
          style={({ pressed }) => [
            styles.signOutButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.signOutText}>{accountCopyTh.signOut}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(fonts: ReturnType<typeof useAppFontFamilies>) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl },
    title: {
      color: colors.text,
      fontFamily: fonts.bold,
      fontSize: typography.pageTitleSize,
      lineHeight: 42,
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
      fontFamily: fonts.bold,
      fontSize: typography.sectionTitleSize,
    },
    label: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      marginTop: spacing.lg,
    },
    value: {
      color: colors.text,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
      marginTop: spacing.xs,
    },
    role: {
      alignSelf: 'flex-start',
      color: colors.primary,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
      marginTop: spacing.lg,
    },
    supporting: {
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
    secondaryButtonText: {
      color: colors.action,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
    },
    signOutButton: {
      alignItems: 'center',
      borderRadius: radii.button,
      justifyContent: 'center',
      marginTop: spacing.xxl,
      minHeight: 48,
      paddingHorizontal: spacing.lg,
    },
    signOutText: {
      color: colors.danger,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
    },
    pressed: { opacity: 0.76 },
  });
}
