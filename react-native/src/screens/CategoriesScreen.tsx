import React from 'react';
import { WebFallbackScreen } from './WebFallbackScreen';

export function CategoriesScreen() {
  return <WebFallbackScreen route={{ params: { path: '/categories' } } as any} navigation={undefined as any} />;
}
