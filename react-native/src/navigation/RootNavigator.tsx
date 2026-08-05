import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootTabs } from './RootTabs';
import { SplashScreen } from '@/screens/SplashScreen';
import { AuthScreen } from '@/screens/AuthScreen';
import { OnboardingScreen } from '@/screens/OnboardingScreen';
import { ProductDetailScreen } from '@/screens/ProductDetailScreen';
import { CartScreen } from '@/screens/CartScreen';
import { RidesScreen } from '@/screens/RidesScreen';
import { ThreadScreen } from '@/screens/ThreadScreen';
import { SearchScreen } from '@/screens/SearchScreen';
import { OrdersScreen } from '@/screens/OrdersScreen';
import { WalletScreen } from '@/screens/WalletScreen';
import { NotificationsScreen } from '@/screens/NotificationsScreen';
import { AddressesScreen } from '@/screens/AddressesScreen';
import { PaymentMethodsScreen } from '@/screens/PaymentMethodsScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { AccountScreen } from '@/screens/AccountScreen';
import { HelpCenterScreen } from '@/screens/HelpCenterScreen';
import { VerificationScreen } from '@/screens/VerificationScreen';
import { PrivacyScreen } from '@/screens/PrivacyScreen';
import { TermsScreen } from '@/screens/TermsScreen';
import { MyStoreScreen } from '@/screens/MyStoreScreen';
import { WishlistScreen } from '@/screens/WishlistScreen';
import { MoreScreen } from '@/screens/MoreScreen';
import {
  RestaurantsScreen, StaysScreen, PropertiesScreen, AutoScreen, CarRentalsScreen,
  JobsScreen, ServicesScreen, AgroScreen, IndustrialScreen, FinanceScreen,
  NewsScreen, LiveScreen, LogisticsScreen, DriverScreen, RFQScreen,
} from '@/screens/verticals';
import { supabase } from '@/services/supabase';

export type RootStackParamList = {
  Splash: undefined; Auth: undefined; Onboarding: undefined; MainTabs: undefined;
  ProductDetail: { id: string }; Cart: undefined; Rides: undefined;
  Thread: { conversationId: string; title?: string };
  Search: undefined; Orders: undefined; Wallet: undefined; Notifications: undefined;
  Addresses: undefined; PaymentMethods: undefined; Settings: undefined;
  Account: undefined; HelpCenter: undefined; Verification: undefined;
  Privacy: undefined; Terms: undefined; MyStore: undefined; More: undefined; Wishlist: undefined;
  Restaurants: undefined; Stays: undefined; Properties: undefined; Auto: undefined;
  CarRentals: undefined; Jobs: undefined; Services: undefined; Agro: undefined;
  Industrial: undefined; Finance: undefined; News: undefined; Live: undefined;
  Logistics: undefined; Driver: undefined; RFQ: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      await new Promise((r) => setTimeout(r, 600));
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setInitialRoute(data.session ? 'MainTabs' : 'Onboarding');
    })();
    return () => { mounted = false; };
  }, []);

  if (!initialRoute) return <SplashScreen />;

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
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="More" component={MoreScreen} />

      <Stack.Screen name="Orders" component={OrdersScreen} />
      <Stack.Screen name="Wallet" component={WalletScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Addresses" component={AddressesScreen} />
      <Stack.Screen name="PaymentMethods" component={PaymentMethodsScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Account" component={AccountScreen} />
      <Stack.Screen name="HelpCenter" component={HelpCenterScreen} />
      <Stack.Screen name="Verification" component={VerificationScreen} />
      <Stack.Screen name="Privacy" component={PrivacyScreen} />
      <Stack.Screen name="Terms" component={TermsScreen} />
      <Stack.Screen name="MyStore" component={MyStoreScreen} />
      <Stack.Screen name="Wishlist" component={WishlistScreen} />

      <Stack.Screen name="Restaurants" component={RestaurantsScreen} />
      <Stack.Screen name="Stays" component={StaysScreen} />
      <Stack.Screen name="Properties" component={PropertiesScreen} />
      <Stack.Screen name="Auto" component={AutoScreen} />
      <Stack.Screen name="CarRentals" component={CarRentalsScreen} />
      <Stack.Screen name="Jobs" component={JobsScreen} />
      <Stack.Screen name="Services" component={ServicesScreen} />
      <Stack.Screen name="Agro" component={AgroScreen} />
      <Stack.Screen name="Industrial" component={IndustrialScreen} />
      <Stack.Screen name="Finance" component={FinanceScreen} />
      <Stack.Screen name="News" component={NewsScreen} />
      <Stack.Screen name="Live" component={LiveScreen} />
      <Stack.Screen name="Logistics" component={LogisticsScreen} />
      <Stack.Screen name="Driver" component={DriverScreen} />
      <Stack.Screen name="RFQ" component={RFQScreen} />
    </Stack.Navigator>
  );
}
