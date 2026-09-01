import { colors } from '@homecare/design-tokens';
import { Redirect, useRouter } from 'expo-router';
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
import { technicianApplicationCopyTh as copy } from '../../locales/th';
import { useSession } from '../../providers/session-provider';
import { createFormStyles } from '../shared/form-styles';
import { updateTechnicianBio } from './technician-application-api';

export function TechnicianProfileScreen() {
  const router = useRouter();
  const { client, session, technicianApplication, refreshAccount } =
    useSession();
  const [bio, setBio] = useState(technicianApplication?.bio ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const styles = createFormStyles(useAppFontFamilies());

  if (technicianApplication?.verification_status !== 'draft') {
    return <Redirect href="/technician/application" />;
  }

  async function save() {
    if (!client || !session || loading) return;
    if (bio.trim().length > 500) {
      setError(copy.profileInvalid);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await updateTechnicianBio(client, session.user.id, bio);
      await refreshAccount();
      router.back();
    } catch {
      setError(copy.saveFailed);
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
            {copy.profileTitle}
          </Text>
          <Text style={styles.description}>{copy.profileDescription}</Text>
          <Text style={styles.label}>{copy.profileLabel}</Text>
          <TextInput
            accessibilityLabel={copy.profileLabel}
            maxLength={501}
            multiline
            onChangeText={setBio}
            placeholder={copy.profilePlaceholder}
            style={[
              styles.input,
              { minHeight: 140, paddingVertical: 16, textAlignVertical: 'top' },
            ]}
            value={bio}
          />
          <Text style={styles.helper}>{copy.profileHelper}</Text>
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
              <Text style={styles.primaryButtonText}>{copy.save}</Text>
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.secondaryButtonText}>{copy.back}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
