import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii, spacing, typography } from '@homecare/design-tokens';

import { serviceJobWorkCopyTh as copy } from '../../locales/th';
import { useAppFontFamilies } from '../../foundation/font-runtime';
import { useSession } from '../../providers/session-provider';
import { goBackOrReplace } from '../shared/navigation';
import {
  getServiceJob,
  type ServiceJobActorRole,
  type ServiceJobDetail,
} from './service-jobs-api';
import {
  createAdditionalWorkRequest,
  issueServiceJobPin,
  listAdditionalWorkRequests,
  listServiceJobEvidence,
  respondToAdditionalWork,
  uploadServiceJobEvidence,
  verifyServiceJobPin,
  type AdditionalWorkRequest,
  type ServiceJobEvidence,
  type ServiceJobEvidenceType,
  type ServiceJobPinPurpose,
} from './service-job-work-api';

type Props = Readonly<{
  mode: ServiceJobActorRole;
  fallback: '/jobs' | '/technician/jobs';
}>;

export function ServiceJobWorkScreen({ mode, fallback }: Props) {
  const router = useRouter();
  const { jobId } = useLocalSearchParams<{ jobId?: string }>();
  const { client, session } = useSession();
  const [job, setJob] = useState<ServiceJobDetail | null>(null);
  const [evidence, setEvidence] = useState<readonly ServiceJobEvidence[]>([]);
  const [requests, setRequests] = useState<readonly AdditionalWorkRequest[]>(
    [],
  );
  const [pin, setPin] = useState('');
  const [issuedPin, setIssuedPin] = useState<string | null>(null);
  const [scope, setScope] = useState('');
  const [reason, setReason] = useState('');
  const [labor, setLabor] = useState('0');
  const [materials, setMaterials] = useState('0');
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState<string | null>(null);
  const styles = createStyles(useAppFontFamilies());

  const load = useCallback(async () => {
    if (!client || !jobId) return setState('error');
    setState('loading');
    try {
      const [nextJob, nextEvidence, nextRequests] = await Promise.all([
        getServiceJob(client, jobId),
        listServiceJobEvidence(client, jobId),
        listAdditionalWorkRequests(client, jobId),
      ]);
      if (nextJob.actor_role !== mode) throw new Error('actor_role_mismatch');
      setJob(nextJob);
      setEvidence(nextEvidence);
      setRequests(nextRequests);
      setState('ready');
    } catch {
      setState('error');
    }
  }, [client, jobId, mode]);

  useFocusEffect(useCallback(() => void load(), [load]));

  const pendingRequest = requests.find(
    (request) => request.status === 'pending',
  );
  const usedAdditionalEvidenceIds = new Set(
    requests.map((request) => request.evidence_id),
  );
  const latestAdditionalEvidence = [...evidence]
    .reverse()
    .find(
      (item) =>
        item.evidence_type === 'additional_work' &&
        !usedAdditionalEvidenceIds.has(item.id),
    );
  const additionalInput = useMemo(() => {
    const laborAmount = Number(labor);
    const materialsAmount = Number(materials);
    return {
      laborAmount,
      materialsAmount,
      valid:
        scope.trim().length >= 10 &&
        reason.trim().length >= 10 &&
        Number.isFinite(laborAmount) &&
        Number.isFinite(materialsAmount) &&
        laborAmount >= 0 &&
        materialsAmount >= 0 &&
        laborAmount + materialsAmount > 0,
    };
  }, [labor, materials, reason, scope]);

  async function chooseEvidence(type: ServiceJobEvidenceType) {
    if (!client || !session || !jobId || busy) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        base64: true,
        quality: 0.82,
        allowsMultipleSelection: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.base64) throw new Error('missing_image_data');
      setBusy(`upload-${type}`);
      await uploadServiceJobEvidence(
        client,
        session.user.id,
        jobId,
        type,
        asset.base64,
        asset.mimeType,
        Crypto.randomUUID(),
      );
      await load();
    } catch {
      Alert.alert(copy.uploadFailed);
    } finally {
      setBusy(null);
    }
  }

  async function issuePin(purpose: ServiceJobPinPurpose) {
    if (!client || !jobId || busy) return;
    setBusy('pin');
    try {
      setIssuedPin(await issueServiceJobPin(client, jobId, purpose));
    } catch {
      Alert.alert(copy.pinFailed);
    } finally {
      setBusy(null);
    }
  }

  async function verifyPin(purpose: ServiceJobPinPurpose) {
    if (!client || !jobId || !/^\d{6}$/.test(pin) || busy) return;
    setBusy('pin');
    try {
      const result = await verifyServiceJobPin(client, jobId, purpose, pin);
      if (!result.verified) {
        Alert.alert(
          result.attempts_remaining === undefined
            ? copy.pinFailed
            : copy.pinAttempts(result.attempts_remaining),
        );
        return;
      }
      setPin('');
      await load();
    } catch {
      Alert.alert(copy.pinFailed);
    } finally {
      setBusy(null);
    }
  }

  async function submitAdditionalWork() {
    if (
      !client ||
      !jobId ||
      !latestAdditionalEvidence ||
      !additionalInput.valid ||
      busy
    ) {
      Alert.alert(
        latestAdditionalEvidence
          ? copy.invalidAdditional
          : copy.evidenceRequired,
      );
      return;
    }
    setBusy('additional');
    try {
      await createAdditionalWorkRequest(client, {
        jobId,
        evidenceId: latestAdditionalEvidence.id,
        scopeDescription: scope.trim(),
        reason: reason.trim(),
        laborAmount: additionalInput.laborAmount,
        materialsAmount: additionalInput.materialsAmount,
      });
      setScope('');
      setReason('');
      setLabor('0');
      setMaterials('0');
      await load();
    } catch {
      Alert.alert(copy.responseFailed);
    } finally {
      setBusy(null);
    }
  }

  async function respond(requestId: string, approve: boolean) {
    if (!client || busy) return;
    setBusy('response');
    try {
      await respondToAdditionalWork(client, requestId, approve);
      await load();
    } catch {
      Alert.alert(copy.responseFailed);
    } finally {
      setBusy(null);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            accessibilityRole="button"
            onPress={() => goBackOrReplace(router, fallback as never)}
            style={styles.backButton}
          >
            <Text style={styles.backText}>{copy.back}</Text>
          </Pressable>
          <Text accessibilityRole="header" style={styles.title}>
            {copy.title}
          </Text>
          <Text style={styles.description}>{copy.description}</Text>
          {state === 'loading' ? (
            <ActivityIndicator color={colors.action} style={styles.loader} />
          ) : null}
          {state === 'error' ? (
            <View style={styles.section}>
              <Text accessibilityLiveRegion="polite" style={styles.error}>
                {copy.loadFailed}
              </Text>
              <Action
                label={copy.retry}
                onPress={() => void load()}
                styles={styles}
                secondary
              />
            </View>
          ) : null}
          {state === 'ready' && job ? (
            <>
              <Text style={styles.sectionTitle}>{copy.evidenceTitle}</Text>
              <View style={styles.evidenceGrid}>
                {evidence.length === 0 ? (
                  <Text style={styles.muted}>{copy.evidenceEmpty}</Text>
                ) : null}
                {evidence.map((item) => (
                  <View key={item.id} style={styles.evidenceCard}>
                    <Image
                      accessibilityLabel={copy[item.evidence_type]}
                      source={{ uri: item.signedUrl }}
                      style={styles.evidenceImage}
                    />
                    <Text style={styles.evidenceLabel}>
                      {copy[item.evidence_type]}
                    </Text>
                  </View>
                ))}
              </View>
              {mode === 'technician' ? (
                <View style={styles.section}>
                  {job.job_status === 'technician_arrived' ? (
                    <Action
                      label={copy.uploadBefore}
                      onPress={() => void chooseEvidence('before')}
                      styles={styles}
                      secondary
                    />
                  ) : null}
                  {job.job_status === 'in_progress' ? (
                    <>
                      <Action
                        label={copy.uploadDuring}
                        onPress={() => void chooseEvidence('during')}
                        styles={styles}
                        secondary
                      />
                      <Action
                        label={copy.uploadAfter}
                        onPress={() => void chooseEvidence('after')}
                        styles={styles}
                        secondary
                      />
                      <Action
                        label={copy.uploadAdditional}
                        onPress={() => void chooseEvidence('additional_work')}
                        styles={styles}
                        secondary
                      />
                    </>
                  ) : null}
                </View>
              ) : null}

              <Text style={styles.sectionTitle}>{copy.pinTitle}</Text>
              <View style={styles.card}>
                {mode === 'customer' &&
                job.job_status === 'technician_arrived' ? (
                  <Action
                    label={copy.issueStart}
                    onPress={() => void issuePin('start')}
                    styles={styles}
                  />
                ) : null}
                {mode === 'customer' &&
                job.job_status === 'in_progress' &&
                !pendingRequest ? (
                  <Action
                    label={copy.issueCompletion}
                    onPress={() => void issuePin('completion')}
                    styles={styles}
                  />
                ) : null}
                {issuedPin ? (
                  <View style={styles.pinBox}>
                    <Text selectable style={styles.pin}>
                      {copy.pinValue(issuedPin)}
                    </Text>
                    <Text style={styles.muted}>{copy.pinCustomerHelp}</Text>
                  </View>
                ) : null}
                {mode === 'technician' &&
                (job.job_status === 'technician_arrived' ||
                  job.job_status === 'in_progress') ? (
                  <>
                    <Text style={styles.label}>{copy.pinLabel}</Text>
                    <TextInput
                      accessibilityLabel={copy.pinLabel}
                      keyboardType="number-pad"
                      maxLength={6}
                      onChangeText={(value) => setPin(value.replace(/\D/g, ''))}
                      placeholder={copy.pinPlaceholder}
                      placeholderTextColor={colors.textMuted}
                      style={styles.input}
                      value={pin}
                    />
                    <Action
                      label={
                        job.job_status === 'technician_arrived'
                          ? copy.verifyStart
                          : copy.verifyCompletion
                      }
                      onPress={() =>
                        void verifyPin(
                          job.job_status === 'technician_arrived'
                            ? 'start'
                            : 'completion',
                        )
                      }
                      styles={styles}
                    />
                  </>
                ) : null}
              </View>

              <Text style={styles.sectionTitle}>{copy.additionalTitle}</Text>
              {requests.length === 0 ? (
                <Text style={styles.muted}>{copy.additionalEmpty}</Text>
              ) : null}
              {requests.map((request) => (
                <View key={request.id} style={styles.card}>
                  <Text style={styles.cardTitle}>
                    {request.scope_description}
                  </Text>
                  <Text style={styles.body}>{request.reason}</Text>
                  <Text style={styles.amount}>
                    {copy.amount(
                      formatMoney(request.labor_amount, request.currency),
                      formatMoney(request.materials_amount, request.currency),
                    )}
                  </Text>
                  <Text style={styles.status}>{copy[request.status]}</Text>
                  {mode === 'customer' && request.status === 'pending' ? (
                    <View style={styles.actionsRow}>
                      <Action
                        label={copy.reject}
                        onPress={() => void respond(request.id, false)}
                        styles={styles}
                        secondary
                      />
                      <Action
                        label={copy.approve}
                        onPress={() => void respond(request.id, true)}
                        styles={styles}
                      />
                    </View>
                  ) : null}
                </View>
              ))}
              {mode === 'technician' &&
              job.job_status === 'in_progress' &&
              !pendingRequest ? (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>{copy.newAdditional}</Text>
                  <Field
                    label={copy.scopeLabel}
                    value={scope}
                    onChangeText={setScope}
                    styles={styles}
                    multiline
                  />
                  <Field
                    label={copy.reasonLabel}
                    value={reason}
                    onChangeText={setReason}
                    styles={styles}
                    multiline
                  />
                  <Field
                    label={copy.laborLabel}
                    value={labor}
                    onChangeText={setLabor}
                    styles={styles}
                    numeric
                  />
                  <Field
                    label={copy.materialsLabel}
                    value={materials}
                    onChangeText={setMaterials}
                    styles={styles}
                    numeric
                  />
                  <Text style={styles.muted}>{copy.evidenceRequired}</Text>
                  <Action
                    label={copy.submitAdditional}
                    onPress={() => void submitAdditionalWork()}
                    styles={styles}
                  />
                </View>
              ) : null}
              {busy ? (
                <ActivityIndicator
                  accessibilityLabel="กำลังบันทึก"
                  color={colors.action}
                  style={styles.loader}
                />
              ) : null}
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Action({
  label,
  onPress,
  styles,
  secondary = false,
}: Readonly<{
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  secondary?: boolean;
}>) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        secondary ? styles.secondaryButton : styles.primaryButton,
        pressed && styles.pressed,
      ]}
    >
      <Text style={secondary ? styles.secondaryText : styles.primaryText}>
        {label}
      </Text>
    </Pressable>
  );
}

