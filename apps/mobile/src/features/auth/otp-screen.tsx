import { colors } from '@homecare/design-tokens';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { requestPhoneOtp, verifyPhoneOtp } from './auth-api';
import { formatThaiPhoneForDisplay, normalizeOtp } from './phone';

const resendDelaySeconds = 30;

export function OtpScreen() {
  const copy = authCopyTh.otp;
  const router = useRouter();
  const { client } = useSession();
  const { phone, setPhone } = useAuthDraft();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(resendDelaySeconds);
  const styles = createFormStyles(useAppFontFamilies());

  useEffect(() => {
    if (secondsRemaining <= 0) return;
    const timer = setTimeout(
      () => setSecondsRemaining((current) => current - 1),
      1000,
    );
    return () => clearTimeout(timer);
  }, [secondsRemaining]);

  async function verify() {
    if (!client || loading || !phone) return;
    if (!normalizeOtp(otp)) {
      setError(copy.invalid);
      return;
    }

    setLoading(true);
    setError(null);
    const result = await verifyPhoneOtp(client, phone, otp);
    setLoading(false);

    if (!result.ok) {
      setError(
        result.reason === 'invalid_otp' ? copy.invalid : copy.verifyFailed,
      );
      return;
    }

    router.replace('/');
  }

  async function resend() {
    if (!client || resending || secondsRemaining > 0 || !phone) return;
    setResending(true);
    setError(null);
    const result = await requestPhoneOtp(client, phone);
    setResending(false);
    if (!result.ok) {
      setError(copy.resendFailed);
      return;
    }
    setSecondsRemaining(resendDelaySeconds);
  }

  if (!phone) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text accessibilityRole="header" style={styles.title}>
            {copy.missingPhone}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/phone')}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>{copy.changePhone}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
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
          <Text style={styles.description}>
            {copy.description(formatThaiPhoneForDisplay(phone))}
          </Text>
          <Text style={styles.label}>{copy.label}</Text>
          <TextInput
            accessibilityLabel={copy.label}
            autoComplete="one-time-code"
            keyboardType="number-pad"
            maxLength={6}
            onBlur={() => {
              if (otp && !normalizeOtp(otp)) setError(copy.invalid);
            }}
            onChangeText={(value) => {
              setOtp(value.replace(/\D/g, '').slice(0, 6));
              if (error) setError(null);
            }}
            placeholder={copy.placeholder}
            style={[styles.input, error ? styles.inputError : undefined]}
            textContentType="oneTimeCode"
            value={otp}
          />
          {error ? (
            <Text accessibilityLiveRegion="polite" style={styles.error}>
              {error}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            disabled={loading}
            onPress={() => void verify()}
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
          <Pressable
            accessibilityRole="button"
            disabled={resending || secondsRemaining > 0}
            onPress={() => void resend()}
            style={({ pressed }) => [
              styles.secondaryButton,
              (resending || secondsRemaining > 0) && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.secondaryButtonText}>
              {secondsRemaining > 0
                ? copy.resendCountdown(secondsRemaining)
                : resending
                  ? copy.resending
                  : copy.resend}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setPhone('');
              router.replace('/phone');
            }}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.secondaryButtonText}>{copy.changePhone}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
