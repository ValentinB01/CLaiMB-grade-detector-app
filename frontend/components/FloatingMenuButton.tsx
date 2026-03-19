import React, { useState } from 'react';
import {
	TouchableOpacity,
	StyleSheet,
	Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import DrawerMenu from './DrawerMenu';

export default function FloatingMenuButton() {
	const [drawerVisible, setDrawerVisible] = useState(false);

	return (
		<>
			<TouchableOpacity
				style={styles.floatingBtn}
				onPress={() => setDrawerVisible(true)}
				activeOpacity={0.7}
			>
				{Platform.OS === 'web' ? (
					<Ionicons name="menu" size={22} color="#f8fafc" />
				) : (
					<BlurView intensity={60} tint="dark" style={styles.blur}>
						<Ionicons name="menu" size={22} color="#f8fafc" />
					</BlurView>
				)}
			</TouchableOpacity>

			<DrawerMenu visible={drawerVisible} onClose={() => setDrawerVisible(false)} />
		</>
	);
}

const styles = StyleSheet.create({
	floatingBtn: {
		position: 'absolute',
		top: Platform.OS === 'web' ? 18 : 54,
		left: 16,
		zIndex: 9999,
		width: 42,
		height: 42,
		borderRadius: 12,
		overflow: 'hidden',
		backgroundColor: 'rgba(30, 41, 59, 0.75)',
		borderWidth: 1,
		borderColor: 'rgba(51, 65, 85, 0.6)',
		alignItems: 'center',
		justifyContent: 'center',
		...Platform.select({
			web: {
				backdropFilter: 'blur(12px)',
				WebkitBackdropFilter: 'blur(12px)',
			},
		}),
	},
	blur: {
		width: '100%',
		height: '100%',
		alignItems: 'center',
		justifyContent: 'center',
	},
});
