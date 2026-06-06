import React from 'react';
import { WebFallbackScreen } from './WebFallbackScreen';

export function MessagesScreen() {
  return <WebFallbackScreen route={{ params: { path: '/messages' } } as any} navigation={undefined as any} />;
}
