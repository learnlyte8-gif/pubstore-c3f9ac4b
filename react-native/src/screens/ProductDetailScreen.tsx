import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { WebFallbackScreen } from './WebFallbackScreen';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'ProductDetail'>;

export function ProductDetailScreen({ route, navigation }: Props) {
  return (
    <WebFallbackScreen
      route={{ params: { path: `/product/${route.params.id}` } } as any}
      navigation={navigation as any}
    />
  );
}
