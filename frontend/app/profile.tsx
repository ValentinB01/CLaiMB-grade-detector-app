import React, { useState } from 'react';
import {
	View, Text, StyleSheet, TouchableOpacity, ScrollView,
	Image, Modal, FlatList, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { signOut, updateProfile } from 'firebase/auth';
import { auth } from '../firebaseConfig';
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
	error: '#ef4444',
};

// O listă de avatare generate gratuit (stil caractere desenate)
const PRESET_AVATARS = [
	'https://api.dicebear.com/7.x/avataaars/png?seed=Climber1&backgroundColor=22d3ee',
	'https://api.dicebear.com/7.x/avataaars/png?seed=Climber2&backgroundColor=f472b6',
	'https://api.dicebear.com/7.x/avataaars/png?seed=Climber3&backgroundColor=4ade80',
	'https://api.dicebear.com/7.x/avataaars/png?seed=Climber4&backgroundColor=fbbf24',
	'https://api.dicebear.com/7.x/avataaars/png?seed=Climber5&backgroundColor=a855f7',
	'https://api.dicebear.com/7.x/avataaars/png?seed=Climber6&backgroundColor=ef4444',
];

export default function ProfileScreen() {
	const router = useRouter();
	const user = auth.currentUser;

	const [photoUrl, setPhotoUrl] = useState<string | null>(user?.photoURL || null);
	const [modalVisible, setModalVisible] = useState(false);
	const [loading, setLoading] = useState(false);
	const [drawerVisible, setDrawerVisible] = useState(false);

	const handleLogout = async () => {
		try {
			await signOut(auth);
			router.replace('/');
		} catch (error) {
			console.error("Logout error", error);
		}
	};

	const saveProfilePhoto = async (url: string) => {
		if (!user) return;
		setLoading(true);
		try {
			await updateProfile(user, { photoURL: url });
			setPhotoUrl(url);
		} catch (error) {
			alert("Failed to update profile photo.");
		} finally {
			setLoading(false);
			setModalVisible(false);
		}
	};

	const pickImage = async () => {
		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ImagePicker.MediaTypeOptions.Images,
			allowsEditing: true,
			aspect: [1, 1],
			quality: 0.5,
		});

		if (!result.canceled && result.assets[0].uri) {
			saveProfilePhoto(result.assets[0].uri);
		}
	};

	return (
		<SafeAreaView style={styles.container}>
			<DrawerMenu visible={drawerVisible} onClose={() => setDrawerVisible(false)} />
			{/* Header cu buton de închidere */}
			<View style={styles.topBar}>
				<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
					<TouchableOpacity style={styles.closeBtn} onPress={() => setDrawerVisible(true)}>
						<Ionicons name="menu" size={20} color={C.primary} />
					</TouchableOpacity>
					<TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
						<Ionicons name="close" size={24} color={C.primary} />
					</TouchableOpacity>
				</View>
				<Text style={styles.topTitle}>Your Profile</Text>
				<View style={{ width: 88 }} />
			</View>

			<ScrollView contentContainerStyle={styles.scroll}>

				{/* Secțiune Avatar */}
				<View style={styles.header}>
					<TouchableOpacity
						style={styles.avatarContainer}
						onPress={() => setModalVisible(true)}
					>
						{photoUrl ? (
							<Image source={{ uri: photoUrl }} style={styles.avatarImage} />
						) : (
							<Ionicons name="person" size={48} color={C.accent} />
						)}
						<View style={styles.editBadge}>
							<Ionicons name="camera" size={14} color={C.bg} />
						</View>
					</TouchableOpacity>
					<Text style={styles.name}>{user?.displayName || 'Climber'}</Text>
					<Text style={styles.username}>{user?.email}</Text>
				</View>

				{/* Modal pentru alegerea pozei */}
				<Modal animationType="slide" transparent={true} visible={modalVisible}>
					<View style={styles.modalOverlay}>
						<View style={styles.modalContent}>
							<Text style={styles.modalTitle}>Choose your Avatar</Text>

							{/* Buton galerie telefon */}
							<TouchableOpacity style={styles.uploadBtn} onPress={pickImage}>
								<Ionicons name="images" size={20} color={C.bg} />
								<Text style={styles.uploadBtnText}>Upload from Phone</Text>
							</TouchableOpacity>

							<Text style={styles.modalSubtitle}>Or pick a character:</Text>

							{/* Lista de caractere */}
							<FlatList
								data={PRESET_AVATARS}
								numColumns={3}
								keyExtractor={(item) => item}
								columnWrapperStyle={{ justifyContent: 'space-between', marginBottom: 16 }}
								renderItem={({ item }) => (
									<TouchableOpacity onPress={() => saveProfilePhoto(item)}>
										<Image source={{ uri: item }} style={styles.presetAvatar} />
									</TouchableOpacity>
								)}
							/>

							{loading && <ActivityIndicator color={C.accent} style={{ marginTop: 10 }} />}

							<TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
								<Text style={styles.cancelBtnText}>Cancel</Text>
							</TouchableOpacity>
						</View>
					</View>
				</Modal>

				{/* Account Info */}
				<View style={styles.infoGroup}>
					<Text style={styles.groupTitle}>ACCOUNT INFORMATION</Text>
					<View style={styles.infoCard}>
						<View style={styles.infoRow}>
							<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
								<Ionicons name="finger-print-outline" size={16} color={C.secondary} />
								<Text style={styles.infoLabel}>User ID</Text>
							</View>
							<Text style={styles.infoValue}>{user?.uid.substring(0, 10)}... (Guest)</Text>
						</View>
						<View style={styles.divider} />
						<View style={styles.infoRow}>
							<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
								<Ionicons name={user?.emailVerified ? "shield-checkmark" : "shield-outline"} size={16} color={user?.emailVerified ? C.accent : C.muted} />
								<Text style={styles.infoLabel}>Status</Text>
							</View>
							<View style={[styles.badge, { backgroundColor: user?.emailVerified ? 'rgba(34,211,238,0.1)' : 'rgba(100,116,139,0.1)' }]}>
								<Text style={[styles.badgeText, { color: user?.emailVerified ? C.accent : C.secondary }]}>
									{user?.emailVerified ? 'VERIFIED' : 'ACTIVE'}
								</Text>
							</View>
						</View>
						<View style={styles.divider} />
						<View style={styles.infoRow}>
							<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
								<Ionicons name="calendar-outline" size={16} color={C.secondary} />
								<Text style={styles.infoLabel}>Registered</Text>
							</View>
							<Text style={styles.infoValue}>{new Date(user?.metadata.creationTime || Date.now()).toLocaleDateString()}</Text>
						</View>
					</View>
				</View>

				{/* Meniu Setari */}
				<View style={styles.menuGroup}>
					<Text style={styles.menuTitle}>ACCOUNT SETTINGS</Text>
					<TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
						<View style={styles.menuItemLeft}>
							<Ionicons name="log-out-outline" size={20} color={C.error} />
							<Text style={[styles.menuText, { color: C.error }]}>Sign Out</Text>
						</View>
					</TouchableOpacity>
				</View>

			</ScrollView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: C.bg },
	topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10 },
	closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
	topTitle: { fontSize: 18, fontWeight: '700', color: C.primary },
	scroll: { padding: 24, paddingBottom: 40 },
	header: { alignItems: 'center', marginBottom: 32 },
	avatarContainer: {
		width: 100, height: 100, borderRadius: 50,
		backgroundColor: C.card, borderWidth: 2, borderColor: C.accent,
		alignItems: 'center', justifyContent: 'center', marginBottom: 16,
		shadowColor: C.accent, shadowOffset: { width: 0, height: 0 },
		shadowOpacity: 0.5, shadowRadius: 10, elevation: 5,
	},
	avatarImage: { width: '100%', height: '100%', borderRadius: 50 },
	editBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: C.accent, padding: 6, borderRadius: 15, borderWidth: 2, borderColor: C.bg },
	name: { fontSize: 24, fontWeight: '800', color: C.primary, marginBottom: 4 },
	username: { fontSize: 15, color: C.secondary },

	/* Stiluri pentru Modal */
	modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.92)', justifyContent: 'center', padding: 20 },
	modalContent: { backgroundColor: C.card, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: C.border },
	modalTitle: { fontSize: 20, fontWeight: '800', color: C.primary, marginBottom: 20, textAlign: 'center' },
	modalSubtitle: { fontSize: 14, color: C.secondary, marginBottom: 16, textAlign: 'center' },
	uploadBtn: { flexDirection: 'row', backgroundColor: C.accent, padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 24 },
	uploadBtnText: { color: C.bg, fontWeight: '800', fontSize: 16 },
	presetAvatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: C.border },
	cancelBtn: { marginTop: 20, padding: 14, alignItems: 'center' },
	cancelBtnText: { color: C.error, fontSize: 16, fontWeight: '700' },

	infoGroup: { marginBottom: 32 },
	groupTitle: { fontSize: 11, color: C.muted, fontWeight: '800', letterSpacing: 1.5, marginBottom: 12, marginLeft: 4, textTransform: 'uppercase' },
	infoCard: { backgroundColor: C.card, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: C.border },
	infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
	infoLabel: { fontSize: 13, color: C.secondary, fontWeight: '600' },
	infoValue: { fontSize: 14, color: C.primary, fontWeight: '700' },
	divider: { height: 1, backgroundColor: C.border, marginVertical: 12 },
	badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: 'transparent' },
	badgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },

	menuGroup: { backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border },
	menuTitle: { fontSize: 12, color: C.muted, fontWeight: '700', letterSpacing: 1, marginBottom: 16, marginLeft: 8 },
	menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 8 },
	menuItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
	menuText: { fontSize: 16, color: C.primary, fontWeight: '500' },
});