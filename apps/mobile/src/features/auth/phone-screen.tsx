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
import { authCopyTh } from '../../locales/th';
import { useAuthDraft } from '../../providers/auth-draft-provider';
import { useSession } from '../../providers/session-provider';
import { createFormStyles } from '../shared/form-styles';
import { requestPhoneOtp } from './auth-api';
import { normalizeThaiPhone } from './phone';

export function PhoneScreen() {
  const copy = authCopyTh.phone;
  const router = useRouter();
  const { client } = useSession();
  const { phone, setPhone } = useAuthDraft();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const styles = createFormStyles(useAppFontFamilies());

  async function submit() {
    if (!client || loading) return;
    if (!normalizeThaiPhone(phone)) {
      setError(copy.invalid);
      return;
    }

    setLoading(true);
    setError(null);
    const result = await requestPhoneOtp(client, phone);
    setLoading(false);

    if (!result.ok) {
      setError(
        result.reason === 'invalid_phone' ? copy.invalid : copy.requestFailed,
      );
      return;
    }

    setPhone(result.phone);
    router.push('/otp');
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.brand}>{authCopyTh.brand}</Text>
          <Text accessibilityRole="header" style={styles.title}>
            {copy.title}
          </Text>
          <Text style={styles.description}>{copy.description}</Text>

          <Text style={styles.label}>{copy.label}</Text>
          <TextInput
            accessibilityLabel={copy.label}
            autoComplete="tel"
            keyboardType="phone-pad"
            onBlur={() => {
              if (phone && !normalizeThaiPhone(phone)) setError(copy.invalid);
            }}
            onChangeText={(value) => {
              setPhone(value);
              if (error) setError(null);
            }}
            placeholder={copy.placeholder}
            style={[styles.input, error ? styles.inputError : undefined]}
            textContentType="telephoneNumber"
            value={phone}
          />
          <Text style={styles.helper}>{copy.helper}</Text>
          {error ? (
            <Text accessibilityLiveRegion="polite" style={styles.error}>
              {error}
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={loading}
            onPress={() => void submit()}
            style={({ pressed }) => [
              styles.primaryButton,
              loading && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
          >
            {loading ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <Text style={styles.primaryButtonText}>{copy.submit}</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
