import React from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { HomeScreen } from '@/screens/HomeScreen';
import { CategoriesScreen } from '@/screens/CategoriesScreen';
import { MessagesScreen } from '@/screens/MessagesScreen';
import { WishlistScreen } from '@/screens/WishlistScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { theme } from '@/config/theme';

const Tab = createBottomTabNavigator();

export function RootTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.foreground,
        tabBarInactiveTintColor: theme.colors.muted,
        tabBarStyle: {
          backgroundColor: theme.colors.background,
          borderTopColor: theme.colors.border,
          height: Platform.OS === 'ios' ? 84 : 60,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontFamily: theme.fonts.body, fontSize: 11 },
        tabBarIcon: ({ color, focused }) => {
          const map: Record<string, [string, string]> = {
            Home: ['home', 'home-outline'],
            Categories: ['bag-handle', 'bag-handle-outline'],
            Messages: ['chatbubble', 'chatbubble-outline'],
            Wishlist: ['heart', 'heart-outline'],
            Profile: ['person', 'person-outline'],
          };
          const [filled, outline] = map[route.name] ?? ['ellipse', 'ellipse-outline'];
          return <Ionicons name={focused ? filled : outline} size={26} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Categories" component={CategoriesScreen} />
      <Tab.Screen name="Messages" component={MessagesScreen} />
      <Tab.Screen name="Wishlist" component={WishlistScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
