import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { theme } from '@/config/theme';

export function ScreenHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  const navigation = useNavigation<any>();
  return (
    <View style={styles.row}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
        <Ionicons name="chevron-back" size={22} color={theme.colors.foreground} />
      </TouchableOpacity>
      <Text numberOfLines={1} style={styles.title}>{title}</Text>
      <View style={styles.iconBtn}>{right}</View>
    </View>
  );
}

export function ScreenContainer({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader title={title} right={right} />
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  row: {
    paddingHorizontal: 8, paddingVertical: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border,
  },
  iconBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontFamily: theme.fonts.display, fontWeight: '700', fontSize: 16, color: theme.colors.foreground },
});
