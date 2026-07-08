import AsyncStorage from '@react-native-async-storage/async-storage';

const PROFILE_STORAGE_KEY = '@inspector_profile';

export type InspectorProfile = {
  name: string;
  phone: string;
  company: string;
};

const DEFAULT_PROFILE: InspectorProfile = {
  name: '',
  phone: '',
  company: '',
};

export async function loadProfile(): Promise<InspectorProfile> {
  try {
    const saved = await AsyncStorage.getItem(PROFILE_STORAGE_KEY);
    if (!saved) return DEFAULT_PROFILE;
    return { ...DEFAULT_PROFILE, ...JSON.parse(saved) };
  } catch (error) {
    console.warn('[profileStorage] Failed to load profile', error);
    return DEFAULT_PROFILE;
  }
}

export async function saveProfile(profile: InspectorProfile): Promise<void> {
  try {
    await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch (error) {
    console.warn('[profileStorage] Failed to save profile', error);
    throw error;
  }
}
