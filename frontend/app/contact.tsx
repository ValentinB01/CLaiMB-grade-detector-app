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
	success: '#4ade80',
};

export default function ContactScreen() {
	const router = useRouter();
	const [drawerVisible, setDrawerVisible] = useState(false);

	const contactItems = [
		{
			icon: 'mail-outline' as const,
			label: 'Email',
			value: 'support@claimb.app',
			color: C.accent,
			action: () => Linking.openURL('mailto:support@claimb.app'),
		},
		{
			icon: 'globe-outline' as const,
			label: 'Website',
			value: 'www.claimb.app',
			color: C.purple,
			action: () => Linking.openURL('https://www.claimb.app'),
		},
		{
			icon: 'logo-instagram' as const,
			label: 'Instagram',
			value: '@claimb',
			color: '#e1306c',
			action: () => Linking.openURL('https://instagram.com/claimb'),
		},
		{
			icon: 'logo-twitter' as const,
			label: 'Twitter / X',
			value: '@claimb',
			color: C.accent,
			action: () => Linking.openURL('https://x.com/claimb'),
		},
		{
			icon: 'logo-discord' as const,
			label: 'Discord Community',
			value: 'Join our server',
			color: '#5865f2',
			action: () => Linking.openURL('https://discord.gg/claimb'),
		},
	];

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
				<Text style={styles.topTitle}>Contact</Text>
				<View style={{ width: 88 }} />
			</View>

			<ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
				{/* Hero */}
				<View style={styles.hero}>
					<View style={styles.iconCircle}>
						<Ionicons name="chatbubbles" size={36} color={C.accent} />
					</View>
					<Text style={styles.heroTitle}>Get in Touch</Text>
					<Text style={styles.heroSub}>We'd love to hear from you! Reach out through any of the channels below.</Text>
				</View>

				{/* Contact Cards */}
				{contactItems.map((item, i) => (
					<TouchableOpacity key={i} style={styles.card} onPress={item.action} activeOpacity={0.7}>
						<View style={[styles.iconWrap, { backgroundColor: item.color + '18' }]}>
							<Ionicons name={item.icon} size={22} color={item.color} />
						</View>
						<View style={styles.cardContent}>
							<Text style={styles.cardLabel}>{item.label}</Text>
							<Text style={[styles.cardValue, { color: item.color }]}>{item.value}</Text>
						</View>
						<Ionicons name="open-outline" size={16} color={C.muted} />
					</TouchableOpacity>
				))}

				{/* Location Card */}
				<View style={styles.locationCard}>
					<View style={styles.locationHeader}>
						<Ionicons name="location" size={20} color={C.accent} />
						<Text style={styles.locationTitle}>Location</Text>
					</View>
					<Text style={styles.locationText}>
						CLaiMB HQ{'\n'}
						Bucharest, Romania 🇷🇴{'\n'}
						Building climbing tech for the world
					</Text>
				</View>

				{/* Support Hours */}
				<View style={styles.hoursCard}>
					<View style={styles.locationHeader}>
						<Ionicons name="time-outline" size={20} color={C.success} />
						<Text style={styles.locationTitle}>Support Hours</Text>
					</View>
					<Text style={styles.locationText}>
						Monday – Friday: 9:00 AM – 6:00 PM (EET){'\n'}
						Weekend: Limited support via email
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
	hero: { alignItems: 'center', marginBottom: 24 },
	iconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: C.accent + '15', alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderWidth: 1.5, borderColor: C.accent + '30' },
	heroTitle: { fontSize: 24, fontWeight: '800', color: C.primary },
	heroSub: { fontSize: 14, color: C.secondary, textAlign: 'center', marginTop: 6, lineHeight: 20 },
	card: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: C.border, gap: 14 },
	iconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
	cardContent: { flex: 1 },
	cardLabel: { fontSize: 12, color: C.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
	cardValue: { fontSize: 15, fontWeight: '700', marginTop: 2 },
	locationCard: { backgroundColor: C.card, borderRadius: 16, padding: 18, marginTop: 10, marginBottom: 10, borderWidth: 1, borderColor: C.accent + '25' },
	hoursCard: { backgroundColor: C.card, borderRadius: 16, padding: 18, marginBottom: 10, borderWidth: 1, borderColor: C.border },
	locationHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
	locationTitle: { fontSize: 15, fontWeight: '700', color: C.primary },
	locationText: { fontSize: 14, color: C.secondary, lineHeight: 22 },
});
