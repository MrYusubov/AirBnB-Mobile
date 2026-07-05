import Colors from '@/constants/Colors';
import { defaultStyles } from '@/constants/Styles';
import { uploadImageToCloudinary } from '@/lib/cloudinary';
import { useIsAdmin } from '@/lib/admin';
import { upsertUser } from '@/lib/database/listings';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type ProfileMetadata = {
  profileImageUrl?: unknown;
  profileImagePublicId?: unknown;
};

const getErrorMessage = (error: unknown) => {
  const clerkError = error as { errors?: { message?: string }[]; message?: string };
  return clerkError.errors?.[0]?.message ?? clerkError.message ?? 'Please try again.';
};

const getCustomProfileImageUrl = (metadata: unknown) => {
  const profileMetadata = metadata as ProfileMetadata;
  return typeof profileMetadata?.profileImageUrl === 'string' ? profileMetadata.profileImageUrl : null;
};

const getProviderNames = (user: ReturnType<typeof useUser>['user']) => {
  const providers = user?.externalAccounts
    ?.map((account) => account.providerTitle?.() ?? account.provider)
    .filter(Boolean);

  if (!providers?.length) {
    return 'social platform';
  }

  return providers.join(', ');
};

const ProfilePage = () => {
  const { signOut, isSignedIn } = useAuth();
  const { user } = useUser();
  const { isAdmin } = useIsAdmin();
  const router = useRouter();

  const customAvatar = getCustomProfileImageUrl(user?.unsafeMetadata);
  const currentAvatarUrl = customAvatar ?? user?.imageUrl ?? '';
  const currentEmail = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress ?? '';
  const providerNames = useMemo(() => getProviderNames(user), [user]);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const passwordRules = useMemo(
    () => [
      { label: 'Minimum 6 characters', isValid: newPassword.length >= 6 },
      { label: 'At least 1 uppercase letter', isValid: /[A-Z]/.test(newPassword) },
      { label: 'At least 1 number', isValid: /\d/.test(newPassword) },
      { label: 'At least 1 symbol', isValid: /[^A-Za-z0-9]/.test(newPassword) },
    ],
    [newPassword]
  );
  const isPasswordValid = passwordRules.every((rule) => rule.isValid);

  useEffect(() => {
    if (!user) {
      return;
    }

    const nextAvatarUrl = getCustomProfileImageUrl(user.unsafeMetadata) ?? user.imageUrl;

    setFirstName(user.firstName ?? '');
    setLastName(user.lastName ?? '');
    setUsername(user.username ?? '');
    setAvatarUrl(nextAvatarUrl);

    upsertUser({
      id: user.id,
      email: user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null,
      first_name: user.firstName,
      last_name: user.lastName,
      image_url: nextAvatarUrl,
    }).catch((error) => {
      console.log('Failed to sync user to SQLite', error);
    });
  }, [user]);

  const syncUserToDatabase = async (imageUrl = avatarUrl) => {
    if (!user) {
      return;
    }

    await upsertUser({
      id: user.id,
      email: user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null,
      first_name: firstName.trim() || null,
      last_name: lastName.trim() || null,
      image_url: imageUrl || user.imageUrl,
    });
  };

  const onUploadAvatar = async () => {
    if (!user) {
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.82,
    });

    if (result.canceled) {
      return;
    }

    try {
      setIsUploadingAvatar(true);
      const uploadedImage = await uploadImageToCloudinary(result.assets[0].uri, 'airbnb-mobile/profiles');
      const nextUnsafeMetadata = {
        ...(user.unsafeMetadata as Record<string, unknown>),
        profileImageUrl: uploadedImage.secure_url,
        profileImagePublicId: uploadedImage.public_id,
      };

      await user.update({
        unsafeMetadata: nextUnsafeMetadata,
      });

      setAvatarUrl(uploadedImage.secure_url);
      await syncUserToDatabase(uploadedImage.secure_url);
      Alert.alert('Profile photo updated', 'Your new photo was uploaded successfully.');
    } catch (error) {
      Alert.alert('Could not update photo', getErrorMessage(error));
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const onSaveProfile = async () => {
    if (!user) {
      return;
    }

    const trimmedUsername = username.trim();

    try {
      setIsSavingProfile(true);
      await user.update({
        firstName: firstName.trim() || null,
        lastName: lastName.trim() || null,
        username: trimmedUsername || null,
        unsafeMetadata: {
          ...(user.unsafeMetadata as Record<string, unknown>),
          profileImageUrl: avatarUrl || getCustomProfileImageUrl(user.unsafeMetadata) || undefined,
        },
      });
      await syncUserToDatabase();
      Alert.alert('Profile saved', 'Your profile details were updated.');
    } catch (error) {
      Alert.alert('Could not save profile', getErrorMessage(error));
    } finally {
      setIsSavingProfile(false);
    }
  };

  const onChangePassword = async () => {
    if (!user) {
      return;
    }

    if (!user.passwordEnabled) {
      Alert.alert(
        'Password unavailable',
        `You signed in with ${providerNames}. Password change is not available for this account.`
      );
      return;
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Missing info', 'Please fill current password, new password, and confirm password.');
      return;
    }

    if (!isPasswordValid) {
      Alert.alert('Weak password', 'Please complete all password requirements.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Please confirm the same new password.');
      return;
    }

    try {
      setIsChangingPassword(true);
      await user.updatePassword({
        currentPassword,
        newPassword,
        signOutOfOtherSessions: true,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Password changed', 'Your password was updated successfully.');
    } catch (error) {
      Alert.alert('Could not change password', getErrorMessage(error));
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (!isSignedIn || !user) {
    return (
      <View style={styles.centered}>
        <Ionicons name="person-circle-outline" size={54} color={Colors.grey} />
        <Text style={styles.emptyTitle}>Welcome to Airbnb</Text>
        <Text style={styles.emptyText}>Log in to manage your profile, houses, and reservations.</Text>
        <TouchableOpacity style={[defaultStyles.btn, styles.fullButton]} onPress={() => router.push('/(modals)/login')}>
          <Text style={defaultStyles.btnText}>Log In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Profile</Text>
        <Text style={styles.pageSubtitle}>Manage your account, hosting tools, and security.</Text>
      </View>

      <View style={styles.heroCard}>
        <TouchableOpacity activeOpacity={0.86} onPress={onUploadAvatar} style={styles.avatarWrap}>
          {avatarUrl || currentAvatarUrl ? (
            <Image source={{ uri: avatarUrl || currentAvatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Ionicons name="person" size={42} color="#fff" />
            </View>
          )}
          <View style={styles.cameraBadge}>
            {isUploadingAvatar ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="camera" size={18} color="#fff" />
            )}
          </View>
        </TouchableOpacity>

        <View style={styles.heroText}>
          <Text style={styles.nameText}>{user.fullName ?? (username || 'Your profile')}</Text>
          <Text style={styles.emailText}>{currentEmail}</Text>
          <Text style={styles.memberText}>
            Since {user.createdAt ? user.createdAt.toLocaleDateString('en-US') : 'today'}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardTitle}>Account details</Text>
            <Text style={styles.cardSubtitle}>Username and profile info shown inside the app.</Text>
          </View>
          <Ionicons name="person-outline" size={22} color={Colors.primary} />
        </View>

        <View style={styles.form}>
          <Field label="Username">
            <TextInput
              autoCapitalize="none"
              onChangeText={setUsername}
              placeholder="Choose username"
              placeholderTextColor="#888"
              style={styles.input}
              value={username}
            />
          </Field>
          <View style={styles.row}>
            <Field label="First name" style={styles.halfField}>
              <TextInput
                onChangeText={setFirstName}
                placeholder="First name"
                placeholderTextColor="#888"
                style={styles.input}
                value={firstName}
              />
            </Field>
            <Field label="Last name" style={styles.halfField}>
              <TextInput
                onChangeText={setLastName}
                placeholder="Last name"
                placeholderTextColor="#888"
                style={styles.input}
                value={lastName}
              />
            </Field>
          </View>
        </View>

        <TouchableOpacity
          disabled={isSavingProfile}
          style={[defaultStyles.btn, isSavingProfile && styles.disabledButton]}
          onPress={onSaveProfile}>
          <Text style={defaultStyles.btnText}>{isSavingProfile ? 'Saving...' : 'Save Profile'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actionsGrid}>
        <ActionButton
          icon="home-outline"
          label="Add House"
          onPress={() => router.push('/(modals)/add-house')}
        />
        <ActionButton
          icon="briefcase-outline"
          label="Manage Houses"
          color="#2f4858"
          onPress={() => router.push('/host/manage-houses')}
        />
        {isAdmin ? (
          <ActionButton
            icon="shield-checkmark-outline"
            label="Pending Houses"
            color={Colors.dark}
            onPress={() => router.push('/admin/pending-houses')}
          />
        ) : null}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardTitle}>Password</Text>
            <Text style={styles.cardSubtitle}>Change your password after confirming the old one.</Text>
          </View>
          <Ionicons name="lock-closed-outline" size={22} color={Colors.primary} />
        </View>

        {!user.passwordEnabled ? (
          <View style={styles.noticeCard}>
            <Ionicons name="information-circle-outline" size={23} color={Colors.primary} />
            <Text style={styles.noticeText}>
              You signed in with {providerNames}. Password change is not available for this account.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.form}>
              <Field label="Current password">
                <TextInput
                  autoCapitalize="none"
                  onChangeText={setCurrentPassword}
                  placeholder="Current password"
                  placeholderTextColor="#888"
                  secureTextEntry
                  style={styles.input}
                  value={currentPassword}
                />
              </Field>
              <Field label="New password">
                <TextInput
                  autoCapitalize="none"
                  onChangeText={setNewPassword}
                  placeholder="New password"
                  placeholderTextColor="#888"
                  secureTextEntry
                  style={styles.input}
                  value={newPassword}
                />
              </Field>

              <View style={styles.rulesCard}>
                {passwordRules.map((rule) => (
                  <View key={rule.label} style={styles.ruleRow}>
                    <Ionicons
                      color={rule.isValid ? '#1E9E5A' : '#999'}
                      name={rule.isValid ? 'checkmark-circle' : 'ellipse-outline'}
                      size={17}
                    />
                    <Text style={[styles.ruleText, rule.isValid && styles.ruleTextValid]}>
                      {rule.label}
                    </Text>
                  </View>
                ))}
              </View>

              <Field label="Confirm password">
                <TextInput
                  autoCapitalize="none"
                  onChangeText={setConfirmPassword}
                  placeholder="Repeat new password"
                  placeholderTextColor="#888"
                  secureTextEntry
                  style={styles.input}
                  value={confirmPassword}
                />
              </Field>
            </View>

            <TouchableOpacity
              disabled={isChangingPassword}
              style={[styles.passwordButton, isChangingPassword && styles.disabledButton]}
              onPress={onChangePassword}>
              <Text style={styles.passwordButtonText}>
                {isChangingPassword ? 'Changing...' : 'Change Password'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={() => signOut()}>
        <Ionicons name="log-out-outline" size={20} color="#b42318" />
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const Field = ({
  label,
  children,
  style,
}: {
  label: string;
  children: React.ReactNode;
  style?: object;
}) => (
  <View style={[styles.field, style]}>
    <Text style={styles.label}>{label}</Text>
    {children}
  </View>
);

const ActionButton = ({
  icon,
  label,
  onPress,
  color = Colors.primary,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  color?: string;
}) => (
  <TouchableOpacity style={[styles.actionButton, { backgroundColor: color }]} onPress={onPress}>
    <Ionicons name={icon} size={20} color="#fff" />
    <Text style={styles.actionButtonText}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    gap: 18,
    padding: 20,
    paddingBottom: 44,
  },
  header: {
    gap: 6,
  },
  pageTitle: {
    color: Colors.dark,
    fontFamily: 'mon-b',
    fontSize: 30,
  },
  pageSubtitle: {
    color: Colors.grey,
    fontFamily: 'mon',
    lineHeight: 21,
  },
  heroCard: {
    alignItems: 'center',
    backgroundColor: '#fff5f7',
    borderRadius: 24,
    gap: 14,
    padding: 20,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    backgroundColor: Colors.grey,
    borderColor: '#fff',
    borderRadius: 58,
    borderWidth: 4,
    height: 116,
    width: 116,
  },
  avatarFallback: {
    alignItems: 'center',
    backgroundColor: Colors.dark,
    justifyContent: 'center',
  },
  cameraBadge: {
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderColor: '#fff',
    borderRadius: 18,
    borderWidth: 3,
    bottom: 4,
    height: 36,
    justifyContent: 'center',
    position: 'absolute',
    right: 4,
    width: 36,
  },
  heroText: {
    alignItems: 'center',
    gap: 4,
  },
  nameText: {
    color: Colors.dark,
    fontFamily: 'mon-b',
    fontSize: 22,
  },
  emailText: {
    color: Colors.grey,
    fontFamily: 'mon-sb',
  },
  memberText: {
    color: Colors.grey,
    fontFamily: 'mon',
    fontSize: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderColor: '#e5e5e5',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 16,
    padding: 16,
  },
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  cardTitle: {
    color: Colors.dark,
    fontFamily: 'mon-b',
    fontSize: 19,
  },
  cardSubtitle: {
    color: Colors.grey,
    fontFamily: 'mon',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
  },
  form: {
    gap: 12,
  },
  field: {
    gap: 7,
  },
  label: {
    color: Colors.dark,
    fontFamily: 'mon-sb',
    fontSize: 13,
  },
  input: {
    ...defaultStyles.inputField,
    color: Colors.dark,
    fontFamily: 'mon',
    height: 50,
    paddingHorizontal: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  halfField: {
    flex: 1,
  },
  disabledButton: {
    opacity: 0.6,
  },
  actionsGrid: {
    gap: 12,
  },
  actionButton: {
    alignItems: 'center',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 10,
    height: 54,
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontFamily: 'mon-b',
    fontSize: 16,
  },
  noticeCard: {
    alignItems: 'flex-start',
    backgroundColor: '#fff5f7',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 10,
    padding: 14,
  },
  noticeText: {
    color: Colors.dark,
    flex: 1,
    fontFamily: 'mon',
    lineHeight: 20,
  },
  rulesCard: {
    backgroundColor: '#FAFAFA',
    borderColor: '#ECECEC',
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  ruleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  ruleText: {
    color: '#777',
    fontFamily: 'mon',
    fontSize: 12,
  },
  ruleTextValid: {
    color: '#1E9E5A',
    fontFamily: 'mon-sb',
  },
  passwordButton: {
    alignItems: 'center',
    backgroundColor: Colors.dark,
    borderRadius: 14,
    height: 50,
    justifyContent: 'center',
  },
  passwordButtonText: {
    color: '#fff',
    fontFamily: 'mon-b',
    fontSize: 16,
  },
  logoutButton: {
    alignItems: 'center',
    backgroundColor: '#fff1f1',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 8,
    height: 52,
    justifyContent: 'center',
  },
  logoutText: {
    color: '#b42318',
    fontFamily: 'mon-b',
    fontSize: 16,
  },
  centered: {
    alignItems: 'center',
    backgroundColor: '#fff',
    flex: 1,
    gap: 10,
    justifyContent: 'center',
    padding: 24,
  },
  emptyTitle: {
    color: Colors.dark,
    fontFamily: 'mon-b',
    fontSize: 20,
    textAlign: 'center',
  },
  emptyText: {
    color: Colors.grey,
    fontFamily: 'mon',
    lineHeight: 21,
    textAlign: 'center',
  },
  fullButton: {
    alignSelf: 'stretch',
    marginTop: 8,
  },
});

export default ProfilePage;
