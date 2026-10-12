import { colors, radii, spacing, typography } from '@homecare/design-tokens';
import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Minus, Plus } from 'phosphor-react-native';
import {
  ActivityIndicator,
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

import {
  listOwnServiceLocations,
  type ServiceLocation,
} from '../account/service-location-api';
import { useAppFontFamilies } from '../../foundation/font-runtime';
import { serviceRequestCopyTh as copy } from '../../locales/th';
import { useSession } from '../../providers/session-provider';
import { goBackOrReplace } from '../shared/navigation';
import { PreferredDateField } from './preferred-date-field';
import {
  formatDraftScheduleTh,
  formatPreferredDateTh,
  toPreferredDateValue,
} from './preferred-date';
import {
  emptySafetyAnswers,
  deleteOwnRequestAttachment,
  getOwnRequestDraft,
  getSafetyStopCode,
  listPilotCatalog,
  listOwnRequestAttachments,
  saveOwnRequestDraft,
  uploadRequestImage,
  validateServiceRequestDraft,
  type CatalogCategory,
  type RequestSafetyAnswers,
  type RequestAttachment,
  type ServiceRequestDraftInput,
  type ServiceRequestValidation,
} from './service-request-api';

type PendingPhoto = Readonly<{
  uri: string;
  base64: string;
  mimeType?: string | null;
}>;

const urgencyOptions = [
  'flexible',
  'within_3_days',
  'as_soon_as_possible',
] as const;
const safetyKeys = [
  'fireSmoke',
  'waterNearElectricity',
  'externalPowerHazard',
  'uncontrolledWater',
  'outOfScopeAccess',
] as const;
const formSteps = [
  'สถานที่และอาการ',
  'วันเวลาและรูป',
  'ตรวจสอบและบันทึก',
] as const;
const suggestedTimes = ['09:00–12:00', '13:00–16:00', '16:00–18:00'] as const;

export function RequestFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    requestId?: string;
    categoryId?: string;
    itemId?: string;
    entryPoint?: string;
  }>();
  const { client, session } = useSession();
  const [locations, setLocations] = useState<readonly ServiceLocation[]>([]);
  const [catalog, setCatalog] = useState<readonly CatalogCategory[]>([]);
  const [photos, setPhotos] = useState<readonly PendingPhoto[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<
    readonly RequestAttachment[]
  >([]);
  const [input, setInput] = useState<ServiceRequestDraftInput>({
    requestId: params.requestId,
    serviceLocationId: '',
    serviceCategoryId: params.categoryId ?? '',
    serviceItemId: params.itemId,
    entryPoint: params.entryPoint === 'symptom' ? 'symptom' : 'service_catalog',
    problemDescription: '',
    quantity: 1,
    urgency: 'flexible',
    preferredDate: '',
    preferredTimeWindow: '',
    safetyAnswers: emptySafetyAnswers,
  });
  const [validation, setValidation] = useState<ServiceRequestValidation>({
    value: input,
    errors: {},
  });
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const scroll = useRef<ScrollView>(null);
  const fonts = useAppFontFamilies();
  const styles = createStyles(fonts);

  useEffect(() => {
    if (!client) return;
    let current = true;
    void Promise.all([
      listOwnServiceLocations(client),
      listPilotCatalog(client),
      params.requestId
        ? getOwnRequestDraft(client, params.requestId)
        : Promise.resolve(null),
      params.requestId
        ? listOwnRequestAttachments(client, params.requestId)
        : Promise.resolve([]),
    ])
      .then(([nextLocations, nextCatalog, draft, attachments]) => {
        if (!current) return;
        setLocations(nextLocations);
        setCatalog(nextCatalog);
        setExistingPhotos(attachments);
        if (draft) {
          const answers = draft.safety_answers as Record<string, unknown>;
          setInput({
            requestId: draft.id,
            serviceLocationId: draft.service_location_id,
            serviceCategoryId: draft.service_category_id,
            serviceItemId: draft.service_item_id ?? undefined,
            entryPoint: draft.entry_point,
            problemDescription: draft.problem_description,
            quantity: draft.quantity,
            urgency: draft.urgency,
            preferredDate: draft.preferred_date ?? '',
            preferredTimeWindow: draft.preferred_time_window ?? '',
            safetyAnswers: {
              fireSmoke: answers.fire_smoke === true,
              waterNearElectricity: answers.water_near_electricity === true,
              externalPowerHazard: answers.external_power_hazard === true,
              uncontrolledWater: answers.uncontrolled_water === true,
              outOfScopeAccess: answers.out_of_scope_access === true,
            },
          });
        } else if (!params.requestId) {
          setInput((currentInput) => ({
            ...currentInput,
            serviceLocationId:
              nextLocations.find((location) => location.is_default)?.id ??
              nextLocations[0]?.id ??
              '',
          }));
        }
        setState(draft || !params.requestId ? 'ready' : 'error');
      })
      .catch(() => current && setState('error'));
    return () => {
      current = false;
    };
  }, [client, params.requestId]);

  const selectedCategory = useMemo(
    () => catalog.find((category) => category.id === input.serviceCategoryId),
    [catalog, input.serviceCategoryId],
  );
  const selectedItem = selectedCategory?.service_items.find(
    (item) => item.id === input.serviceItemId,
  );
  const stopCode = getSafetyStopCode(input.safetyAnswers);
  const minimumPreferredDate = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }, []);
  const quickDates = useMemo(
    () =>
      Array.from({ length: 5 }, (_, offset) => {
        const date = new Date(minimumPreferredDate);
        date.setDate(date.getDate() + offset);
        return {
          value: toPreferredDateValue(date),
          label:
            offset === 0
              ? 'วันนี้'
              : offset === 1
                ? 'พรุ่งนี้'
                : new Intl.DateTimeFormat('th-TH', { weekday: 'short' }).format(
                    date,
                  ),
          day: date.getDate(),
        };
      }),
    [minimumPreferredDate],
  );

  function changeStep(next: number) {
    if (saving) return;
    if (next > step) {
      const result = validateServiceRequestDraft(input);
      setValidation(result);
      const fields =
        step === 0
          ? ([
              'serviceLocationId',
              'serviceCategoryId',
              'serviceItemId',
              'problemDescription',
              'quantity',
            ] as const)
          : (['preferredDate', 'preferredTimeWindow'] as const);
      if (fields.some((field) => result.errors[field])) return;
    }
    setStep(next);
    setMessage(null);
    scroll.current?.scrollTo({ y: 0, animated: false });
  }

  function update<Key extends keyof ServiceRequestDraftInput>(
    key: Key,
    value: ServiceRequestDraftInput[Key],
  ) {
    setInput((current) => ({ ...current, [key]: value }));
    setValidation((current) => ({
      ...current,
      errors: { ...current.errors, [key]: undefined },
    }));
    setMessage(null);
  }

  function updateSafety(key: keyof RequestSafetyAnswers, value: boolean) {
    update('safetyAnswers', { ...input.safetyAnswers, [key]: value });
  }

  async function choosePhotos() {
    setMessage(null);
    if (photos.length + existingPhotos.length >= 6) {
      setMessage(copy.photoLimit);
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        base64: true,
        quality: 0.82,
        allowsMultipleSelection: true,
        selectionLimit: 6 - photos.length - existingPhotos.length,
      });
      if (result.canceled) return;
      const selected = result.assets
        .filter((asset): asset is typeof asset & { base64: string } =>
          Boolean(asset.base64),
        )
        .map((asset) => ({
          uri: asset.uri,
          base64: asset.base64,
          mimeType: asset.mimeType,
        }));
      setPhotos((current) => [...current, ...selected].slice(0, 6));
    } catch {
      setMessage(copy.saveFailed);
    }
  }

  async function removeExistingPhoto(attachment: RequestAttachment) {
    if (!client || saving) return;
    setSaving(true);
    setMessage(null);
    try {
      await deleteOwnRequestAttachment(client, attachment);
      setExistingPhotos((current) =>
        current.filter((item) => item.id !== attachment.id),
      );
    } catch {
      setMessage(copy.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    if (!client || !session || saving) return;
    const result = validateServiceRequestDraft(input);
    setValidation(result);
    if (Object.keys(result.errors).length > 0) {
      setStep(
        result.errors.serviceLocationId ||
          result.errors.problemDescription ||
          result.errors.serviceCategoryId ||
          result.errors.serviceItemId ||
          result.errors.quantity
          ? 0
          : 1,
      );
      scroll.current?.scrollTo({ y: 0, animated: false });
      setMessage(copy.saveFailed);
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const draft = await saveOwnRequestDraft(client, result.value);
      for (const photo of photos) {
        await uploadRequestImage(
          client,
          session.user.id,
          draft.id,
          photo.base64,
          photo.mimeType,
          Crypto.randomUUID(),
        );
      }
      setPhotos([]);
      setMessage(copy.savedDraft);
      router.replace({
        pathname: '/requests/saved',
        params: { requestId: draft.id },
      });
    } catch {
      setMessage(copy.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  const errorText = (field: keyof ServiceRequestValidation['errors']) => {
    const error = validation.errors[field];
    if (error === 'too_long') return copy.tooLong;
    return error ? copy[error] : null;
  };

  if (state === 'loading')
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.action} />
      </SafeAreaView>
    );
  if (state === 'error')
    return (
      <SafeAreaView style={styles.center}>
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {copy.loadFailed}
        </Text>
        <Pressable
          onPress={() => goBackOrReplace(router, '/requests')}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryText}>{copy.back}</Text>
        </Pressable>
      </SafeAreaView>
    );

  return (
    <SafeAreaView testID="request-form" style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          ref={scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={() =>
              step > 0
                ? changeStep(step - 1)
                : goBackOrReplace(router, '/requests')
            }
            style={styles.backButton}
          >
            <Text style={styles.backText}>{copy.back}</Text>
          </Pressable>
          <Text accessibilityRole="header" style={styles.title}>
            {input.requestId ? copy.editFormTitle : copy.formTitle}
          </Text>
          <Text style={styles.description}>{copy.formDescription}</Text>
          <View accessibilityRole="tablist" style={styles.steps}>
            {formSteps.map((label, index) => (
              <Pressable
                key={label}
                accessibilityRole="tab"
                accessibilityLabel={`ขั้น ${index + 1} ${label}`}
                accessibilityState={{
                  selected: step === index,
                  disabled: saving || index > step,
                }}
                disabled={saving || index > step}
                onPress={() => changeStep(index)}
                style={[styles.stepItem, step === index && styles.stepActive]}
              >
                <View
                  style={[
                    styles.stepNumber,
                    step === index && styles.stepNumberActive,
                  ]}
                >
                  {index < step ? (
                    <Check size={16} color={colors.primary} />
                  ) : (
                    <Text
                      style={[
                        styles.stepDigit,
                        step === index && styles.stepDigitActive,
                      ]}
                    >
                      {index + 1}
                    </Text>
                  )}
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    step === index && styles.stepLabelActive,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>
              {selectedItem?.name_th ?? selectedCategory?.name_th}
            </Text>
            <Text style={styles.summaryMeta}>
              {input.entryPoint === 'symptom'
                ? copy.newSymptomRequest
                : copy.newCatalogRequest}
            </Text>
          </View>

          {step === 0 ? (
            <>
              <FieldError
                text={
                  errorText('serviceCategoryId') || errorText('serviceItemId')
                }
                styles={styles}
              />

              <FormSection title={copy.locationLabel} styles={styles}>
                {locations.length === 0 ? (
                  <Pressable
                    onPress={() => router.push('/account/locations/new')}
                    style={styles.secondaryButton}
                  >
                    <Text style={styles.secondaryText}>{copy.addLocation}</Text>
                  </Pressable>
                ) : (
                  locations.map((location) => (
                    <Choice
                      key={location.id}
                      label={location.label}
                      selected={input.serviceLocationId === location.id}
                      onPress={() => update('serviceLocationId', location.id)}
                      styles={styles}
                    />
                  ))
                )}
                <FieldError
                  text={errorText('serviceLocationId')}
                  styles={styles}
                />
              </FormSection>

              <FormSection title={copy.descriptionLabel} styles={styles}>
                <TextInput
                  accessibilityLabel={copy.descriptionLabel}
                  multiline
                  onChangeText={(value) => update('problemDescription', value)}
                  placeholder={copy.descriptionPlaceholder}
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, styles.textArea]}
                  value={input.problemDescription}
                />
                <FieldError
                  text={errorText('problemDescription')}
                  styles={styles}
                />
              </FormSection>

              <FormSection title={copy.quantityLabel} styles={styles}>
                <View style={styles.counter}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="ลดจำนวน"
                    disabled={input.quantity <= 1}
                    onPress={() => update('quantity', input.quantity - 1)}
                    style={[
                      styles.counterButton,
                      input.quantity <= 1 && styles.disabled,
                    ]}
                  >
                    <Minus size={22} color={colors.surface} />
                  </Pressable>
                  <Text style={styles.quantity}>{input.quantity}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="เพิ่มจำนวน"
                    disabled={input.quantity >= 50}
                    onPress={() => update('quantity', input.quantity + 1)}
                    style={styles.counterButton}
                  >
                    <Plus size={22} color={colors.surface} />
                  </Pressable>
                </View>
                <FieldError text={errorText('quantity')} styles={styles} />
              </FormSection>
            </>
          ) : null}
          {step === 1 ? (
            <>
              <FormSection title={copy.urgencyLabel} styles={styles}>
                {urgencyOptions.map((urgency) => (
                  <Choice
                    key={urgency}
                    label={copy.urgency[urgency]}
                    selected={input.urgency === urgency}
                    onPress={() => update('urgency', urgency)}
                    styles={styles}
                  />
                ))}
              </FormSection>

              <FormSection title={copy.preferredDateLabel} styles={styles}>
                <Text style={styles.helper}>
                  วันที่และเวลานี้เป็นความสะดวกของคุณ
                  นัดหมายจะยืนยันอีกครั้งในข้อตกลงงาน
                </Text>
                <View style={styles.quickDates}>
                  {quickDates.map((date) => (
                    <Pressable
                      key={date.value}
                      accessibilityRole="radio"
                      accessibilityLabel={`วันที่สะดวก ${formatPreferredDateTh(date.value)}`}
                      accessibilityState={{
                        checked: input.preferredDate === date.value,
                      }}
                      onPress={() => update('preferredDate', date.value)}
                      style={[
                        styles.dateTile,
                        input.preferredDate === date.value &&
                          styles.dateTileSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dateLabel,
                          input.preferredDate === date.value &&
                            styles.dateTextSelected,
                        ]}
                      >
                        {date.label}
                      </Text>
                      <Text
                        style={[
                          styles.dateDay,
                          input.preferredDate === date.value &&
                            styles.dateTextSelected,
                        ]}
                      >
                        {date.day}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <PreferredDateField
                  clearLabel={copy.clearPreferredDate}
                  fontFamily={fonts.regular}
                  minimumDate={minimumPreferredDate}
                  onChange={(value) => update('preferredDate', value)}
                  placeholder={copy.preferredDatePlaceholder}
                  value={input.preferredDate}
                />
                <FieldError text={errorText('preferredDate')} styles={styles} />
                <Text style={styles.fieldLabel}>{copy.preferredTimeLabel}</Text>
                <View style={styles.timeChoices}>
                  {suggestedTimes.map((time) => (
                    <Pressable
                      key={time}
                      accessibilityRole="radio"
                      accessibilityLabel={`ช่วงเวลา ${time}`}
                      accessibilityState={{
                        checked: input.preferredTimeWindow === time,
                      }}
                      onPress={() => update('preferredTimeWindow', time)}
                      style={[
                        styles.timeChoice,
                        input.preferredTimeWindow === time &&
                          styles.choiceSelected,
                      ]}
                    >
                      <Text style={styles.timeText}>{time}</Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  accessibilityLabel={copy.preferredTimeLabel}
                  onChangeText={(value) => update('preferredTimeWindow', value)}
                  placeholder={copy.preferredTimePlaceholder}
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  value={input.preferredTimeWindow}
                />
                <FieldError
                  text={errorText('preferredTimeWindow')}
                  styles={styles}
                />
              </FormSection>

              <FormSection title={copy.photosLabel} styles={styles}>
                <Text style={styles.helper}>{copy.photosHelper}</Text>
                <View style={styles.photoGrid}>
                  {existingPhotos.map((photo, index) => (
                    <View key={photo.id} style={styles.photoWrap}>
                      <Image
                        accessible
                        accessibilityLabel={`รูปหน้างานเดิมที่ ${index + 1}`}
                        source={{ uri: photo.signedUrl }}
                        style={styles.photo}
                      />
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`ลบรูปเดิมที่ ${index + 1}`}
                        hitSlop={8}
                        onPress={() => void removeExistingPhoto(photo)}
                        style={styles.photoRemove}
                      >
                        <Text style={styles.photoRemoveText}>×</Text>
                      </Pressable>
                    </View>
                  ))}
                  {photos.map((photo, index) => (
                    <View
                      key={`${photo.uri}-${index}`}
                      style={styles.photoWrap}
                    >
                      <Image
                        accessible
                        accessibilityLabel={`รูปหน้างานใหม่ที่ ${index + 1}`}
                        source={{ uri: photo.uri }}
                        style={styles.photo}
                      />
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`ลบรูปใหม่ที่ ${index + 1}`}
                        hitSlop={8}
                        onPress={() =>
                          setPhotos((current) =>
                            current.filter(
                              (_, itemIndex) => itemIndex !== index,
                            ),
                          )
                        }
                        style={styles.photoRemove}
                      >
                        <Text style={styles.photoRemoveText}>×</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void choosePhotos()}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryText}>{copy.choosePhotos}</Text>
                </Pressable>
              </FormSection>
            </>
          ) : null}
          {step === 2 ? (
            <>
              <View style={styles.reviewCard}>
                <Text style={styles.sectionTitle}>สรุปคำขอรับบริการ</Text>
                <Text style={styles.reviewValue}>
                  {
                    locations.find(
                      (location) => location.id === input.serviceLocationId,
                    )?.label
                  }
                </Text>
                <Text style={styles.helper}>{input.problemDescription}</Text>
                <Text style={styles.helper}>
                  จำนวน {input.quantity} · {copy.urgency[input.urgency]}
                </Text>
                <Text style={styles.helper}>
                  {formatDraftScheduleTh(
                    input.preferredDate,
                    input.preferredTimeWindow,
                  ) || 'ยังไม่ระบุวันและเวลาที่สะดวก'}
                </Text>
                <Text style={styles.helper}>
                  รูปหน้างาน {photos.length + existingPhotos.length} รูป
                </Text>
              </View>

              <FormSection title={copy.safetyTitle} styles={styles}>
                <Text style={styles.helper}>{copy.safetyDescription}</Text>
                {safetyKeys.map((key) => (
                  <View
                    testID={`safety-${key}`}
                    key={key}
                    style={styles.safetyQuestion}
                  >
                    <Text style={styles.safetyQuestionText}>
                      {copy.safetyQuestions[key]}
                    </Text>
                    <View style={styles.binaryRow}>
                      <Choice
                        compact
                        label={copy.no}
                        selected={!input.safetyAnswers[key]}
                        onPress={() => updateSafety(key, false)}
                        styles={styles}
                      />
                      <Choice
                        compact
                        label={copy.yes}
                        selected={input.safetyAnswers[key]}
                        onPress={() => updateSafety(key, true)}
                        styles={styles}
                      />
                    </View>
                  </View>
                ))}
              </FormSection>
            </>
          ) : null}

          {stopCode ? (
            <View accessibilityLiveRegion="assertive" style={styles.safetyStop}>
              <Text style={styles.safetyStopTitle}>{copy.safetyStopTitle}</Text>
              <Text style={styles.safetyStopBody}>
                {copy.safetyStops[stopCode]}
              </Text>
              <Text style={styles.safetyDisclaimer}>
                {copy.emergencyDisclaimer}
              </Text>
            </View>
          ) : null}
          {message ? (
            <Text
              accessibilityLiveRegion="polite"
              style={
                message === copy.savedDraft ? styles.success : styles.error
              }
            >
              {message}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{
              disabled: saving || (step === 2 && Boolean(stopCode)),
            }}
            disabled={saving || (step === 2 && Boolean(stopCode))}
            onPress={() => (step < 2 ? changeStep(step + 1) : void save())}
            style={[
              styles.primaryButton,
              (saving || (step === 2 && Boolean(stopCode))) && styles.disabled,
            ]}
          >
            <Text style={styles.primaryText}>
              {step < 2 ? 'ถัดไป' : saving ? copy.savingDraft : copy.saveDraft}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FormSection({
  title,
  children,
  styles,
}: Readonly<{
  title: string;
  children: React.ReactNode;
  styles: ReturnType<typeof createStyles>;
}>) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}
function Choice({
  label,
  selected,
  onPress,
  compact = false,
  styles,
}: Readonly<{
  label: string;
  selected: boolean;
  onPress: () => void;
  compact?: boolean;
  styles: ReturnType<typeof createStyles>;
}>) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[
        styles.choice,
        compact && styles.compactChoice,
        selected && styles.choiceSelected,
      ]}
    >
      <View style={[styles.radio, selected && styles.radioSelected]} />
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}
function FieldError({
  text,
  styles,
}: Readonly<{ text: string | null; styles: ReturnType<typeof createStyles> }>) {
  return text ? (
    <Text accessibilityLiveRegion="polite" style={styles.error}>
      {text}
    </Text>
  ) : null;
}

function createStyles(fonts: ReturnType<typeof useAppFontFamilies>) {
  return StyleSheet.create({
    flex: { flex: 1 },
    safeArea: { flex: 1, backgroundColor: colors.background },
    center: {
      alignItems: 'center',
      backgroundColor: colors.background,
      flex: 1,
      gap: spacing.lg,
      justifyContent: 'center',
      padding: spacing.lg,
    },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl },
    steps: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
    stepItem: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
      gap: spacing.xs,
      padding: spacing.sm,
      borderRadius: radii.button,
      minHeight: 72,
    },
    stepActive: { backgroundColor: colors.mint },
    stepNumber: {
      backgroundColor: colors.surfaceMuted,
      width: 28,
      height: 28,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepNumberActive: { backgroundColor: colors.primary },
    stepDigit: {
      color: colors.textMuted,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
    },
    stepDigitActive: { color: colors.surface },
    stepLabel: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: 12,
      textAlign: 'center',
      lineHeight: 18,
    },
    stepLabelActive: { color: colors.primary, fontFamily: fonts.semiBold },
    quickDates: { flexDirection: 'row', gap: spacing.xs },
    dateTile: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: radii.button,
      paddingVertical: spacing.md,
    },
    dateTileSelected: { backgroundColor: colors.primary },
    dateLabel: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: 12,
    },
    dateDay: {
      color: colors.text,
      fontFamily: fonts.bold,
      fontSize: typography.sectionTitleSize,
      marginTop: spacing.xs,
    },
    dateTextSelected: { color: colors.surface },
    timeChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    timeChoice: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: radii.button,
      paddingHorizontal: spacing.md,
      minHeight: 44,
      justifyContent: 'center',
    },
    timeText: {
      color: colors.primary,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
    },
    reviewCard: {
      backgroundColor: colors.mint,
      borderRadius: radii.card,
      padding: spacing.lg,
      marginTop: spacing.lg,
      gap: spacing.sm,
    },
    reviewValue: {
      color: colors.primary,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
    },
    backButton: {
      alignSelf: 'flex-start',
      minHeight: 44,
      justifyContent: 'center',
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
      marginTop: spacing.md,
    },
    description: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.bodySize,
      lineHeight: 24,
      marginTop: spacing.sm,
    },
    summaryCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      marginTop: spacing.xl,
      padding: spacing.lg,
    },
    summaryTitle: {
      color: colors.text,
      fontFamily: fonts.semiBold,
      fontSize: typography.sectionTitleSize,
    },
    summaryMeta: {
      color: colors.primary,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      marginTop: spacing.xs,
    },
    section: { gap: spacing.md, marginTop: spacing.xxl },
    sectionTitle: {
      color: colors.text,
      fontFamily: fonts.bold,
      fontSize: typography.sectionTitleSize,
    },
    fieldLabel: {
      color: colors.text,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
      marginTop: spacing.md,
    },
    helper: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      lineHeight: 20,
    },
    input: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.button,
      borderWidth: 1,
      color: colors.text,
      fontFamily: fonts.regular,
      fontSize: typography.bodySize,
      minHeight: 52,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    textArea: { minHeight: 120, textAlignVertical: 'top' },
    choice: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.button,
      borderWidth: 1,
      flexDirection: 'row',
      minHeight: 52,
      paddingHorizontal: spacing.lg,
    },
    compactChoice: { flex: 1 },
    choiceSelected: { borderColor: colors.action },
    radio: {
      borderColor: colors.textMuted,
      borderRadius: radii.pill,
      borderWidth: 2,
      height: 20,
      marginRight: spacing.md,
      width: 20,
    },
    radioSelected: {
      backgroundColor: colors.action,
      borderColor: colors.action,
    },
    choiceText: {
      color: colors.text,
      fontFamily: fonts.regular,
      fontSize: typography.bodySize,
    },
    choiceTextSelected: { color: colors.primary, fontFamily: fonts.semiBold },
    counter: { alignItems: 'center', flexDirection: 'row', gap: spacing.xl },
    counterButton: {
      alignItems: 'center',
      backgroundColor: colors.text,
      borderRadius: radii.pill,
      height: 48,
      justifyContent: 'center',
      width: 48,
    },
    counterText: {
      color: colors.surface,
      fontFamily: fonts.semiBold,
      fontSize: typography.sectionTitleSize,
    },
    quantity: {
      color: colors.text,
      fontFamily: fonts.bold,
      fontSize: typography.sectionTitleSize,
      minWidth: 32,
      textAlign: 'center',
    },
    photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    photoWrap: { position: 'relative' },
    photo: { borderRadius: radii.button, height: 88, width: 88 },
    photoRemove: {
      alignItems: 'center',
      backgroundColor: colors.danger,
      borderRadius: radii.pill,
      height: 28,
      justifyContent: 'center',
      position: 'absolute',
      right: -4,
      top: -4,
      width: 28,
    },
    photoRemoveText: {
      color: colors.surface,
      fontFamily: fonts.bold,
      fontSize: typography.bodySize,
    },
    safetyQuestion: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      gap: spacing.md,
      padding: spacing.lg,
    },
    safetyQuestionText: {
      color: colors.text,
      fontFamily: fonts.regular,
      fontSize: typography.bodySize,
      lineHeight: 23,
    },
    binaryRow: { flexDirection: 'row', gap: spacing.md },
    safetyStop: {
      backgroundColor: colors.surface,
      borderColor: colors.danger,
      borderRadius: radii.card,
      borderWidth: 2,
      marginTop: spacing.xxl,
      padding: spacing.lg,
    },
    safetyStopTitle: {
      color: colors.danger,
      fontFamily: fonts.bold,
      fontSize: typography.bodySize,
    },
    safetyStopBody: {
      color: colors.text,
      fontFamily: fonts.regular,
      fontSize: typography.bodySize,
      lineHeight: 24,
      marginTop: spacing.sm,
    },
    safetyDisclaimer: {
      color: colors.danger,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
      marginTop: spacing.md,
    },
    primaryButton: {
      alignItems: 'center',
      backgroundColor: colors.action,
      borderRadius: radii.button,
      justifyContent: 'center',
      minHeight: 52,
      marginTop: spacing.xl,
      padding: spacing.md,
    },
    primaryText: {
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
      minHeight: 52,
      padding: spacing.md,
    },
    secondaryText: {
      color: colors.action,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
    },
    error: {
      color: colors.danger,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
    },
    success: {
      color: colors.success,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
      marginTop: spacing.xl,
    },
    disabled: { opacity: 0.45 },
  });
}
