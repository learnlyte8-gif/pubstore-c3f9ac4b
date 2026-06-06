import React from 'react';
import { WebFallbackScreen } from './WebFallbackScreen';

export function CartScreen() {
  return <WebFallbackScreen route={{ params: { path: '/cart' } } as any} navigation={undefined as any} />;
}
