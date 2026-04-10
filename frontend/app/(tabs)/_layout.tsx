import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/* ── Palette ───────────────────────────────────────────────── */
const COACH = {
  bg: '#0d0d12',
  active: '#a855f7',
  inactive: '#4b5563',
  glow: '#39ff14',
  glowAlt: '#a855f7',
};

const COMMUNITY = {
  bg: '#0f172a',
  active: '#22d3ee',
  inactive: '#475569',
  scan: '#3b82f6',
};

/* ── Helpers ───────────────────────────────────────────────── */
function TabIcon({
  name,
  color,
  focused,
  activeBg,
}: {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  focused: boolean;
  activeBg?: string;
}) {
  return (
    <View
      style={[
        styles.iconWrap,
        focused && [styles.iconWrapActive, activeBg ? { backgroundColor: activeBg } : undefined],
      ]}
    >
      <Ionicons name={name} size={22} color={color} />
    </View>
  );
}

function AnalyzeButton() {
  return (
    <View style={styles.analyzeOuter}>
      <LinearGradient
        colors={[COACH.glow, COACH.glowAlt]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.analyzeGradient}
      >
        <Ionicons name="scan-outline" size={28} color="#fff" />
      </LinearGradient>
    </View>
  );
}

/* ── Layout ────────────────────────────────────────────────── */
export default function TabLayout() {
  const variant = process.env.EXPO_PUBLIC_VARIANT || 'coach';
  const isCoach = variant === 'coach';

  const palette = isCoach ? COACH : COMMUNITY;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: [styles.tabBar, { backgroundColor: palette.bg }],
        tabBarActiveTintColor: palette.active,
        tabBarInactiveTintColor: palette.inactive,
        tabBarLabelStyle: styles.label,
      }}
    >
      {/* ── 1. Home / Feed ──────────────────────────────────── */}
      <Tabs.Screen
        name="index"
        options={{
          title: isCoach ? 'Home' : 'Feed',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={isCoach ? 'home-outline' : 'newspaper-outline'}
              color={color}
              focused={focused}
              activeBg={isCoach ? 'rgba(168,85,247,0.15)' : undefined}
            />
          ),
        }}
      />

      {/* ── 2. Tips (coach) ─────────────────────────────────── */}
      <Tabs.Screen
        name="beta"
        options={{
          href: isCoach ? ('/beta' as any) : null,
          title: 'Tips',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name="bulb-outline"
              color={color}
              focused={focused}
              activeBg="rgba(168,85,247,0.15)"
            />
          ),
        }}
      />

      {/* ── 3. Analyze — centre floating button (coach) ────── */}
      <Tabs.Screen
        name="camera"
        options={{
          href: isCoach ? '/camera' : null,
          title: '',
          tabBarItemStyle: isCoach ? styles.analyzeItem : undefined,
          tabBarIcon: isCoach
            ? () => <AnalyzeButton />
            : ({ color, focused }) => (
                <TabIcon name="camera" color={color} focused={focused} />
              ),
        }}
      />

      {/* ── 4. Spray Wall (coach) ──────────────────────────── */}
      <Tabs.Screen
        name="spraywall"
        options={{
          href: isCoach ? ('/spraywall' as any) : null,
          title: 'Spray Wall',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name="apps-outline"
              color={color}
              focused={focused}
              activeBg="rgba(168,85,247,0.15)"
            />
          ),
        }}
      />

      {/* ── 5. Vault (coach) ───────────────────────────────── */}
      <Tabs.Screen
        name="history"
        options={{
          href: isCoach ? '/history' : null,
          title: 'Vault',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name="library-outline"
              color={color}
              focused={focused}
              activeBg="rgba(168,85,247,0.15)"
            />
          ),
        }}
      />

      {/* ── COMMUNITY ONLY (hidden in coach) ───────────────── */}
      <Tabs.Screen name="community" options={{ href: null }} />
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
          tabBarItemStyle: !isCoach ? styles.commScanItem : undefined,
          tabBarIcon: !isCoach
            ? () => (
                <View style={styles.commScanInner}>
                  <Ionicons name="qr-code-outline" size={26} color="#fff" />
                </View>
              )
            : undefined,
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
    </Tabs>
  );
}

/* ── Styles ────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  tabBar: {
    borderTopWidth: 0,
    height: 76,
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
    overflow: 'visible',
    elevation: 24,
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -6 },
  },
  label: { fontSize: 10, fontWeight: '600', letterSpacing: 0.3 },
  iconWrap: {
    width: 40,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  iconWrapActive: {
    backgroundColor: 'rgba(34,211,238,0.15)',
  },

  /* ── Coach: floating Analyze button ── */
  analyzeItem: {
    marginTop: -26,
    overflow: 'visible',
  },
  analyzeOuter: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#39ff14',
        shadowOpacity: 0.5,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 14 },
    }),
  },
  analyzeGradient: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ── Community: scan button ── */
  commScanItem: {
    marginTop: -22,
    overflow: 'visible',
  },
  commScanInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: COMMUNITY.scan,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COMMUNITY.scan,
    shadowOpacity: 0.55,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
});