import React, { useState } from 'react';
import {
	View,
	Text,
	ScrollView,
	TouchableOpacity,
	StyleSheet,
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
	warning: '#fbbf24',
};

interface FAQItem {
	question: string;
	answer: string;
}

const FAQ_LIST: FAQItem[] = [
	{
		question: 'How do I scan a climbing route?',
		answer: 'Go to the "Scan" tab, point your camera at the climbing wall, and take a photo. Make sure the entire wall is visible in the frame. The AI will automatically detect holds and analyze the route.',
	},
	{
		question: 'How accurate are the grade estimations?',
		answer: 'Our AI uses Google Gemini 3.1 to analyze routes. Accuracy depends on photo quality, lighting, and wall visibility. For the best results, take clear, well-lit photos with the entire route visible.',
	},
	{
		question: 'What is the V-scale?',
		answer: 'The V-scale (Vermin scale) is a grading system for bouldering problems. V0 is beginner-friendly, while V17+ represents the most challenging routes in the world. Most gym climbers range from V0 to V8.',
	},
	{
		question: 'Can I choose the wall angle?',
		answer: 'Yes! On the Scan screen, you can select the wall type (Inclined, Vertical, or Overhang) and set the specific angle in degrees. This helps the AI make more accurate grade estimations.',
	},
	{
		question: 'How do I view my climbing history?',
		answer: 'Go to the "History" tab to see all your previously analyzed routes. Tap on any route to view the full analysis, including detected holds, grade estimation, and coaching tips.',
	},
	{
		question: 'Can I use the app offline?',
		answer: 'You need an internet connection to analyze routes (the AI runs in the cloud). However, your climbing history is available to view once loaded.',
	},
	{
		question: 'How do I change my profile photo?',
		answer: 'Tap on your avatar in the top-right corner of the Home screen to open your profile. Then tap on the avatar photo to choose from preset characters or upload your own.',
	},
	{
		question: 'What do the hold colors mean?',
		answer: 'The AI classifies holds by type: green = start holds, pink = finish holds, cyan = hand holds, yellow = foot holds. This helps you understand the recommended route sequence.',
	},
];

const TIPS = [
	{ icon: 'camera' as const, tip: 'Take photos straight-on for the most accurate analysis', color: C.accent },
	{ icon: 'sunny' as const, tip: 'Good lighting improves hold detection accuracy', color: C.warning },
	{ icon: 'resize' as const, tip: 'Include the full wall in your photo — don\'t crop too tight', color: C.purple },
	{ icon: 'finger-print' as const, tip: 'Tap on individual holds in the result view for details', color: C.success },
	{ icon: 'layers' as const, tip: 'Use the route selector to switch between detected routes', color: C.accent },
];

function FAQCard({ item }: { item: FAQItem }) {
	const [expanded, setExpanded] = useState(false);

	return (
		<TouchableOpacity
			style={[styles.faqCard, expanded && styles.faqCardExpanded]}
			onPress={() => setExpanded(!expanded)}
			activeOpacity={0.7}
		>
			<View style={styles.faqHeader}>
				<Text style={styles.faqQuestion}>{item.question}</Text>
				<Ionicons
					name={expanded ? 'chevron-up' : 'chevron-down'}
					size={18}
					color={C.accent}
				/>
			</View>
			{expanded && (
				<Text style={styles.faqAnswer}>{item.answer}</Text>
			)}
		</TouchableOpacity>
	);
}

export default function HelpScreen() {
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
				<Text style={styles.topTitle}>Help</Text>
				<View style={{ width: 88 }} />
			</View>

			<ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
				{/* Hero */}
				<View style={styles.hero}>
					<View style={styles.iconCircle}>
						<Ionicons name="help-buoy" size={36} color={C.accent} />
					</View>
					<Text style={styles.heroTitle}>How can we help?</Text>
				</View>

				{/* Tips Section */}
				<Text style={styles.sectionTitle}>📸 Pro Tips</Text>
				<View style={styles.tipsContainer}>
					{TIPS.map((item, i) => (
						<View key={i} style={styles.tipRow}>
							<View style={[styles.tipIcon, { backgroundColor: item.color + '18' }]}>
								<Ionicons name={item.icon} size={16} color={item.color} />
							</View>
							<Text style={styles.tipText}>{item.tip}</Text>
						</View>
					))}
				</View>

				{/* FAQ Section */}
				<Text style={styles.sectionTitle}>❓ Frequently Asked Questions</Text>
				{FAQ_LIST.map((item, i) => (
					<FAQCard key={i} item={item} />
				))}

				{/* Still need help? */}
				<View style={styles.helpFooter}>
					<Ionicons name="chatbubble-ellipses-outline" size={24} color={C.purple} />
					<Text style={styles.helpFooterTitle}>Still need help?</Text>
					<Text style={styles.helpFooterText}>
						Contact us at support@claimb.app and we'll get back to you within 24 hours.
					</Text>
					<TouchableOpacity style={styles.contactBtn} onPress={() => router.push('/contact' as any)}>
						<Ionicons name="mail" size={16} color={C.bg} />
						<Text style={styles.contactBtnText}>Contact Support</Text>
					</TouchableOpacity>
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
	sectionTitle: { fontSize: 16, fontWeight: '700', color: C.primary, marginBottom: 12, marginTop: 8 },
	tipsContainer: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: C.border, gap: 12 },
	tipRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
	tipIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
	tipText: { fontSize: 13, color: C.secondary, flex: 1, lineHeight: 18 },
	faqCard: { backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: C.border },
	faqCardExpanded: { borderColor: C.accent + '40' },
	faqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
	faqQuestion: { fontSize: 14, fontWeight: '600', color: C.primary, flex: 1 },
	faqAnswer: { fontSize: 13, color: C.secondary, marginTop: 12, lineHeight: 20 },
	helpFooter: { alignItems: 'center', backgroundColor: C.card, borderRadius: 16, padding: 24, marginTop: 16, borderWidth: 1, borderColor: C.purple + '30', gap: 8 },
	helpFooterTitle: { fontSize: 16, fontWeight: '700', color: C.primary },
	helpFooterText: { fontSize: 13, color: C.secondary, textAlign: 'center', lineHeight: 20 },
	contactBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.accent, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, marginTop: 8 },
	contactBtnText: { fontSize: 14, fontWeight: '700', color: C.bg },
});
