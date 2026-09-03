import { colors } from '@homecare/design-tokens';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppFontFamilies } from '../../foundation/font-runtime';
import { accountCopyTh } from '../../locales/th';
import { useSession } from '../../providers/session-provider';
import { createFormStyles } from '../shared/form-styles';
import { goBackOrReplace } from '../shared/navigation';
import { updateOwnDisplayName } from './account-api';

export function EditDisplayNameScreen() {
  const router = useRouter();
  const { client, session, profile, refreshAccount } = useSession();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const styles = createFormStyles(useAppFontFamilies());

  async function save() {
    if (!client || !session || loading) return;
    const trimmed = displayName.trim();
    if (trimmed.length < 1 || trimmed.length > 120) {
      setError(accountCopyTh.invalidName);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await updateOwnDisplayName(client, session.user.id, trimmed);
      await refreshAccount();
      goBackOrReplace(router, '/account');
    } catch {
      setError(accountCopyTh.saveFailed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={[styles.content, styles.topContent]}
          keyboardShouldPersistTaps="handled"
        >
          <Text accessibilityRole="header" style={styles.title}>
            {accountCopyTh.editName}
          </Text>
          <Text style={styles.label}>{accountCopyTh.displayNameLabel}</Text>
          <TextInput
            accessibilityLabel={accountCopyTh.displayNameLabel}
            autoCapitalize="words"
            maxLength={120}
            onChangeText={(value) => {
              setDisplayName(value);
              if (error) setError(null);
            }}
            style={[styles.input, error ? styles.inputError : undefined]}
            value={displayName}
          />
          {error ? (
            <Text accessibilityLiveRegion="polite" style={styles.error}>
              {error}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            disabled={loading}
            onPress={() => void save()}
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
                {accountCopyTh.saveName}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
