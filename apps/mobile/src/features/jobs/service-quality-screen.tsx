import { colors, radii, spacing, typography } from '@homecare/design-tokens';
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

import { useAppFontFamilies } from '../../foundation/font-runtime';
import { useSession } from '../../providers/session-provider';
import { goBackOrReplace } from '../shared/navigation';
import type { ServiceJobActorRole } from './service-jobs-api';
import {
  getServiceQualitySummary,
  openServiceQualityCase,
  respondToServiceJobReview,
  respondToServiceQualityCase,
  submitServiceJobReview,
  uploadServiceQualityAttachment,
  validateQualityDetails,
  type ServiceJobReview,
  type ServiceJobWarranty,
  type ServiceQualityCase,
  type ServiceQualityCaseKind,
  type ServiceQualityCategory,
} from './service-quality-api';

type Props = Readonly<{
  mode: ServiceJobActorRole;
  fallback: '/jobs/detail' | '/technician/jobs/detail';
}>;

const caseStatusLabels: Record<ServiceQualityCase['status'], string> = {
  submitted: 'ส่งเรื่องแล้ว',
  under_review: 'กำลังตรวจสอบ',
  awaiting_customer: 'รอข้อมูลจากลูกค้า',
  awaiting_technician: 'รอข้อมูลจากช่าง',
  resolved: 'แก้ไขแล้ว',
  dismissed: 'ยุติเรื่อง',
  escalated: 'เข้าสู่ข้อพิพาท',
};
const categoryLabels: Record<ServiceQualityCategory, string> = {
  work_quality: 'คุณภาพงาน',
  behavior: 'พฤติกรรม',
  price_scope: 'ราคา/ขอบเขตงาน',
  safety: 'ความปลอดภัย',
  other: 'อื่น ๆ',
};