function Field({
  label,
  value,
  onChangeText,
  styles,
  multiline = false,
  numeric = false,
}: Readonly<{
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  styles: ReturnType<typeof createStyles>;
  multiline?: boolean;
  numeric?: boolean;
}>) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        multiline={multiline}
        onChangeText={onChangeText}
        style={[styles.input, multiline && styles.textArea]}
        textAlignVertical={multiline ? 'top' : 'center'}
        value={value}
      />
    </View>
  );
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function createStyles(fonts: ReturnType<typeof useAppFontFamilies>) {
  return StyleSheet.create({
    flex: { flex: 1 },
    safeArea: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl },
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
      lineHeight: 42,
      marginTop: spacing.md,
    },
    description: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.bodySize,
      lineHeight: 25,
      marginTop: spacing.sm,
    },
    sectionTitle: {
      color: colors.text,
      fontFamily: fonts.bold,
      fontSize: typography.sectionTitleSize,
      marginTop: spacing.xxl,
      marginBottom: spacing.md,
    },
    section: { gap: spacing.md },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      gap: spacing.md,
      marginTop: spacing.md,
      padding: spacing.lg,
    },
    cardTitle: {
      color: colors.text,
      fontFamily: fonts.bold,
      fontSize: typography.bodySize,
      lineHeight: 24,
    },
    body: {
      color: colors.text,
      fontFamily: fonts.regular,
      fontSize: typography.bodySize,
      lineHeight: 24,
    },
    muted: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      lineHeight: 21,
    },
    error: {
      color: colors.danger,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
    },
    loader: { marginTop: spacing.xl },
    evidenceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    evidenceCard: { width: 104 },
    evidenceImage: { borderRadius: radii.button, height: 104, width: 104 },
    evidenceLabel: {
      color: colors.text,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
      marginTop: spacing.xs,
    },
    primaryButton: {
      alignItems: 'center',
      backgroundColor: colors.action,
      borderRadius: radii.button,
      justifyContent: 'center',
      minHeight: 48,
      paddingHorizontal: spacing.lg,
    },
    primaryText: {
      color: colors.surface,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
      textAlign: 'center',
    },
    secondaryButton: {
      alignItems: 'center',
      borderColor: colors.action,
      borderRadius: radii.button,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 48,
      paddingHorizontal: spacing.lg,
    },
    secondaryText: {
      color: colors.action,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
      textAlign: 'center',
    },
    pressed: { opacity: 0.76 },
    pinBox: {
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
    },
    pin: {
      color: colors.primary,
      fontFamily: fonts.bold,
      fontSize: typography.pageTitleSize,
      letterSpacing: 5,
    },
    label: {
      color: colors.text,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
      marginTop: spacing.sm,
    },
    input: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.button,
      borderWidth: 1,
      color: colors.text,
      fontFamily: fonts.regular,
      fontSize: typography.bodySize,
      minHeight: 48,
      paddingHorizontal: spacing.md,
    },
    textArea: { minHeight: 96, paddingTop: spacing.md },
    amount: {
      color: colors.primary,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
      lineHeight: 21,
    },
    status: {
      color: colors.action,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
    },
    actionsRow: { gap: spacing.md },
  });
}
