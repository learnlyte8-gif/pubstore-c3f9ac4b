import React from 'react';
import { WebFallbackScreen } from './WebFallbackScreen';

export function ProfileScreen() {
  return <WebFallbackScreen route={{ params: { path: '/account' } } as any} navigation={undefined as any} />;
}
