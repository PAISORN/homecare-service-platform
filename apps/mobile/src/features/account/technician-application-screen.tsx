import { colors } from '@homecare/design-tokens';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppFontFamilies } from '../../foundation/font-runtime';
import {
  accountCopyTh,
  technicianApplicationCopyTh as copy,
} from '../../locales/th';
import { useSession } from '../../providers/session-provider';
import { createFormStyles } from '../shared/form-styles';
import { goBackOrReplace } from '../shared/navigation';
import {
  bootstrapTechnicianApplication,
  canUseTechnicianMode,
} from './account-api';

export function TechnicianApplicationScreen() {
  const router = useRouter();
  const { client, technicianApplication, refreshAccount } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const styles = createFormStyles(useAppFontFamilies());

  async function startApplication() {
    if (!client || loading) return;
    setLoading(true);
    setError(null);
    try {
      await bootstrapTechnicianApplication(client);
      await refreshAccount();
    } catch {
      setError(accountCopyTh.applicationFailed);
    } finally {
      setLoading(false);
    }
  }

  const status = technicianApplication?.verification_status;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={[styles.content, styles.topContent]}>
        <Text accessibilityRole="header" style={styles.title}>
          {copy.hubTitle}
        </Text>
        <Text style={styles.description}>{copy.hubDescription}</Text>
        {status ? (
          status === 'draft' ? (
            <>
              <ApplicationLink
                label={copy.openProfile}
                onPress={() => router.push('/technician/application/profile')}
              />
              <ApplicationLink
                label={copy.openDocuments}
                onPress={() => router.push('/technician/application/documents')}
              />
              <ApplicationLink
                label={copy.openReview}
                onPress={() => router.push('/technician/application/review')}
              />
            </>
          ) : (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {status === 'pending_review'
                  ? copy.pendingTitle
                  : status === 'verified'
                    ? copy.verifiedTitle
                    : status === 'rejected'
                      ? copy.rejectedTitle
                      : copy.suspendedTitle}
              </Text>
              <Text style={styles.cardBody}>
                {status === 'pending_review'
                  ? copy.pendingBody
                  : status === 'verified'
                    ? copy.verifiedBody
                    : status === 'rejected'
                      ? copy.rejectedBody
                      : copy.suspendedBody}
              </Text>
              {status === 'rejected' &&
              technicianApplication?.rejection_reason ? (
                <Text style={styles.error}>
                  {technicianApplication.rejection_reason}
                </Text>
              ) : null}
              <Text style={styles.helper}>
                {canUseTechnicianMode(technicianApplication)
                  ? accountCopyTh.technicianModeReady
                  : accountCopyTh.technicianModeLocked}
              </Text>
            </View>
          )
        ) : (
          <Pressable
            accessibilityRole="button"
            disabled={loading}
            onPress={() => void startApplication()}
            style={({ pressed }) => [
              styles.primaryButton,
              loading && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
          >
            {loading ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <Text style={styles.primaryButtonText}>
                {accountCopyTh.startApplication}
              </Text>
            )}
          </Pressable>
        )}
        {error ? (
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {error}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => goBackOrReplace(router, '/account')}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.secondaryButtonText}>
            {accountCopyTh.backHome}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function ApplicationLink({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const styles = createFormStyles(useAppFontFamilies());
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.buttonPressed]}
    >
      <Text style={styles.cardTitle}>{label}</Text>
    </Pressable>
  );
}
