import { colors, radii, spacing, typography } from '@homecare/design-tokens';
import {
  Redirect,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { ArrowLeft, SealCheck, UserCircle } from 'phosphor-react-native';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppFontFamilies } from '../../foundation/font-runtime';
import {
  requestShortlistCopyTh as shortlist,
  requestTechnicianCopyTh as copy,
} from '../../locales/th';
import { useSession } from '../../providers/session-provider';
import { goBackOrReplace } from '../shared/navigation';
import {
  formatLaborAmount,
  getShortlistPrice,
  listCustomerRequestShortlist,
  selectTechnicianForRequest,
  type CustomerRequestShortlistItem,
} from './service-request-api';

export function RequestTechnicianScreen() {
  const router = useRouter();
  const { requestId, technicianId } = useLocalSearchParams<{
    requestId?: string;
    technicianId?: string;
  }>();
  const { client } = useSession();
  const [items, setItems] = useState<readonly CustomerRequestShortlistItem[]>(
    [],
  );
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectionError, setSelectionError] = useState(false);
  const submission = useRef(false);
  const styles = createStyles(useAppFontFamilies());

  useFocusEffect(
    useCallback(() => {
      if (!client || !requestId) return;
      let current = true;
      setState('loading');
      setConfirming(false);
      void listCustomerRequestShortlist(client, requestId)
        .then((data) => {
          if (current) {
            setItems(data);
            setState('ready');
          }
        })
        .catch(() => {
          if (current) setState('error');
        });
      return () => {
        current = false;
      };
    }, [client, requestId]),
  );

  if (!requestId || !technicianId) return <Redirect href="/requests" />;
  const item = items.find(
    (candidate) => candidate.technician_id === technicianId,
  );
  const price = item ? getShortlistPrice(item) : null;
  const canSelect =
    item?.request_status === 'matching' &&
    !items.some((candidate) => candidate.is_selected) &&
    price?.ready === true;

  function back() {
    goBackOrReplace(router, {
      pathname: '/requests/shortlist',
      params: { requestId },
    });
  }

  async function select() {
    if (!client || !item || !canSelect || submission.current) return;
    submission.current = true;
    setBusy(true);
    setSelectionError(false);
    try {
      await selectTechnicianForRequest(client, requestId!, item.technician_id);
      router.replace({
        pathname: '/requests/agreement',
        params: { requestId },
      });
    } catch {
      setSelectionError(true);
      setConfirming(false);
    } finally {
      submission.current = false;
      setBusy(false);
    }
  }

  return (
    <SafeAreaView testID="request-technician-profile" style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.backToShortlist}
          disabled={busy}
          onPress={back}
          style={styles.back}
        >
          <ArrowLeft color={colors.primary} size={22} />
          <Text style={styles.link}>{copy.backToShortlist}</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>
          {copy.title}
        </Text>
        {state === 'loading' ? (
          <ActivityIndicator
            accessibilityLabel="กำลังโหลดข้อมูลช่าง"
            color={colors.action}
            style={styles.section}
          />
        ) : null}
        {state === 'error' ? (
          <View style={styles.section}>
            <Text accessibilityLiveRegion="polite" style={styles.error}>
              {shortlist.loadFailed}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.replace({
                  pathname: '/requests/shortlist',
                  params: { requestId },
                })
              }
              style={styles.button}
            >
              <Text style={styles.buttonText}>{copy.backToShortlist}</Text>
            </Pressable>
          </View>
        ) : null}
        {state === 'ready' && !item ? (
          <Text accessibilityLiveRegion="polite" style={styles.body}>
            {copy.unavailable}
          </Text>
        ) : null}
        {state === 'ready' && item && price ? (
          <>
            <View style={styles.hero}>
              <View style={styles.avatar}>
                <UserCircle color={colors.primary} size={84} weight="duotone" />
              </View>
              <Text accessibilityRole="header" style={styles.name}>
                {item.display_name}
              </Text>
              <View style={styles.verified}>
                <SealCheck color={colors.mint} size={20} />
                <Text style={styles.verifiedText}>{copy.verified}</Text>
              </View>
            </View>
            <View style={styles.facts}>
              <View style={styles.fact}>
                <Text style={styles.caption}>{copy.experience}</Text>
                <Text style={styles.value}>
                  {item.years_experience === null
                    ? copy.noExperience
                    : `${item.years_experience} ปี`}
                </Text>
              </View>
              <View style={styles.fact}>
                <Text style={styles.caption}>{copy.verification}</Text>
                <Text style={styles.value}>{copy.verified}</Text>
              </View>
            </View>
            <View style={styles.section}>
              <Text style={styles.heading}>{copy.about}</Text>
              <Text style={styles.body}>
                {item.technician_bio || copy.noBio}
              </Text>
            </View>
            <View style={styles.priceCard}>
              <Text style={styles.caption}>{copy.priceContext}</Text>
              <Text style={styles.heading}>
                {item.price_model === 'evidence_quote'
                  ? shortlist.quotationTitle
                  : shortlist.catalogPriceTitle}
              </Text>
              {price.ready && price.amount !== null ? (
                <Text style={styles.amount}>
                  {formatLaborAmount(price.amount, price.currency)}
                </Text>
              ) : (
                <Text style={styles.pending}>
                  {item.price_model === 'evidence_quote'
                    ? shortlist.waitingForQuotation
                    : shortlist.waitingForCatalogPrice}
                </Text>
              )}
              <Text style={styles.heading}>{copy.scope}</Text>
              <Text style={styles.body}>
                {item.quotation_scope_description ||
                  (item.price_model === 'evidence_quote'
                    ? shortlist.waitingForQuotation
                    : copy.catalogScope)}
              </Text>
            </View>
            {item.is_selected ? (
              <View style={styles.section}>
                <Text style={styles.body}>{shortlist.selectedNotice}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: '/requests/agreement',
                      params: { requestId },
                    })
                  }
                  style={styles.button}
                >
                  <Text style={styles.buttonText}>{copy.agreement}</Text>
                </Pressable>
              </View>
            ) : canSelect ? (
              <>
                {confirming ? (
                  <View style={styles.confirmation}>
                    <Text style={styles.heading}>{shortlist.confirmTitle}</Text>
                    <Text style={styles.body}>
                      {shortlist.confirmBody(
                        item.display_name,
                        formatLaborAmount(price.amount!, price.currency),
                      )}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={() => void select()}
                      style={[styles.button, busy && styles.disabled]}
                    >
                      {busy ? (
                        <ActivityIndicator color={colors.surface} />
                      ) : (
                        <Text style={styles.buttonText}>
                          {shortlist.confirm}
                        </Text>
                      )}
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={() => setConfirming(false)}
                      style={styles.back}
                    >
                      <Text style={styles.link}>{shortlist.keepComparing}</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setConfirming(true)}
                    style={styles.button}
                  >
                    <Text style={styles.buttonText}>
                      {shortlist.chooseTechnician}
                    </Text>
                  </Pressable>
                )}
              </>
            ) : (
              <Text style={styles.body}>
                {price.ready ? copy.selectionUnavailable : ''}
              </Text>
            )}
            {selectionError ? (
              <Text accessibilityLiveRegion="polite" style={styles.error}>
                {shortlist.selectFailedBody}
              </Text>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(fonts: ReturnType<typeof useAppFontFamilies>) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl },
    back: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      minHeight: 48,
      alignSelf: 'flex-start',
    },
    link: {
      color: colors.primary,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
    },
    title: {
      color: colors.text,
      fontFamily: fonts.bold,
      fontSize: typography.pageTitleSize,
      marginTop: spacing.md,
    },
    hero: {
      backgroundColor: colors.primary,
      borderRadius: radii.card,
      alignItems: 'center',
      padding: spacing.xl,
      marginTop: spacing.lg,
    },
    avatar: {
      backgroundColor: colors.mint,
      borderRadius: radii.card,
      width: 112,
      height: 112,
      alignItems: 'center',
      justifyContent: 'center',
    },
    name: {
      color: colors.surface,
      fontFamily: fonts.bold,
      fontSize: typography.sectionTitleSize,
      textAlign: 'center',
      marginTop: spacing.md,
    },
    verified: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    verifiedText: {
      color: colors.mint,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
    },
    facts: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    fact: {
      flex: 1,
      minWidth: 130,
      backgroundColor: colors.surface,
      borderRadius: radii.button,
      padding: spacing.md,
    },
    caption: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      lineHeight: 21,
    },
    value: {
      color: colors.primary,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
      marginTop: spacing.xs,
    },
    section: { marginTop: spacing.xl },
    heading: {
      color: colors.text,
      fontFamily: fonts.bold,
      fontSize: typography.sectionTitleSize,
      marginTop: spacing.sm,
    },
    body: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.bodySize,
      lineHeight: 24,
      marginTop: spacing.sm,
    },
    priceCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radii.card,
      padding: spacing.lg,
      marginTop: spacing.xl,
    },
    amount: {
      color: colors.primary,
      fontFamily: fonts.bold,
      fontSize: typography.pageTitleSize,
      marginVertical: spacing.sm,
    },
    pending: {
      color: colors.warning,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      lineHeight: 21,
      marginVertical: spacing.sm,
    },
    button: {
      backgroundColor: colors.action,
      borderRadius: radii.button,
      minHeight: 52,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.md,
      marginTop: spacing.lg,
    },
    buttonText: {
      color: colors.surface,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
    },
    confirmation: {
      backgroundColor: colors.mint,
      padding: spacing.lg,
      borderRadius: radii.card,
      marginTop: spacing.lg,
    },
    error: {
      color: colors.danger,
      fontFamily: fonts.regular,
      fontSize: typography.bodySize,
      marginTop: spacing.md,
    },
    disabled: { opacity: 0.5 },
  });
}
