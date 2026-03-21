import React from 'react';
import {
	View,
	Text,
	TouchableOpacity,
	StyleSheet,
	Modal,
	Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

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
	error: '#ef4444',
};

interface MenuItem {
	icon: keyof typeof Ionicons.glyphMap;
	label: string;
	route: string;
	color: string;
}

const MENU_ITEMS: MenuItem[] = [
	{ icon: 'home', label: 'Home', route: '/(tabs)', color: C.accent },
	{ icon: 'camera', label: 'Scan', route: '/(tabs)/camera', color: C.accent },
	{ icon: 'time', label: 'History', route: '/(tabs)/history', color: C.purple },
	{ icon: 'person', label: 'Profile', route: '/profile', color: C.success },
	{ icon: 'information-circle', label: 'About Us', route: '/about', color: C.accent },
	{ icon: 'mail', label: 'Contact', route: '/contact', color: C.warning },
	{ icon: 'help-circle', label: 'Help', route: '/help', color: C.purple },
];

interface DrawerMenuProps {
	visible: boolean;
	onClose: () => void;
}

export default function DrawerMenu({ visible, onClose }: DrawerMenuProps) {
	const router = useRouter();

	const handleNavigate = (route: string) => {
		onClose();
		setTimeout(() => {
			router.push(route as any);
		}, 200);
	};

	return (
		<Modal
			animationType="fade"
			transparent={true}
			visible={visible}
			onRequestClose={onClose}
		>
			{/* Backdrop */}
			<Pressable style={styles.overlay} onPress={onClose}>
				{/* Drawer panel */}
				<Pressable style={styles.drawer} onPress={(e) => e.stopPropagation()}>
					{/* Header */}
					<View style={styles.drawerHeader}>
						<Text style={styles.drawerTitle}>CLaiMB</Text>
						<TouchableOpacity onPress={onClose} style={styles.closeBtn}>
							<Ionicons name="close" size={22} color={C.primary} />
						</TouchableOpacity>
					</View>

					<View style={styles.divider} />

					{/* Menu Items */}
					<View style={styles.menuList}>
						{MENU_ITEMS.map((item, i) => (
							<TouchableOpacity
								key={i}
								style={styles.menuItem}
								onPress={() => handleNavigate(item.route)}
								activeOpacity={0.6}
							>
								<View style={[styles.menuIconWrap, { backgroundColor: item.color + '18' }]}>
									<Ionicons name={item.icon} size={20} color={item.color} />
								</View>
								<Text style={styles.menuLabel}>{item.label}</Text>
								<Ionicons name="chevron-forward" size={16} color={C.muted} />
							</TouchableOpacity>
						))}
					</View>

					{/* Footer */}
					<View style={styles.drawerFooter}>
						<Text style={styles.footerText}>CLaiMB v1.0.0</Text>
						<Text style={styles.footerSub}>AI-Powered Climbing Coach</Text>
					</View>
				</Pressable>
			</Pressable>
		</Modal>
	);
}

const styles = StyleSheet.create({
	overlay: {
		flex: 1,
		backgroundColor: 'rgba(0, 0, 0, 0.6)',
		flexDirection: 'row',
	},
	drawer: {
		width: 280,
		backgroundColor: C.bg,
		height: '100%',
		borderRightWidth: 1,
		borderRightColor: C.border,
		paddingTop: 56,
		justifyContent: 'flex-start',
	},
	drawerHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 20,
		paddingBottom: 16,
	},
	drawerTitle: {
		fontSize: 24,
		fontWeight: '900',
		color: C.primary,
		letterSpacing: 0.5,
		textShadowColor: 'rgba(34, 211, 238, 0.4)',
		textShadowOffset: { width: 0, height: 0 },
		textShadowRadius: 8,
	},
	closeBtn: {
		width: 36,
		height: 36,
		borderRadius: 18,
		backgroundColor: C.card,
		alignItems: 'center',
		justifyContent: 'center',
	},
	divider: {
		height: 1,
		backgroundColor: C.border,
		marginHorizontal: 20,
		marginBottom: 8,
	},
	menuList: {
		paddingHorizontal: 12,
		gap: 2,
		flex: 1,
	},
	menuItem: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 12,
		paddingHorizontal: 8,
		borderRadius: 12,
		gap: 12,
	},
	menuIconWrap: {
		width: 38,
		height: 38,
		borderRadius: 10,
		alignItems: 'center',
		justifyContent: 'center',
	},
	menuLabel: {
		fontSize: 15,
		fontWeight: '600',
		color: C.primary,
		flex: 1,
	},
	drawerFooter: {
		paddingHorizontal: 20,
		paddingVertical: 20,
		borderTopWidth: 1,
		borderTopColor: C.border,
		alignItems: 'center',
	},
	footerText: {
		fontSize: 13,
		fontWeight: '700',
		color: C.muted,
	},
	footerSub: {
		fontSize: 11,
		color: C.muted,
		marginTop: 2,
	},
});
