import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet } from 'react-native';

const C = {
<<<<<<< Updated upstream
  bg: '#09090b',
  tabBar: '#111113',
  tabBorder: '#27272a',
  active: '#22d3ee',
  inactive: '#52525b',
=======
  bg: '#0f172a',
  active: '#22d3ee',
  inactive: '#475569',
  scan: '#3b82f6',
>>>>>>> Stashed changes
};

function TabIcon({
  name,
  color,
  focused,
}: {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  focused: boolean;
}) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Ionicons name={name} size={22} color={color} />
    </View>
  );
}

export default function TabLayout() {
  const variant = process.env.EXPO_PUBLIC_VARIANT || 'coach';
  const isCoach = variant === 'coach';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: C.active,
        tabBarInactiveTintColor: C.inactive,
        tabBarLabelStyle: styles.label,
      }}
    >
      {/* ── SHARED ─────────────────────────────────────────── */}
      <Tabs.Screen
        name="index"
        options={{
          title: isCoach ? 'Home' : 'Feed',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={isCoach ? 'home' : 'newspaper-outline'}
              color={color}
              focused={focused}
            />
          ),
        }}
      />

      {/* ── COACH ONLY ─────────────────────────────────────── */}
      <Tabs.Screen
        name="camera"
        options={{
          href: isCoach ? '/camera' : null,
          title: 'Scan',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="camera" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
<<<<<<< Updated upstream
=======
        name="spraywall"
        options={{
          href: isCoach ? '/spraywall' : null,
          title: 'Spray',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="grid-outline" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
>>>>>>> Stashed changes
        name="history"
        options={{
          href: isCoach ? '/history' : null,
          title: 'History',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="time" color={color} focused={focused} />
          ),
        }}
      />
<<<<<<< Updated upstream
=======

      {/* ── COMMUNITY ONLY ─────────────────────────────────── */}
      <Tabs.Screen
        name="community"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          href: !isCoach ? ('/explore' as any) : null,
          title: 'Explore',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="compass-outline" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          href: !isCoach ? ('/scan' as any) : null,
          title: '',
          tabBarItemStyle: styles.scanItem,
          tabBarIcon: () => (
            <View style={styles.scanInner}>
              <Ionicons name="qr-code-outline" size={26} color="#fff" />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="arena"
        options={{
          href: !isCoach ? ('/arena' as any) : null,
          title: 'Arena',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="trophy-outline" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: !isCoach ? ('/profile' as any) : null,
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="person-outline" color={color} focused={focused} />
          ),
        }}
      />
>>>>>>> Stashed changes
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: C.bg,
    borderTopWidth: 0,
    height: 72,
    paddingBottom: 10,
    overflow: 'visible',
    elevation: 20,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -6 },
  },
  label: { fontSize: 10, fontWeight: '600' },
  iconWrap: {
    width: 40,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
<<<<<<< Updated upstream
  iconWrapActive: {
    backgroundColor: 'rgba(34,211,238,0.12)',
=======
  iconWrapActive: { backgroundColor: 'rgba(34,211,238,0.15)' },
  scanItem: {
    marginTop: -22,
    overflow: 'visible',
>>>>>>> Stashed changes
  },
  scanInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: C.scan,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.scan,
    shadowOpacity: 0.55,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
});