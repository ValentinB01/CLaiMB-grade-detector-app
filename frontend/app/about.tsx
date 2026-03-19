import React, { useState } from 'react';
import {
	View,
	Text,
	ScrollView,
	TouchableOpacity,
	StyleSheet,
	Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import DrawerMenu from '../components/DrawerMenu';

const C = {
	bg: '#0f172a',
	card: '#1e293b',
	border: '#334155',
	primary: '#f8fafc',
	secondary: '#94a3b8',
	muted: '#64748b',
	accent: '#22d3ee',
	purple: '#a78bfa',
};

export default function AboutScreen() {
	const router = useRouter();
	const [drawerVisible, setDrawerVisible] = useState(false);

	return (
		<SafeAreaView style={styles.container}>
			<DrawerMenu visible={drawerVisible} onClose={() => setDrawerVisible(false)} />
			<View style={styles.topBar}>
				<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
					<TouchableOpacity style={styles.backBtn} onPress={() => setDrawerVisible(true)}>
						<Ionicons name="menu" size={20} color={C.primary} />
					</TouchableOpacity>
					<TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
						<Ionicons name="arrow-back" size={22} color={C.primary} />
					</TouchableOpacity>
				</View>
				<Text style={styles.topTitle}>About Us</Text>
				<View style={{ width: 88 }} />
			</View>

			<ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
				{/* Hero */}
				<View style={styles.hero}>
					<Text style={styles.heroTitle}>CLaiMB</Text>
					<Text style={styles.heroSub}>AI-Powered Climbing Coach</Text>
					<View style={styles.versionBadge}>
						<Text style={styles.versionText}>v1.0.0</Text>
					</View>
				</View>

				{/* Mission */}
				<View style={styles.card}>
					<View style={styles.cardHeader}>
						<Ionicons name="rocket-outline" size={20} color={C.accent} />
						<Text style={styles.cardTitle}>Our Mission</Text>
					</View>
					<Text style={styles.cardText}>
						CLaiMB uses cutting-edge AI technology to help climbers of all levels improve their skills.
						We analyze climbing routes using Google Gemini AI to detect holds, estimate difficulty grades,
						and provide personalized coaching tips.
					</Text>
				</View>

				{/* What We Do */}
				<View style={styles.card}>
					<View style={styles.cardHeader}>
						<Ionicons name="bulb-outline" size={20} color={C.purple} />
						<Text style={styles.cardTitle}>What We Do</Text>
					</View>
					<Text style={styles.cardText}>
						Simply take a photo of any climbing wall, and our AI will:
					</Text>
					<View style={styles.featureList}>
						{[
							'Detect and classify all holds on the wall',
							'Identify individual climbing routes by color',
							'Estimate V-scale difficulty grades',
							'Provide coaching tips and beta suggestions',
							'Track your climbing progress over time',
						].map((item, i) => (
							<View key={i} style={styles.featureRow}>
								<View style={[styles.featureDot, { backgroundColor: i % 2 === 0 ? C.accent : C.purple }]} />
								<Text style={styles.featureText}>{item}</Text>
							</View>
						))}
					</View>
				</View>

				{/* Tech */}
				<View style={styles.card}>
					<View style={styles.cardHeader}>
						<Ionicons name="hardware-chip-outline" size={20} color={C.accent} />
						<Text style={styles.cardTitle}>Technology</Text>
					</View>
					<Text style={styles.cardText}>
						Built with React Native and Expo for cross-platform compatibility.
						Powered by Google Gemini 3.1 for advanced image analysis and hold detection.
						Secured with Firebase Authentication.
					</Text>
				</View>

				{/* Team */}
				<View style={[styles.card, { borderColor: C.accent + '30' }]}>
					<View style={styles.cardHeader}>
						<Ionicons name="people-outline" size={20} color={C.accent} />
						<Text style={styles.cardTitle}>The Team</Text>
					</View>
					<Text style={styles.cardText}>
						CLaiMB is developed by passionate climbers and tech enthusiasts who believe
						that AI can make climbing more accessible and enjoyable for everyone.
					</Text>
				</View>
			</ScrollView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: C.bg },
	topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
	backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
	topTitle: { fontSize: 18, fontWeight: '700', color: C.primary },
	scroll: { padding: 20, paddingBottom: 40 },
	hero: { alignItems: 'center', marginBottom: 28 },
	heroTitle: { fontSize: 36, fontWeight: '900', color: C.primary, letterSpacing: 1, textShadowColor: 'rgba(34, 211, 238, 0.5)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 },
	heroSub: { fontSize: 15, color: C.secondary, marginTop: 4 },
	versionBadge: { marginTop: 10, backgroundColor: C.purple + '20', paddingHorizontal: 14, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: C.purple + '40' },
	versionText: { fontSize: 12, color: C.purple, fontWeight: '600' },
	card: { backgroundColor: C.card, borderRadius: 16, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: C.border },
	cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
	cardTitle: { fontSize: 16, fontWeight: '700', color: C.primary },
	cardText: { fontSize: 14, color: C.secondary, lineHeight: 22 },
	featureList: { marginTop: 10, gap: 8 },
	featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
	featureDot: { width: 6, height: 6, borderRadius: 3 },
	featureText: { fontSize: 13, color: C.secondary, flex: 1 },
});
