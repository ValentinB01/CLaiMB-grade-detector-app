import AsyncStorage from '@react-native-async-storage/async-storage';

export const tokenCache = {
  async getToken(key: string) {
    try {
      return await AsyncStorage.getItem(key);
    } catch (err) {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      return await AsyncStorage.setItem(key, value);
    } catch (err) {
      return;
    }
  },
};