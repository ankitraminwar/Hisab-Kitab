import { Ionicons } from '@expo/vector-icons';
import {
  copyAsync,
  documentDirectory,
  getInfoAsync,
  makeDirectoryAsync,
} from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CustomPopup } from '../../components/common';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { useTheme, type ThemeColors } from '../../hooks/useTheme';
import { UserProfileService } from '../../services/dataServices';
import { useAppStore } from '../../store/appStore';
import { RADIUS, SPACING, TYPOGRAPHY } from '../../utils/constants';

export default function EditProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { userProfile, setUserProfile } = useAppStore();

  const [name, setName] = useState(userProfile?.name || '');
  const [phone, setPhone] = useState(userProfile?.phone || '');
  const [avatarUri, setAvatarUri] = useState<string | undefined>(userProfile?.avatar);
  const [isSaving, setIsSaving] = useState(false);
  const [popupConfig, setPopupConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({ visible: false, title: '', message: '', type: 'info' });

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setPopupConfig({
        visible: true,
        title: 'Permission Required',
        message: 'Please allow photo access to change your profile picture.',
        type: 'info',
      });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;

    const source = result.assets[0].uri;
    const dir = `${documentDirectory}avatars/`;
    const dirInfo = await getInfoAsync(dir);
    if (!dirInfo.exists) await makeDirectoryAsync(dir, { intermediates: true });
    const dest = `${dir}profile_avatar.jpg`;
    await copyAsync({ from: source, to: dest });
    setAvatarUri(dest);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setPopupConfig({
        visible: true,
        title: 'Error',
        message: 'Name cannot be empty.',
        type: 'error',
      });
      return;
    }

    setIsSaving(true);
    try {
      if (!userProfile) throw new Error('No profile loaded');
      const updatedProfile = await UserProfileService.upsertProfile({
        userId: userProfile.userId,
        name: name.trim(),
        phone: phone.trim() || undefined,
        avatar: avatarUri,
      });
      setUserProfile(updatedProfile);
      router.back();
    } catch {
      setPopupConfig({
        visible: true,
        title: 'Error',
        message: 'Could not save profile details. Try again.',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Edit Profile" />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.avatarSection}>
            <View style={styles.avatar}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="person" size={48} color={colors.primary} />
              )}
            </View>
            <TouchableOpacity style={styles.changePhotoBtn} onPress={() => void handlePickImage()}>
              <Text style={styles.changePhotoText}>Change Photo</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>FULL NAME</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="person-outline" size={20} color={colors.textMuted} />
              <TextInput
                value={name}
                onChangeText={setName}
                style={styles.input}
                placeholder="Rahul"
                placeholderTextColor={colors.textMuted}
                autoFocus
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>EMAIL ADDRESS</Text>
            <View style={[styles.inputWrap, styles.inputWrapDisabled]}>
              <Ionicons name="mail-outline" size={20} color={colors.textMuted} />
              <TextInput
                value={userProfile?.email || ''}
                style={[styles.input, { color: colors.textMuted }]}
                editable={false}
              />
            </View>
            <Text style={styles.helpText}>Email cannot be changed directly.</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>PHONE / MOBILE</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="call-outline" size={20} color={colors.textMuted} />
              <Text style={styles.countryCode}>+91</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                style={styles.input}
                placeholder="9876543210"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                maxLength={10}
              />
            </View>
          </View>

          <View style={styles.spacer} />

          <TouchableOpacity
            style={[styles.saveBtn, isSaving && { opacity: 0.7 }]}
            onPress={() => void handleSave()}
            disabled={isSaving}
          >
            <Text style={styles.saveText}>{isSaving ? 'Saving...' : 'Save Changes'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
      <CustomPopup
        visible={popupConfig.visible}
        title={popupConfig.title}
        message={popupConfig.message}
        type={popupConfig.type}
        onClose={() => setPopupConfig((prev) => ({ ...prev, visible: false }))}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    keyboardView: {
      flex: 1,
    },
    content: {
      flexGrow: 1,
      padding: SPACING.lg,
    },
    avatarSection: {
      alignItems: 'center',
      marginBottom: SPACING.xl,
    },
    avatar: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: colors.primary + '20',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.md,
      borderWidth: 2,
      borderColor: colors.primary + '50',
      overflow: 'hidden' as const,
    },
    avatarImage: {
      width: '100%' as const,
      height: '100%' as const,
      borderRadius: 50,
    },
    changePhotoBtn: {
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.md,
    },
    changePhotoText: {
      color: colors.primary,
      fontWeight: '700',
      fontSize: 14,
    },
    inputGroup: {
      marginBottom: SPACING.lg,
    },
    label: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1,
      color: colors.textMuted,
      marginBottom: SPACING.sm,
    },
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bgCard,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: SPACING.md,
      height: 56,
      gap: SPACING.sm,
    },
    inputWrapDisabled: {
      backgroundColor: colors.bgElevated,
    },
    input: {
      flex: 1,
      ...TYPOGRAPHY.body,
      color: colors.textPrimary,
      fontWeight: '600',
    },
    countryCode: {
      ...TYPOGRAPHY.body,
      color: colors.textSecondary,
      fontWeight: '700',
    },
    helpText: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: SPACING.sm,
      paddingHorizontal: SPACING.sm,
    },
    spacer: {
      flex: 1,
    },
    saveBtn: {
      backgroundColor: colors.primary,
      borderRadius: RADIUS.md,
      height: 56,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.lg,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    saveText: {
      color: colors.heroText,
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
  });
