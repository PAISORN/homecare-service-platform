import { colors } from '@homecare/design-tokens';
import { ActivityIndicator, Pressable, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppFontFamilies } from '../../foundation/font-runtime';
import { sessionCopyTh } from '../../locales/th';
import { useSession } from '../../providers/session-provider';
import { createFormStyles } from '../shared/form-styles';

export function SessionStateScreen({
  state,
}: Readonly<{ state: 'hydrating' | 'misconfigured' | 'blocked' }>) {
  const { client } = useSession();
  const styles = createFormStyles(useAppFontFamilies());

  if (state === 'hydrating') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ActivityIndicator color={colors.action} />
          <Text accessibilityLiveRegion="polite" style={styles.description}>
            {sessionCopyTh.loading}
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const title =
    state === 'misconfigured'
      ? sessionCopyTh.configTitle
      : sessionCopyTh.blockedTitle;
  const description =
    state === 'misconfigured'
      ? sessionCopyTh.configDescription
      : sessionCopyTh.blockedDescription;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        <Text style={styles.description}>{description}</Text>
        {state === 'blocked' ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void client?.auth.signOut()}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {sessionCopyTh.signOut}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
