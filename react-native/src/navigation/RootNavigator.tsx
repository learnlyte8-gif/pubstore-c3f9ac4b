import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootTabs } from './RootTabs';
import { SplashScreen } from '@/screens/SplashScreen';
import { AuthScreen } from '@/screens/AuthScreen';
import { OnboardingScreen } from '@/screens/OnboardingScreen';
import { ProductDetailScreen } from '@/screens/ProductDetailScreen';
import { CartScreen } from '@/screens/CartScreen';
import { RidesScreen } from '@/screens/RidesScreen';
import { WebFallbackScreen } from '@/screens/WebFallbackScreen';
import { ThreadScreen } from '@/screens/ThreadScreen';
import { supabase } from '@/services/supabase';

export type RootStackParamList = {
  Splash: undefined;
  Auth: undefined;
  Onboarding: undefined;
  MainTabs: undefined;
  ProductDetail: { id: string };
  Cart: undefined;
  Rides: undefined;
  Thread: { conversationId: string; title?: string };
  WebFallback: { path: string; title?: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      // Tiny artificial delay so splash flashes naturally on cold-start.
      await new Promise((r) => setTimeout(r, 600));
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setInitialRoute(data.session ? 'MainTabs' : 'Onboarding');
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (!initialRoute) {
    return <SplashScreen />;
  }

  return (
    <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Auth" component={AuthScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="MainTabs" component={RootTabs} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
      <Stack.Screen name="Cart" component={CartScreen} />
      <Stack.Screen name="Rides" component={RidesScreen} />
      <Stack.Screen name="Thread" component={ThreadScreen} />
      <Stack.Screen name="WebFallback" component={WebFallbackScreen} />
    </Stack.Navigator>
  );
}