export function ServiceQualityScreen({ mode, fallback }: Props) {
  const { jobId } = useLocalSearchParams<{ jobId?: string }>();
  const router = useRouter();
  const { client, session } = useSession();
  const [warranty, setWarranty] = useState<ServiceJobWarranty | null>(null);
  const [cases, setCases] = useState<readonly ServiceQualityCase[]>([]);
  const [review, setReview] = useState<ServiceJobReview | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<ServiceQualityCaseKind>('complaint');
  const [category, setCategory] =
    useState<ServiceQualityCategory>('work_quality');
  const [details, setDetails] = useState('');
  const [response, setResponse] = useState('');
  const [ratings, setRatings] = useState({
    overall: 5,
    quality: 5,
    punctuality: 5,
    priceClarity: 5,
    manners: 5,
  });
  const [reviewText, setReviewText] = useState('');
  const styles = createStyles(useAppFontFamilies());
  const validDetails = useMemo(
    () => validateQualityDetails(details),
    [details],
  );

  const load = useCallback(async () => {
    if (!client || !jobId) return setState('error');
    setState('loading');
    try {
      const summary = await getServiceQualitySummary(client, jobId);
      setWarranty(summary.warranty);
      setCases(summary.cases);
      setReview(summary.review);
      if (summary.review) {
        setRatings({
          overall: summary.review.overall_rating,
          quality: summary.review.quality_rating,
          punctuality: summary.review.punctuality_rating,
          priceClarity: summary.review.price_clarity_rating,
          manners: summary.review.manners_rating,
        });
        setReviewText(summary.review.review_text ?? '');
      }
      setState('ready');
    } catch {
      setState('error');
    }
  }, [client, jobId]);

  useFocusEffect(useCallback(() => void load(), [load]));

  async function submitCase() {
    if (!client || !jobId || !validDetails || busy) {
      Alert.alert('กรุณาอธิบายรายละเอียดอย่างน้อย 20 ตัวอักษร');
      return;
    }
    setBusy(true);
    try {
      await openServiceQualityCase(client, {
        jobId,
        kind,
        category,
        details: validDetails,
      });
      setDetails('');
      Alert.alert(
        'ส่งเรื่องแล้ว',
        'HomeCare จะตรวจสอบและแสดงความคืบหน้าในหน้านี้',
      );
      await load();
    } catch {
      Alert.alert(
        'ส่งเรื่องไม่สำเร็จ',
        'ตรวจสอบว่าไม่มีเคสประเภทเดียวกันที่ยังเปิดอยู่ แล้วลองใหม่',
      );
    } finally {
      setBusy(false);
    }
  }

  async function sendResponse(caseId: string) {
    if (!client || response.trim().length < 10 || busy) {
      Alert.alert('กรุณากรอกคำชี้แจงอย่างน้อย 10 ตัวอักษร');
      return;
    }
    setBusy(true);
    try {
      await respondToServiceQualityCase(client, caseId, response);
      setResponse('');
      await load();
    } catch {
      Alert.alert('บันทึกคำชี้แจงไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  async function chooseEvidence(caseId: string) {
    if (!client || !session || busy) return;
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
      setBusy(true);
      await uploadServiceQualityAttachment(client, {
        userId: session.user.id,
        caseId,
        nonce: Crypto.randomUUID(),
        base64: asset.base64,
        mimeType: asset.mimeType,
      });
      Alert.alert('แนบหลักฐานแล้ว');
    } catch {
      Alert.alert('แนบรูปไม่สำเร็จ', 'รองรับ JPG/PNG ขนาดไม่เกิน 6 MB');
    } finally {
      setBusy(false);
    }
  }

  async function saveReview() {
    if (!client || !jobId || busy) return;
    if (reviewText.trim() && reviewText.trim().length < 10) {
      Alert.alert('ความคิดเห็นต้องมีอย่างน้อย 10 ตัวอักษร หรือเว้นว่างไว้');
      return;
    }
    setBusy(true);
    try {
      await submitServiceJobReview(client, {
        jobId,
        ...ratings,
        tags: [],
        text: reviewText,
      });
      Alert.alert('บันทึกรีวิวแล้ว', 'รีวิวจะเผยแพร่หลังผู้ดูแลตรวจสอบ');
      await load();
    } catch {
      Alert.alert('บันทึกรีวิวไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  async function sendReviewResponse() {
    if (!client || !review || response.trim().length < 10 || busy) return;
    setBusy(true);
    try {
      await respondToServiceJobReview(client, review.id, response);
      setResponse('');
      await load();
    } catch {
      Alert.alert('ตอบกลับรีวิวไม่สำเร็จ', 'ช่างตอบรีวิวได้หนึ่งครั้ง');
    } finally {
      setBusy(false);
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
            onPress={() =>
              goBackOrReplace(router, {
                pathname: fallback,
                params: { jobId },
              } as never)
            }
            style={styles.backButton}
          >
            <Text style={styles.backText}>ย้อนกลับ</Text>
          </Pressable>
          <Text accessibilityRole="header" style={styles.title}>
            ดูแลคุณภาพหลังงาน
          </Text>
          <Text style={styles.description}>
            ติดตามการรับประกัน รีวิว หรือขอให้ HomeCare ช่วยตรวจสอบ
            โดยยังไม่มีการคืนเงินหรือเคลื่อนย้ายเงินจริง
          </Text>

          {state === 'loading' ? (
            <ActivityIndicator color={colors.action} style={styles.loader} />
          ) : null}
          {state === 'error' ? (
            <Action
              label="ลองโหลดอีกครั้ง"
              onPress={() => void load()}
              styles={styles}
              secondary
            />
          ) : null}
          {state === 'ready' ? (
            <>
              <Text style={styles.sectionTitle}>การรับประกันงาน</Text>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>
                  {warranty && new Date(warranty.ends_at) >= new Date()
                    ? 'อยู่ในระยะรับประกัน'
                    : 'ไม่มีการรับประกันที่ยังใช้งานได้'}
                </Text>
                {warranty ? (
                  <Text style={styles.muted}>
                    รับประกัน {warranty.warranty_days} วัน · ถึง{' '}
                    {formatDate(warranty.ends_at)}
                  </Text>
                ) : null}
              </View>

              {mode === 'customer' ? (
                <>
                  <Text style={styles.sectionTitle}>เปิดเรื่องใหม่</Text>
                  <View style={styles.card}>
                    <Text style={styles.label}>ประเภทเรื่อง</Text>
                    <OptionRow
                      options={[
                        ['complaint', 'ข้อร้องเรียน'],
                        ['warranty_claim', 'คำขอรับประกัน'],
                      ]}
                      selected={kind}
                      onSelect={(value) =>
                        setKind(value as ServiceQualityCaseKind)
                      }
                      styles={styles}
                    />
                    <Text style={styles.label}>หมวดปัญหา</Text>
                    <OptionRow
                      options={Object.entries(categoryLabels)}
                      selected={category}
                      onSelect={(value) =>
                        setCategory(value as ServiceQualityCategory)
                      }
                      styles={styles}
                      wrap
                    />
                    <Text style={styles.label}>รายละเอียด *</Text>
                    <TextInput
                      accessibilityLabel="รายละเอียดปัญหา"
                      maxLength={2000}
                      multiline
                      onChangeText={setDetails}
                      placeholder="อธิบายสิ่งที่เกิดขึ้น ผลกระทบ และสิ่งที่ต้องการให้ช่วย"
                      placeholderTextColor={colors.textMuted}
                      style={styles.input}
                      textAlignVertical="top"
                      value={details}
                    />
                    <Action
                      disabled={busy || !validDetails}
                      label="ส่งเรื่องให้ HomeCare"
                      loading={busy}
                      onPress={() => void submitCase()}
                      styles={styles}
                    />
                  </View>
                </>
              ) : null}

              <Text style={styles.sectionTitle}>เรื่องที่กำลังติดตาม</Text>
              {cases.length === 0 ? (
                <View style={styles.card}>
                  <Text style={styles.muted}>
                    ยังไม่มีคำขอรับประกันหรือข้อร้องเรียน
                  </Text>
                </View>
              ) : null}
              {cases.map((item) => (
                <View key={item.id} style={styles.card}>
                  <Text style={styles.cardTitle}>
                    {item.kind === 'warranty_claim'
                      ? 'คำขอรับประกัน'
                      : 'ข้อร้องเรียน'}{' '}
                    · {caseStatusLabels[item.status]}
                  </Text>
                  <Text style={styles.muted}>
                    {categoryLabels[item.category]}
                  </Text>
                  <Text style={styles.body}>{item.details}</Text>
                  {item.technician_response ? (
                    <Text style={styles.response}>
                      คำชี้แจงจากช่าง: {item.technician_response}
                    </Text>
                  ) : null}
                  {item.decision_note ? (
                    <Text style={styles.response}>
                      คำตัดสิน: {item.decision_note}
                    </Text>
                  ) : null}
                  {!['resolved', 'dismissed'].includes(item.status) ? (
                    <>
                      <Action
                        label="แนบรูปหลักฐาน"
                        onPress={() => void chooseEvidence(item.id)}
                        styles={styles}
                        secondary
                      />
                      <TextInput
                        accessibilityLabel="คำชี้แจงเพิ่มเติม"
                        maxLength={2000}
                        multiline
                        onChangeText={setResponse}
                        placeholder="เพิ่มข้อมูลหรือคำชี้แจง"
                        placeholderTextColor={colors.textMuted}
                        style={styles.inputSmall}
                        value={response}
                      />
                      <Action
                        disabled={busy || response.trim().length < 10}
                        label="ส่งคำชี้แจง"
                        onPress={() => void sendResponse(item.id)}
                        styles={styles}
                        secondary
                      />
                    </>
                  ) : null}
                </View>
              ))}

              <Text style={styles.sectionTitle}>รีวิวงานในระบบ</Text>
              {mode === 'customer' ? (
                <View style={styles.card}>
                  <Text style={styles.muted}>
                    {review
                      ? `สถานะ: ${review.status === 'published' ? 'เผยแพร่แล้ว' : review.status === 'hidden' ? 'ซ่อนโดยผู้ดูแล' : 'รอตรวจสอบ'}`
                      : 'ให้คะแนน 1–5 ดาว'}
                  </Text>
                  {(
                    [
                      ['overall', 'ภาพรวม'],
                      ['quality', 'คุณภาพงาน'],
                      ['punctuality', 'ตรงต่อเวลา'],
                      ['priceClarity', 'ความชัดเจนราคา'],
                      ['manners', 'มารยาท'],
                    ] as const
                  ).map(([key, label]) => (
                    <RatingRow
                      key={key}
                      label={label}
                      value={ratings[key]}
                      onChange={(value) =>
                        setRatings((current) => ({ ...current, [key]: value }))
                      }
                      styles={styles}
                    />
                  ))}
                  <Text style={styles.label}>ความคิดเห็น (ไม่บังคับ)</Text>
                  <TextInput
                    accessibilityLabel="ความคิดเห็นรีวิว"
                    maxLength={1000}
                    multiline
                    onChangeText={setReviewText}
                    placeholder="เล่าประสบการณ์ที่เป็นประโยชน์ต่อผู้ใช้คนอื่น"
                    placeholderTextColor={colors.textMuted}
                    style={styles.inputSmall}
                    value={reviewText}
                  />
                  <Action
                    disabled={busy}
                    label={review ? 'แก้ไขรีวิว' : 'ส่งรีวิว'}
                    loading={busy}
                    onPress={() => void saveReview()}
                    styles={styles}
                  />
                </View>
              ) : review ? (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>
                    คะแนนภาพรวม {review.overall_rating}/5
                  </Text>
                  {review.review_text ? (
                    <Text style={styles.body}>{review.review_text}</Text>
                  ) : null}
                  {review.technician_response ? (
                    <Text style={styles.response}>
                      คำตอบของคุณ: {review.technician_response}
                    </Text>
                  ) : (
                    <>
                      <TextInput
                        accessibilityLabel="ตอบกลับรีวิว"
                        maxLength={1000}
                        multiline
                        onChangeText={setResponse}
                        placeholder="ตอบกลับอย่างสุภาพ (ตอบได้หนึ่งครั้ง)"
                        placeholderTextColor={colors.textMuted}
                        style={styles.inputSmall}
                        value={response}
                      />
                      <Action
                        disabled={busy || response.trim().length < 10}
                        label="ตอบกลับรีวิว"
                        onPress={() => void sendReviewResponse()}
                        styles={styles}
                      />
                    </>
                  )}
                </View>
              ) : (
                <View style={styles.card}>
                  <Text style={styles.muted}>ลูกค้ายังไม่ได้ส่งรีวิว</Text>
                </View>
              )}
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function OptionRow({
  options,
  selected,
  onSelect,
  styles,
  wrap = false,
}: Readonly<{
  options: readonly (readonly [string, string])[];
  selected: string;
  onSelect: (value: string) => void;
  styles: ReturnType<typeof createStyles>;
  wrap?: boolean;
}>) {
  return (
    <View style={[styles.options, wrap && styles.optionsWrap]}>
      {options.map(([value, label]) => (
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ checked: selected === value }}
          key={value}
          onPress={() => onSelect(value)}
          style={[styles.option, selected === value && styles.optionSelected]}
        >
          <Text
            style={[
              styles.optionText,
              selected === value && styles.optionTextSelected,
            ]}
          >
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function RatingRow({
  label,
  value,
  onChange,
  styles,
}: Readonly<{
  label: string;
  value: number;
  onChange: (value: number) => void;
  styles: ReturnType<typeof createStyles>;
}>) {
  return (
    <View style={styles.ratingRow}>
      <Text style={styles.labelInline}>{label}</Text>
      <View style={styles.ratingOptions}>
        {[1, 2, 3, 4, 5].map((score) => (
          <Pressable
            accessibilityLabel={`${label} ${score} ดาว`}
            accessibilityRole="radio"
            accessibilityState={{ checked: value === score }}
            key={score}
            onPress={() => onChange(score)}
            style={[
              styles.ratingButton,
              value === score && styles.ratingSelected,
            ]}
          >
            <Text
              style={[
                styles.ratingText,
                value === score && styles.ratingTextSelected,
              ]}
            >
              {score}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Action({
  label,
  onPress,
  styles,
  disabled = false,
  loading = false,
  secondary = false,
}: Readonly<{
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  disabled?: boolean;
  loading?: boolean;
  secondary?: boolean;
}>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        secondary && styles.actionSecondary,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={secondary ? colors.action : colors.surface} />
      ) : (
        <Text
          style={[styles.actionText, secondary && styles.actionTextSecondary]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' }).format(
    new Date(value),
  );
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
      lineHeight: 26,
      marginTop: spacing.sm,
    },
    loader: { marginTop: spacing.xxl },
    sectionTitle: {
      color: colors.text,
      fontFamily: fonts.bold,
      fontSize: typography.sectionTitleSize,
      marginTop: spacing.xxl,
    },
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
      lineHeight: 25,
    },
    body: {
      color: colors.text,
      fontFamily: fonts.regular,
      fontSize: typography.bodySize,
      lineHeight: 25,
    },
    muted: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      lineHeight: 22,
    },
    response: {
      color: colors.primary,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      lineHeight: 22,
    },
    label: {
      color: colors.text,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
    },
    labelInline: {
      color: colors.text,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
    },
    input: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.button,
      borderWidth: 1,
      color: colors.text,
      fontFamily: fonts.regular,
      fontSize: typography.bodySize,
      minHeight: 130,
      padding: spacing.md,
    },
    inputSmall: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.button,
      borderWidth: 1,
      color: colors.text,
      fontFamily: fonts.regular,
      fontSize: typography.bodySize,
      minHeight: 92,
      padding: spacing.md,
    },
    action: {
      alignItems: 'center',
      backgroundColor: colors.action,
      borderColor: colors.action,
      borderRadius: radii.button,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 48,
      paddingHorizontal: spacing.lg,
    },
    actionSecondary: { backgroundColor: colors.surface },
    actionText: {
      color: colors.surface,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
    },
    actionTextSecondary: { color: colors.action },
    options: { flexDirection: 'row', gap: spacing.sm },
    optionsWrap: { flexWrap: 'wrap' },
    option: {
      borderColor: colors.border,
      borderRadius: radii.button,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: spacing.md,
    },
    optionSelected: { borderColor: colors.action },
    optionText: {
      color: colors.text,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
    },
    optionTextSelected: { color: colors.action, fontFamily: fonts.semiBold },
    ratingRow: { gap: spacing.sm },
    ratingOptions: { flexDirection: 'row', gap: spacing.sm },
    ratingButton: {
      alignItems: 'center',
      borderColor: colors.border,
      borderRadius: radii.button,
      borderWidth: 1,
      height: 44,
      justifyContent: 'center',
      width: 44,
    },
    ratingSelected: {
      backgroundColor: colors.action,
      borderColor: colors.action,
    },
    ratingText: {
      color: colors.text,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
    },
    ratingTextSelected: { color: colors.surface },
    disabled: { opacity: 0.5 },
    pressed: { opacity: 0.72 },
  });
}
