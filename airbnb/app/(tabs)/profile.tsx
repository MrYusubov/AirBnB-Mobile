import {
  View,
  Text,
  Button,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Image,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import React, { useEffect, useState } from 'react';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { defaultStyles } from '@/constants/Styles';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import { Link, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ADMIN_EMAIL, useIsAdmin } from '@/lib/admin';
import { upsertUser } from '@/lib/database/listings';

const Page = () => {
  const { signOut, isSignedIn } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const [firstName, setFirstName] = useState(user?.firstName);
  const [lastName, setLastName] = useState(user?.lastName);
  const [email, setEmail] = useState(user?.emailAddresses[0].emailAddress);
  const [edit, setEdit] = useState(false);
  const { email: authEmail, isAdmin } = useIsAdmin();

  // Load user data on mount
  useEffect(() => {
    if (!user) {
      return;
    }

    setFirstName(user.firstName);
    setLastName(user.lastName);
    setEmail(user.emailAddresses[0].emailAddress);
    upsertUser({
      id: user.id,
      email: user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null,
      first_name: user.firstName,
      last_name: user.lastName,
      image_url: user.imageUrl,
    }).catch((error) => {
      console.log('Failed to sync user to SQLite', error);
    });
  }, [user]);

  // Update Clerk user data
  const onSaveUser = async () => {
    try {
      await user?.update({
        firstName: firstName!,
        lastName: lastName!,
      });
    } catch (error) {
      console.log(error);
    } finally {
      setEdit(false);
    }
  };

  // Capture image from camera roll
  // Upload to Clerk as avatar
  const onCaptureImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.75,
      base64: true,
    });

    if (!result.canceled) {
      const base64 = `data:image/png;base64,${result.assets[0].base64}`;
      user?.setProfileImage({
        file: base64,
      });
    }
  };

  return (
    <SafeAreaView style={defaultStyles.container}>
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        <View style={styles.headerContainer}>
          <Text style={styles.header}>Profile</Text>
          <Ionicons name="notifications-outline" size={26} />
        </View>

        {user && (
          <View style={styles.card}>
            <TouchableOpacity onPress={onCaptureImage}>
              <Image source={{ uri: user?.imageUrl }} style={styles.avatar} />
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {!edit && (
                <View style={styles.editRow}>
                  <Text style={{ fontFamily: 'mon-b', fontSize: 22 }}>
                    {firstName} {lastName}
                  </Text>
                  <TouchableOpacity onPress={() => setEdit(true)}>
                    <Ionicons name="create-outline" size={24} color={Colors.dark} />
                  </TouchableOpacity>
                </View>
              )}
              {edit && (
                <View style={styles.editRow}>
                  <TextInput
                    placeholder="First Name"
                    value={firstName || ''}
                    onChangeText={setFirstName}
                    style={[defaultStyles.inputField, { width: 100 }]}
                  />
                  <TextInput
                    placeholder="Last Name"
                    value={lastName || ''}
                    onChangeText={setLastName}
                    style={[defaultStyles.inputField, { width: 100 }]}
                  />
                  <TouchableOpacity onPress={onSaveUser}>
                    <Ionicons name="checkmark-outline" size={24} color={Colors.dark} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
            <Text>{email}</Text>
            <Text>Since {user?.createdAt!.toLocaleDateString()}</Text>
          </View>
        )}

        {isSignedIn && (
          <View style={styles.adminDebug}>
            <Text style={styles.adminDebugTitle}>Admin debug</Text>
            <Text style={styles.adminDebugText}>isAdmin: {isAdmin ? 'true' : 'false'}</Text>
            <Text style={styles.adminDebugText}>login email: {authEmail ?? 'none'}</Text>
            <Text style={styles.adminDebugText}>admin email: {ADMIN_EMAIL}</Text>
          </View>
        )}

        {isSignedIn && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/(modals)/add-house')}>
              <Ionicons name="home-outline" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Add House</Text>
            </TouchableOpacity>

            {isAdmin && (
              <TouchableOpacity
                style={[styles.actionButton, styles.adminButton]}
                onPress={() => router.push('/admin/pending-houses')}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Pending Houses</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {isSignedIn && <Button title="Log Out" onPress={() => signOut()} color={Colors.dark} />}
        {!isSignedIn && (
          <Link href={'/(modals)/login'} asChild>
            <Button title="Log In" color={Colors.dark} />
          </Link>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingBottom: 40,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 24,
  },
  header: {
    fontFamily: 'mon-b',
    fontSize: 24,
  },
  card: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 16,
    marginHorizontal: 24,
    marginTop: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: {
      width: 1,
      height: 2,
    },
    alignItems: 'center',
    gap: 14,
    marginBottom: 24,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.grey,
  },
  editRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actions: {
    gap: 12,
    marginHorizontal: 24,
    marginBottom: 24,
  },
  adminDebug: {
    marginHorizontal: 24,
    marginBottom: 14,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#fff7e6',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#f0c36d',
    gap: 4,
  },
  adminDebugTitle: {
    fontFamily: 'mon-b',
    color: Colors.dark,
    fontSize: 15,
  },
  adminDebugText: {
    fontFamily: 'mon',
    color: Colors.dark,
  },
  actionButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  adminButton: {
    backgroundColor: Colors.dark,
  },
  actionButtonText: {
    color: '#fff',
    fontFamily: 'mon-b',
    fontSize: 16,
  },
});

export default Page;
