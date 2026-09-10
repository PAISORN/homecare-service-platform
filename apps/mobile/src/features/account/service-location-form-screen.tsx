import { colors, spacing } from '@homecare/design-tokens';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppFontFamilies } from '../../foundation/font-runtime';
import { serviceLocationCopyTh as copy } from '../../locales/th';
import { useSession } from '../../providers/session-provider';
import { getCurrentForegroundCoordinates } from '../location/foreground-location';
import { createFormStyles } from '../shared/form-styles';
import { goBackOrReplace } from '../shared/navigation';
import {
  emptyServiceLocationDraft,
  getOwnServiceLocation,
  saveOwnServiceLocation,
  serviceLocationToDraft,
  validateServiceLocationDraft,
  type ServiceLocationDraft,
  type ServiceLocationField,
  type ServiceLocationValidation,
} from './service-location-api';

export function ServiceLocationFormScreen({
  locationId,
}: Readonly<{ locationId?: string }>) {
  const router = useRouter();
  const { client } = useSession();
  const [draft, setDraft] = useState<ServiceLocationDraft>(
    emptyServiceLocationDraft,
  );
  const [validation, setValidation] = useState<ServiceLocationValidation>({
    value: emptyServiceLocationDraft,
    errors: {},
  });
  const [loading, setLoading] = useState(Boolean(locationId));
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [existingDefault, setExistingDefault] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [coordinatesChanged, setCoordinatesChanged] = useState(false);
  const styles = createFormStyles(useAppFontFamilies());

  useEffect(() => {
    if (!client || !locationId) return;
    let active = true;
    void getOwnServiceLocation(client, locationId)
      .then((location) => {
        if (!active) return;
        if (!location) {
          setLoadError(copy.notFound);
          return;
        }
        setDraft(serviceLocationToDraft(location));
        setExistingDefault(location.is_default);
      })
      .catch(() => {
        if (active) setLoadError(copy.loadFailed);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [client, locationId]);

  function updateDraft<Key extends keyof ServiceLocationDraft>(
    key: Key,
    value: ServiceLocationDraft[Key],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
    setSaveError(null);
    if (key !== 'isDefault') {
      setValidation((current) => ({
        ...current,
        errors: { ...current.errors, [key]: undefined },
      }));
    }
  }

  async function save() {
    if (!client || saving) return;
    const result = validateServiceLocationDraft(draft);
    setValidation(result);
    if (Object.keys(result.errors).length > 0) return;

    setSaving(true);
    setSaveError(null);
    try {
      await saveOwnServiceLocation(
        client,
        result.value,
        locationId,
        coordinatesChanged,
      );
      router.replace('/account/locations');
    } catch {
      setSaveError(copy.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  async function captureLocation() {
    if (locating) return;
    setLocating(true);
    setLocationError(null);
    try {
      const coordinates = await getCurrentForegroundCoordinates();
      setDraft((current) => ({
        ...current,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      }));
      setCoordinatesChanged(true);
    } catch {
      setLocationError(copy.locationFailed);
    } finally {
      setLocating(false);
    }
  }

  const fieldError = (field: ServiceLocationField) => {
    const error = validation.errors[field];
    if (error === 'required') return copy.required;
    if (error === 'too_long') return copy.tooLong;
    return undefined;
  };

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
          <Pressable
            accessibilityRole="button"
            onPress={() => goBackOrReplace(router, '/account/locations')}
            style={({ pressed }) => [
              styles.secondaryButton,
              locationStyles.backButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.secondaryButtonText}>{copy.back}</Text>
          </Pressable>
          <Text accessibilityRole="header" style={styles.title}>
            {locationId ? copy.editTitle : copy.newTitle}
          </Text>
          <Text style={styles.description}>{copy.formDescription}</Text>

          {loading ? (
            <View style={styles.card}>
              <ActivityIndicator color={colors.action} />
              <Text style={styles.cardBody}>{copy.loading}</Text>
            </View>
          ) : loadError ? (
            <View accessibilityLiveRegion="polite" style={styles.card}>
              <Text style={styles.error}>{loadError}</Text>
            </View>
          ) : (
            <>
              <LocationField
                error={fieldError('label')}
                label={copy.labelLabel}
                maxLength={80}
                onChangeText={(value) => updateDraft('label', value)}
                placeholder={copy.labelPlaceholder}
                styles={styles}
                value={draft.label}
              />
              <LocationField
                error={fieldError('addressLine')}
                label={copy.addressLabel}
                maxLength={500}
                multiline
                onChangeText={(value) => updateDraft('addressLine', value)}
                placeholder={copy.addressPlaceholder}
                styles={styles}
                value={draft.addressLine}
              />
              <LocationField
                error={fieldError('building')}
                label={copy.buildingLabel}
                maxLength={160}
                onChangeText={(value) => updateDraft('building', value)}
                styles={styles}
                value={draft.building}
              />
              <LocationField
                error={fieldError('floor')}
                label={copy.floorLabel}
                maxLength={40}
                onChangeText={(value) => updateDraft('floor', value)}
                styles={styles}
                value={draft.floor}
              />
              <LocationField
                error={fieldError('unit')}
                label={copy.unitLabel}
                maxLength={40}
                onChangeText={(value) => updateDraft('unit', value)}
                styles={styles}
                value={draft.unit}
              />
              <LocationField
                error={fieldError('accessInstructions')}
                label={copy.accessLabel}
                maxLength={500}
                multiline
                onChangeText={(value) =>
                  updateDraft('accessInstructions', value)
                }
                placeholder={copy.accessPlaceholder}
                styles={styles}
                value={draft.accessInstructions}
              />

              <View style={[styles.card, locationStyles.locationCard]}>
                <Text style={styles.cardTitle}>{copy.pinTitle}</Text>
                <Text style={styles.cardBody}>{copy.pinDescription}</Text>
                {draft.latitude !== null && draft.longitude !== null ? (
                  <Text accessibilityLiveRegion="polite" style={styles.helper}>
                    {copy.pinReady}
                  </Text>
                ) : null}
                {locationError ? (
                  <Text accessibilityLiveRegion="polite" style={styles.error}>
                    {locationError}
                  </Text>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: locating }}
                  disabled={locating}
                  onPress={() => void captureLocation()}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    locationStyles.locationButton,
                    locating && styles.buttonDisabled,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  {locating ? (
                    <ActivityIndicator color={colors.action} />
                  ) : (
                    <Text style={styles.secondaryButtonText}>
                      {draft.latitude === null
                        ? copy.useCurrentLocation
                        : copy.updateCurrentLocation}
                    </Text>
                  )}
                </Pressable>
              </View>

              <View style={[styles.card, locationStyles.defaultCard]}>
                <View style={locationStyles.defaultRow}>
                  <View style={locationStyles.defaultText}>
                    <Text style={styles.cardTitle}>{copy.makeDefault}</Text>
                    {existingDefault ? (
                      <Text style={styles.cardBody}>{copy.defaultLocked}</Text>
                    ) : null}
                  </View>
                  <Switch
                    accessibilityLabel={copy.makeDefault}
                    disabled={existingDefault}
                    onValueChange={(value) => updateDraft('isDefault', value)}
                    thumbColor={colors.surface}
                    trackColor={{
                      false: colors.border,
                      true: colors.primary,
                    }}
                    value={draft.isDefault}
                  />
                </View>
              </View>

              {saveError ? (
                <Text accessibilityLiveRegion="polite" style={styles.error}>
                  {saveError}
                </Text>
              ) : null}
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={() => void save()}
                style={({ pressed }) => [
                  styles.primaryButton,
                  saving && styles.buttonDisabled,
                  pressed && styles.buttonPressed,
                ]}
              >
                {saving ? (
                  <ActivityIndicator color={colors.surface} />
                ) : (
                  <Text style={styles.primaryButtonText}>{copy.save}</Text>
                )}
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function LocationField({
  error,
  label,
  maxLength,
  multiline = false,
  onChangeText,
  placeholder,
  styles,
  value,
}: Readonly<{
  error?: string;
  label: string;
  maxLength: number;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  placeholder?: string;
  styles: ReturnType<typeof createFormStyles>;
  value: string;
}>) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        maxLength={maxLength}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={[
          styles.input,
          multiline ? locationStyles.multilineInput : null,
          error ? styles.inputError : null,
        ]}
        textAlignVertical={multiline ? 'top' : 'center'}
        value={value}
      />
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const locationStyles = StyleSheet.create({
  backButton: { alignSelf: 'flex-start', marginTop: 0 },
  defaultCard: { marginTop: spacing.xl },
  locationCard: { gap: spacing.sm, marginTop: spacing.xl },
  locationButton: { marginTop: spacing.sm },
  defaultRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.lg,
  },
  defaultText: { flex: 1 },
  multilineInput: { minHeight: 104, paddingVertical: spacing.md },
});
