import React from 'react';
import { WebFallbackScreen } from './WebFallbackScreen';

// Until ported natively, render the web /home route in the WebView shell.
export function HomeScreen() {
  return <WebFallbackScreen route={{ params: { path: '/home' } } as any} navigation={undefined as any} />;
}
