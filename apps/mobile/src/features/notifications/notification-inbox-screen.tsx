import { colors, radii, spacing, typography } from '@homecare/design-tokens';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
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
import { useSession } from '../../providers/session-provider';
import { goBackOrReplace } from '../shared/navigation';
import {
  listNotificationInbox,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationInboxItem,
} from './notification-inbox-api';
import { parseJobNotificationRoute } from './notification-route';

export function NotificationInboxScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const fallback =
    params.mode === 'technician' ? '/technician/feed' : ('/' as const);
  const { client } = useSession();
  const [items, setItems] = useState<readonly NotificationInboxItem[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState(false);
  const styles = createStyles(useAppFontFamilies());

  const load = useCallback(async () => {
    if (!client) return;
    setState('loading');
    try {
      setItems(await listNotificationInbox(client));
      setState('ready');
    } catch {
      setState('error');
    }
  }, [client]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function openItem(item: NotificationInboxItem) {
    if (!client || busy) return;
    const route = parseJobNotificationRoute(item.deep_link);
    if (!route) return;
    setBusy(true);
    try {
      if (!item.read_at) await markNotificationRead(client, item.id);
      router.push(route as never);
    } finally {
      setBusy(false);
    }
  }

  async function markAllRead() {
    if (!client || busy) return;
    setBusy(true);
    try {
      await markAllNotificationsRead(client);
      await load();
    } finally {
      setBusy(false);
    }
  }

  const unreadCount = items.filter((item) => !item.read_at).length;
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          accessibilityRole="button"
          onPress={() => goBackOrReplace(router, fallback)}
          style={styles.backButton}
        >
          <Text style={styles.backText}>ย้อนกลับ</Text>
        </Pressable>
        <View style={styles.headingRow}>
          <View style={styles.headingCopy}>
            <Text accessibilityRole="header" style={styles.title}>
              การแจ้งเตือน
            </Text>
            <Text style={styles.description}>
              ติดตามสถานะงาน ข้อความ และเคสคุณภาพงานจาก HomeCare
            </Text>
          </View>
          {unreadCount > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={() => void markAllRead()}
              style={({ pressed }) => [
                styles.markAllButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.markAllText}>อ่านทั้งหมด</Text>
            </Pressable>
          ) : null}
        </View>

        {state === 'loading' ? (
          <ActivityIndicator color={colors.action} style={styles.loader} />
        ) : null}
        {state === 'error' ? (
          <View style={styles.card}>
            <Text accessibilityLiveRegion="polite" style={styles.error}>
              โหลดการแจ้งเตือนไม่สำเร็จ
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void load()}
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>ลองอีกครั้ง</Text>
            </Pressable>
          </View>
        ) : null}
        {state === 'ready' && items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.cardTitle}>ยังไม่มีการแจ้งเตือน</Text>
            <Text style={styles.body}>
              เมื่อมีความเคลื่อนไหวของงานหรือเคส ระบบจะแสดงรายการที่นี่
            </Text>
          </View>
        ) : null}
        <View style={styles.list}>
          {items.map((item) => (
            <Pressable
              accessibilityLabel={`${item.read_at ? 'อ่านแล้ว' : 'ยังไม่ได้อ่าน'} ${item.title}`}
              accessibilityRole="button"
              disabled={busy}
              key={item.id}
              onPress={() => void openItem(item)}
              style={({ pressed }) => [
                styles.card,
                !item.read_at && styles.unreadCard,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.cardHeading}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                {!item.read_at ? (
                  <Text style={styles.unreadLabel}>ใหม่</Text>
                ) : null}
              </View>
              <Text style={styles.body}>{item.body}</Text>
              <Text style={styles.time}>
                {formatNotificationTime(item.created_at)}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function formatNotificationTime(value: string) {
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function createStyles(fonts: ReturnType<typeof useAppFontFamilies>) {
  return StyleSheet.create({
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
    headingRow: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: spacing.md,
      justifyContent: 'space-between',
      marginTop: spacing.md,
    },
    headingCopy: { flex: 1 },
    title: {
      color: colors.text,
      fontFamily: fonts.bold,
      fontSize: typography.pageTitleSize,
      lineHeight: 42,
    },
    description: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.bodySize,
      lineHeight: 24,
      marginTop: spacing.sm,
    },
    markAllButton: {
      borderRadius: radii.button,
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: spacing.md,
    },
    markAllText: {
      color: colors.action,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
    },
    loader: { marginTop: spacing.xxl },
    list: { gap: spacing.md, marginTop: spacing.xl },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      gap: spacing.sm,
      padding: spacing.lg,
    },
    unreadCard: { borderColor: colors.action, borderWidth: 2 },
    emptyCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.card,
      borderWidth: 1,
      gap: spacing.sm,
      marginTop: spacing.xl,
      padding: spacing.xl,
    },
    cardHeading: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.sm,
      justifyContent: 'space-between',
    },
    cardTitle: {
      color: colors.text,
      flex: 1,
      fontFamily: fonts.bold,
      fontSize: typography.bodySize,
      lineHeight: 24,
    },
    unreadLabel: {
      color: colors.action,
      fontFamily: fonts.bold,
      fontSize: typography.supportSize,
    },
    body: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
      lineHeight: 22,
    },
    time: {
      color: colors.textMuted,
      fontFamily: fonts.regular,
      fontSize: typography.supportSize,
    },
    error: {
      color: colors.danger,
      fontFamily: fonts.regular,
      fontSize: typography.bodySize,
    },
    retryButton: {
      alignItems: 'center',
      borderColor: colors.action,
      borderRadius: radii.button,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 44,
    },
    retryText: {
      color: colors.action,
      fontFamily: fonts.semiBold,
      fontSize: typography.bodySize,
    },
    pressed: { opacity: 0.72 },
  });
}
