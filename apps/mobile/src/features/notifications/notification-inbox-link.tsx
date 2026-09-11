import { colors, radii, spacing, typography } from '@homecare/design-tokens';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppFontFamilies } from '../../foundation/font-runtime';
import { useSession } from '../../providers/session-provider';
import { getUnreadNotificationCount } from './notification-inbox-api';

export function NotificationInboxLink({
  mode,
}: Readonly<{ mode: 'customer' | 'technician' }>) {
  const router = useRouter();
  const { client } = useSession();
  const [unreadCount, setUnreadCount] = useState(0);
  const styles = createStyles(useAppFontFamilies());

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (client) {
        void getUnreadNotificationCount(client)
          .then((count) => {
            if (active) setUnreadCount(count);
          })
          .catch(() => undefined);
      }
      return () => {
        active = false;
      };
    }, [client]),
  );

  const countLabel = unreadCount > 99 ? '99+' : String(unreadCount);
  return (
    <Pressable
      accessibilityLabel={
        unreadCount > 0
          ? `การแจ้งเตือน มี ${unreadCount} รายการที่ยังไม่ได้อ่าน`
          : 'การแจ้งเตือน ไม่มีรายการใหม่'
      }
      accessibilityRole="button"
      onPress={() =>
        router.push({ pathname: '/notifications' as never, params: { mode } })
      }
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Text style={styles.label}>การแจ้งเตือน</Text>
      {unreadCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{countLabel}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function createStyles(fonts: ReturnType<typeof useAppFontFamilies>) {
  return StyleSheet.create({
    button: {
      alignItems: 'center',
      alignSelf: 'flex-end',
      borderRadius: radii.button,
      flexDirection: 'row',
      gap: spacing.sm,
      minHeight: 44,
      paddingHorizontal: spacing.md,
    },
    label: {
      color: colors.action,
      fontFamily: fonts.semiBold,
      fontSize: typography.supportSize,
    },
    badge: {
      alignItems: 'center',
      backgroundColor: colors.danger,
      borderRadius: radii.pill,
      justifyContent: 'center',
      minHeight: 24,
      minWidth: 24,
      paddingHorizontal: spacing.xs,
    },
    badgeText: {
      color: colors.surface,
      fontFamily: fonts.bold,
      fontSize: typography.supportSize,
    },
    pressed: { opacity: 0.72 },
  });
}
