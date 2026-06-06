import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ENV } from '@/config/env';
import { theme } from '@/config/theme';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'WebFallback'>;

/**
 * Loads any route from the deployed PUBSTORE web app inside a hardened
 * WebView. Used until a screen is ported natively — keeps every feature
 * usable from day one.
 */
export function WebFallbackScreen({ route }: Props) {
  const path = route.params?.path ?? '/';
  const uri = `${ENV.WEB_APP_URL}${path}`;
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <WebView
        source={{ uri }}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        )}
        javaScriptEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
        allowsBackForwardNavigationGestures
        originWhitelist={['*']}
        setSupportMultipleWindows={false}
        pullToRefreshEnabled
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  loader: {
    position: 'absolute',
    inset: 0 as unknown as number,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
