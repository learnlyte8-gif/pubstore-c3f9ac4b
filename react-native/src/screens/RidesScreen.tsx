import React from 'react';
import { WebFallbackScreen } from './WebFallbackScreen';

export function RidesScreen() {
  return <WebFallbackScreen route={{ params: { path: '/rides' } } as any} navigation={undefined as any} />;
}
