import { colors, radii, spacing } from '@homecare/design-tokens';
import { useRouter } from 'expo-router';
import {
  Briefcase,
  ClipboardText,
  House,
  UserCircle,
  type IconProps,
} from 'phosphor-react-native';
import type { ComponentType } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppFontFamilies } from '../../foundation/font-runtime';

export type MobileNavigationKey = 'home' | 'requests' | 'jobs' | 'account';

type NavigationItem = Readonly<{
  key: MobileNavigationKey;
  label: string;
  href: '/' | '/requests' | '/jobs' | '/account';
  Icon: ComponentType<IconProps>;
}>;

const items: readonly NavigationItem[] = [
  { key: 'home', label: 'หน้าหลัก', href: '/', Icon: House },
  { key: 'requests', label: 'คำขอ', href: '/requests', Icon: ClipboardText },
  { key: 'jobs', label: 'งานของฉัน', href: '/jobs', Icon: Briefcase },
  { key: 'account', label: 'บัญชี', href: '/account', Icon: UserCircle },
];

export function MobileBottomNav({
  active,
}: Readonly<{ active: MobileNavigationKey }>) {
  const router = useRouter();
  const styles = createStyles(useAppFontFamilies());

  return (
    <View accessibilityRole="tablist" style={styles.shell}>
      {items.map(({ key, label, href, Icon }) => {
        const selected = key === active;
        return (
          <Pressable
            accessibilityLabel={label}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={key}
            onPress={() => router.replace(href as never)}
            style={({ pressed }) => [
              styles.item,
              selected && styles.itemSelected,
              pressed && styles.pressed,
            ]}
          >
            <Icon
              color={selected ? colors.surface : colors.textMuted}
              size={22}
              weight={selected ? 'fill' : 'regular'}
            />
            {selected ? (
              <Text style={[styles.label, styles.labelSelected]}>{label}</Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(fonts: ReturnType<typeof useAppFontFamilies>) {
  return StyleSheet.create({
    shell: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.navigation,
      borderWidth: 1,
      bottom: spacing.md,
      elevation: 8,
      flexDirection: 'row',
      gap: spacing.xs,
      justifyContent: 'space-between',
      left: spacing.lg,
      padding: spacing.xs,
      position: 'absolute',
      right: spacing.lg,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 18,
    },
    item: {
      alignItems: 'center',
      borderRadius: radii.pill,
      flex: 0.72,
      gap: 2,
      justifyContent: 'center',
      minHeight: 58,
      minWidth: 0,
      paddingHorizontal: spacing.xs,
    },
    itemSelected: { backgroundColor: colors.action, flex: 1.4 },
    label: {
      color: colors.textMuted,
      fontFamily: fonts.semiBold,
      fontSize: 12,
      lineHeight: 16,
    },
    labelSelected: { color: colors.surface },
    pressed: { opacity: 0.72 },
  });
}
