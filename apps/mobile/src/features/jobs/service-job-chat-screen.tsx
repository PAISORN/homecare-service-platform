import { colors, radii, spacing, typography } from '@homecare/design-tokens';
import * as Crypto from 'expo-crypto';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppFontFamilies } from '../../foundation/font-runtime';
import { serviceJobChatCopyTh as copy } from '../../locales/th';
import { useSession } from '../../providers/session-provider';
import { goBackOrReplace } from '../shared/navigation';
import {
  getServiceJobChatRoom,
  listServiceJobMessages,
  mergeServiceJobMessage,
  sendServiceJobMessage,
  serviceJobMessageMaxLength,
  subscribeToServiceJobMessages,
  validateServiceJobMessage,
  type ServiceJobChatConnectionState,
  type ServiceJobChatRoom,
  type ServiceJobMessage,
} from './service-job-chat-api';
import {
  getServiceJob,
  type ServiceJobActorRole,
  type ServiceJobDetail,
} from './service-jobs-api';

type Props = Readonly<{
  mode: ServiceJobActorRole;
  fallback: '/jobs/detail' | '/technician/jobs/detail';
}>;

export function ServiceJobChatScreen({ mode, fallback }: Props) {
  const router = useRouter();
  const listRef = useRef<FlatList<ServiceJobMessage>>(null);
  const { jobId } = useLocalSearchParams<{ jobId?: string }>();
  const { client, session } = useSession();
  const [job, setJob] = useState<ServiceJobDetail | null>(null);
  const [room, setRoom] = useState<ServiceJobChatRoom | null>(null);
  const [messages, setMessages] = useState<readonly ServiceJobMessage[]>([]);
  const [body, setBody] = useState('');
  const [screenState, setScreenState] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [connectionState, setConnectionState] =
    useState<ServiceJobChatConnectionState>('connecting');
  const [sending, setSending] = useState(false);
  const styles = createStyles(useAppFontFamilies());
  const validBody = useMemo(() => validateServiceJobMessage(body), [body]);

  const load = useCallback(async () => {
    if (!client || !jobId) {
      setScreenState('error');
      return;
    }
    setScreenState('loading');
    try {
      const [nextJob, nextRoom] = await Promise.all([
        getServiceJob(client, jobId),
        getServiceJobChatRoom(client, jobId),
      ]);
      if (nextJob.actor_role !== mode) throw new Error('actor_role_mismatch');
      const nextMessages = await listServiceJobMessages(client, nextRoom.id);
      setJob(nextJob);
      setRoom(nextRoom);
      setMessages(nextMessages);
      setScreenState('ready');
    } catch {
      setScreenState('error');
    }
  }, [client, jobId, mode]);

  useFocusEffect(useCallback(() => void load(), [load]));

  useEffect(() => {
    if (!client || !room || screenState !== 'ready') return;
    let mounted = true;
    const unsubscribe = subscribeToServiceJobMessages(
      client,
      room.topic,
      (message) => {
        if (mounted) {
          setMessages((current) => mergeServiceJobMessage(current, message));
        }
      },
      (state) => {
        if (!mounted) return;
        setConnectionState(state);
        if (state === 'live') {
          void listServiceJobMessages(client, room.id)
            .then((persisted) => {
              if (mounted) {
                setMessages((current) =>
                  persisted.reduce<readonly ServiceJobMessage[]>(
                    (next, message) => mergeServiceJobMessage(next, message),
                    current,
                  ),
                );
              }
            })
            .catch(() => {
              if (mounted) setConnectionState('unavailable');
            });
        }
      },
    );
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [client, room, screenState]);

  async function send() {
    if (!client || !jobId || !validBody || sending) return;
    const nextBody = validBody;
    setSending(true);
    try {
      const message = await sendServiceJobMessage(
        client,
        jobId,
        Crypto.randomUUID(),
        nextBody,
      );
      setMessages((current) => mergeServiceJobMessage(current, message));
      setBody('');
    } catch {
      Alert.alert(copy.sendFailedTitle, copy.sendFailedBody);
    } finally {
      setSending(false);
    }
  }

  const counterpartName = job
    ? mode === 'customer'
      ? job.technician_display_name
      : job.customer_display_name
    : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? spacing.sm : 0}
        style={styles.flex}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              goBackOrReplace(router, {
                pathname: fallback as never,
                params: { jobId },
              } as never)
            }
            style={styles.backButton}
          >
            <Text style={styles.backText}>{copy.back}</Text>
          </Pressable>
          <Text accessibilityRole="header" style={styles.title}>
            {copy.title}
          </Text>
          {job ? (
            <>
              <Text selectable style={styles.jobNumber}>
                {job.job_number}
              </Text>
              <Text style={styles.counterpart}>
                {mode === 'customer'
                  ? copy.technician(counterpartName ?? '')
                  : copy.customer(counterpartName ?? '')}
              </Text>
            </>
          ) : null}
          {connectionState === 'connecting' && screenState === 'ready' ? (
            <Text accessibilityLiveRegion="polite" style={styles.connection}>
              {copy.connecting}
            </Text>
          ) : null}
          {connectionState === 'unavailable' && screenState === 'ready' ? (
            <Text accessibilityLiveRegion="polite" style={styles.connection}>
              {copy.liveUnavailable}
            </Text>
          ) : null}
        </View>

        {screenState === 'loading' ? (
          <ActivityIndicator color={colors.action} style={styles.loader} />
        ) : null}
        {screenState === 'error' ? (
          <View style={styles.errorGroup}>
            <Text accessibilityLiveRegion="polite" style={styles.error}>
              {copy.loadFailed}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void load()}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryText}>{copy.retry}</Text>
            </Pressable>
          </View>
        ) : null}

        {screenState === 'ready' ? (
          <>
            <FlatList
              contentContainerStyle={[
                styles.messageList,
                messages.length === 0 && styles.emptyList,
              ]}
              data={messages}
              keyExtractor={(message) => message.id}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>{copy.emptyTitle}</Text>
                  <Text style={styles.emptyBody}>{copy.emptyBody}</Text>
                </View>
              }
              onContentSizeChange={() =>
                listRef.current?.scrollToEnd({ animated: false })
              }
              ref={listRef}
              renderItem={({ item }) => (
                <MessageBubble
                  currentUserId={session?.user.id ?? ''}
                  message={item}
                  styles={styles}
                />
              )}
            />
            <View style={styles.composer}>
              <Text style={styles.label}>{copy.messageLabel}</Text>
              <View style={styles.composerRow}>
                <TextInput
                  accessibilityLabel={copy.messageLabel}
                  editable={!sending}
                  maxLength={serviceJobMessageMaxLength}
                  multiline
                  onChangeText={setBody}
                  onSubmitEditing={() => void send()}
                  placeholder={copy.messagePlaceholder}
                  placeholderTextColor={colors.textMuted}
                  returnKeyType="send"
                  style={styles.input}
                  value={body}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !validBody || sending }}
                  disabled={!validBody || sending}
                  onPress={() => void send()}
                  style={({ pressed }) => [
                    styles.sendButton,
                    (!validBody || sending) && styles.disabled,
                    pressed && styles.pressed,
                  ]}
                >
                  {sending ? (
                    <ActivityIndicator color={colors.surface} />
                  ) : (
                    <Text style={styles.sendText}>{copy.send}</Text>
                  )}
                </Pressable>
              </View>
              <Text style={styles.helper}>{copy.messageHelper}</Text>
            </View>
          </>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const MessageBubble = memo(function MessageBubble({
  currentUserId,
  message,
  styles,
}: Readonly<{
  currentUserId: string;
  message: ServiceJobMessage;
  styles: ReturnType<typeof createStyles>;
}>) {
  const own = message.sender_user_id === currentUserId;
  return (
    <View style={[styles.messageRow, own && styles.ownMessageRow]}>
      <View
        style={[styles.bubble, own ? styles.ownBubble : styles.otherBubble]}
      >
        <Text style={own ? styles.ownBody : styles.otherBody}>
          {message.body}
        </Text>
        <Text style={own ? styles.ownTime : styles.otherTime}>
          {formatMessageTime(message.created_at)}
        </Text>
      </View>
    </View>
  );
});

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function createStyles(fonts: ReturnType<typeof useAppFontFamilies>) {
  return StyleSheet.create({
    flex: { flex: 1 },
    safeArea: { flex: 1, backgroundColor: colors.background },
    header: {
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      paddingBottom: spacing.md,
      paddingHorizontal: spacing.lg,
    },
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
      marginTop: spacing.xs,
    },
    jobNumber: {
      color: colors.primary,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
      marginTop: spacing.sm,
    },
    counterpart: {
      color: colors.text,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
      marginTop: spacing.xs,
    },
    connection: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      marginTop: spacing.xs,
    },
    loader: { marginTop: spacing.xxl },
    errorGroup: { gap: spacing.md, padding: spacing.lg },
    error: {
      color: colors.danger,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
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
    },
    messageList: {
      gap: spacing.sm,
      padding: spacing.lg,
      paddingBottom: spacing.xl,
    },
    emptyList: { flexGrow: 1, justifyContent: 'center' },
    emptyCard: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      padding: spacing.xl,
    },
    emptyTitle: {
      color: colors.text,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
    },
    emptyBody: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      lineHeight: 21,
      marginTop: spacing.sm,
      textAlign: 'center',
    },
    messageRow: { alignItems: 'flex-start' },
    ownMessageRow: { alignItems: 'flex-end' },
    bubble: {
      borderRadius: radii.card,
      maxWidth: '82%',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    ownBubble: { backgroundColor: colors.action },
    otherBubble: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
    },
    ownBody: {
      color: colors.surface,
      fontFamily: fonts.regular,
      fontSize: typography.bodySize,
      lineHeight: 24,
    },
    otherBody: {
      color: colors.text,
      fontFamily: fonts.regular,
      fontSize: typography.bodySize,
      lineHeight: 24,
    },
    ownTime: {
      color: colors.surface,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      marginTop: spacing.xs,
      opacity: 0.8,
    },
    otherTime: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      marginTop: spacing.xs,
    },
    composer: {
      backgroundColor: colors.surface,
      borderTopColor: colors.border,
      borderTopWidth: 1,
      padding: spacing.lg,
    },
    label: {
      color: colors.text,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
      marginBottom: spacing.sm,
    },
    composerRow: {
      alignItems: 'flex-end',
      flexDirection: 'row',
      gap: spacing.sm,
    },
    input: {
      backgroundColor: colors.background,
      borderColor: colors.border,
      borderRadius: radii.button,
      borderWidth: 1,
      color: colors.text,
      flex: 1,
      fontFamily: fonts.regular,
      fontSize: typography.bodySize,
      maxHeight: 120,
      minHeight: 48,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    sendButton: {
      alignItems: 'center',
      backgroundColor: colors.action,
      borderRadius: radii.button,
      justifyContent: 'center',
      minHeight: 48,
      minWidth: 64,
      paddingHorizontal: spacing.md,
    },
    sendText: {
      color: colors.surface,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
    },
    helper: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      marginTop: spacing.sm,
    },
    disabled: { opacity: 0.5 },
    pressed: { opacity: 0.76 },
  });
}
