import React from 'react';
import { WebFallbackScreen } from './WebFallbackScreen';

export function WishlistScreen() {
  return <WebFallbackScreen route={{ params: { path: '/wishlist' } } as any} navigation={undefined as any} />;
}
