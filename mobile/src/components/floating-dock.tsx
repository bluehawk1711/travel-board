import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Shadows } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Terra Nova floating dock (DESIGN.md §Navigation): a blurred rounded-full
 * pill with four destinations and a raised Create FAB in the center. Replaces
 * the platform-native tab bar so web, iOS and Android share one chrome.
 */

const DOCK_TABS = [
  { name: 'index', label: 'Boards', icon: 'dashboard' as const },
  { name: 'explore', label: 'Explore', icon: 'explore' as const },
  { name: 'chat/index', label: 'Chat', icon: 'chat' as const },
  { name: 'settings', label: 'Settings', icon: 'settings' as const },
];

type FloatingDockProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    emit: (event: {
      type: 'tabPress';
      target: string;
      canPreventDefault: true;
    }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
};

function TabItem({
  tab,
  focused,
  onPress,
}: {
  tab: (typeof DOCK_TABS)[number];
  focused: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const color = focused ? theme.primary : theme.textSecondary;
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={tab.label}
      accessibilityState={{ selected: focused }}
      onPress={onPress}
      style={({ pressed }) => [styles.tabItem, pressed && styles.tabPressed]}
    >
      <MaterialIcons name={tab.icon} size={24} color={color} />
      <ThemedTabLabel focused={focused} color={color}>
        {tab.label}
      </ThemedTabLabel>
    </Pressable>
  );
}

// Local label to keep the dock self-contained (10px, bold when active).
function ThemedTabLabel({
  focused,
  color,
  children,
}: {
  focused: boolean;
  color: string;
  children: string;
}) {
  return (
    <Text
      numberOfLines={1}
      style={[
        styles.tabLabel,
        { color, fontWeight: focused ? '700' : '600' },
      ]}
    >
      {children}
    </Text>
  );
}

export function FloatingDock({ state, navigation }: FloatingDockProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const activeName = state.routes[state.index]?.name;

  const handlePress = (name: string) => {
    const route = state.routes.find((r) => r.name === name);
    if (!route) return;
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });
    if (!event.defaultPrevented) {
      navigation.navigate(route.name);
    }
  };

  const [left1, left2, right1, right2] = DOCK_TABS;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.dockWrap, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]}
    >
      <View
        style={[
          styles.pill,
          {
            // 92%-opaque surface so the feed blurs underneath (DESIGN.md glass).
            backgroundColor: `${theme.background}EB`,
            borderColor: theme.borderSubtle,
          },
          Shadows.nav,
        ]}
      >
        <TabItem
          tab={left1}
          focused={activeName === left1.name}
          onPress={() => handlePress(left1.name)}
        />
        <TabItem
          tab={left2}
          focused={activeName === left2.name}
          onPress={() => handlePress(left2.name)}
        />

        {/* Elevated central action: Create Trip (DESIGN.md §FAB). */}
        <View style={styles.fabSlot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create board"
            onPress={() => router.push('/board/create')}
            style={({ pressed }) => [
              styles.fab,
              {
                backgroundColor: theme.primary,
                borderColor: theme.background,
              },
              Shadows.fab,
              pressed && styles.fabPressed,
            ]}
          >
            <MaterialIcons name="add" size={30} color={theme.onPrimary} />
          </Pressable>
        </View>

        <TabItem
          tab={right1}
          focused={activeName === right1.name}
          onPress={() => handlePress(right1.name)}
        />
        <TabItem
          tab={right2}
          focused={activeName === right2.name}
          onPress={() => handlePress(right2.name)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dockWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tabItem: {
    width: 56,
    height: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabPressed: {
    transform: [{ scale: 0.9 }],
    opacity: 0.85,
  },
  tabLabel: {
    fontSize: 10,
    letterSpacing: -0.2,
  },
  fabSlot: {
    width: 56,
    alignItems: 'center',
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 999,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
  },
  fabPressed: {
    transform: [{ scale: 0.92 }],
  },
});
