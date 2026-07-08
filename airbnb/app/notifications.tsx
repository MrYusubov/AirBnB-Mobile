import Colors from '@/constants/Colors';
import {
  AppNotification,
  getNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/database/listings';
import { useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const formatDate = (value: string) =>
  new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const getNotificationIcon = (type: AppNotification['type']): keyof typeof Ionicons.glyphMap => {
  switch (type) {
    case 'listing_accepted':
      return 'checkmark-circle-outline';
    case 'listing_rejected':
      return 'close-circle-outline';
    case 'reservation_requested':
      return 'calendar-outline';
    case 'reservation_accepted':
      return 'checkmark-done-circle-outline';
    case 'reservation_cancelled':
      return 'ban-outline';
    default:
      return 'notifications-outline';
  }
};

export default function NotificationsPage() {
  const router = useRouter();
  const { isLoaded, user } = useUser();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    if (!user?.id) {
      setNotifications([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      setNotifications(await getNotificationsForUser(user.id));
    } catch (error) {
      Alert.alert('Could not load notifications', error instanceof Error ? error.message : 'Try again');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [loadNotifications])
  );

  const unreadCount = notifications.filter((item) => !item.read_at).length;

  const onMarkAllRead = async () => {
    if (!user?.id) {
      return;
    }

    await markAllNotificationsRead(user.id);
    await loadNotifications();
  };

  const onOpenNotification = async (notification: AppNotification) => {
    if (!user?.id) {
      return;
    }

    await markNotificationRead(notification.id, user.id);
    setNotifications((current) =>
      current.map((item) =>
        item.id === notification.id ? { ...item, read_at: item.read_at ?? new Date().toISOString() } : item
      )
    );

    if (notification.listing_id) {
      router.push(`/listing/${notification.listing_id}`);
    }
  };

  if (isLoaded && !user) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: 'Notifications' }} />
        <Ionicons name="notifications-outline" size={42} color={Colors.grey} />
        <Text style={styles.emptyTitle}>Login required</Text>
        <Text style={styles.emptyText}>Please log in to see your notifications.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic">
      <Stack.Screen options={{ title: 'Notifications' }} />

      <View style={styles.hero}>
        <View style={styles.heroText}>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.subtitle}>
            House approvals, reservation requests, and reservation updates appear here.
          </Text>
        </View>
        {unreadCount > 0 ? (
          <TouchableOpacity style={styles.markAllButton} onPress={onMarkAllRead}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {isLoading ? (
        <Text style={styles.loadingText}>Loading notifications...</Text>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="file-tray-outline" size={34} color={Colors.grey} />
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptyText}>When something important happens, it will show up here.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {notifications.map((notification) => {
            const unread = !notification.read_at;

            return (
              <TouchableOpacity
                activeOpacity={0.82}
                key={notification.id}
                onPress={() => onOpenNotification(notification)}
                style={[styles.notificationCard, unread && styles.notificationCardUnread]}>
                <View style={[styles.iconWrap, unread && styles.iconWrapUnread]}>
                  <Ionicons
                    name={getNotificationIcon(notification.type)}
                    size={22}
                    color={unread ? '#fff' : Colors.primary}
                  />
                </View>
                <View style={styles.notificationBody}>
                  <View style={styles.notificationTitleRow}>
                    <Text style={styles.notificationTitle}>{notification.title}</Text>
                    {unread ? <View style={styles.unreadDot} /> : null}
                  </View>
                  <Text style={styles.notificationMessage}>{notification.message}</Text>
                  <Text style={styles.notificationDate}>{formatDate(notification.created_at)}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    flex: 1,
  },
  content: {
    gap: 18,
    padding: 20,
    paddingBottom: 44,
  },
  hero: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  heroText: {
    flex: 1,
    gap: 6,
  },
  title: {
    color: Colors.dark,
    fontFamily: 'mon-b',
    fontSize: 30,
  },
  subtitle: {
    color: Colors.grey,
    fontFamily: 'mon',
    lineHeight: 21,
  },
  markAllButton: {
    backgroundColor: '#fff0f3',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  markAllText: {
    color: Colors.primary,
    fontFamily: 'mon-b',
    fontSize: 12,
  },
  loadingText: {
    color: Colors.grey,
    fontFamily: 'mon-sb',
    textAlign: 'center',
  },
  list: {
    gap: 12,
  },
  notificationCard: {
    alignItems: 'flex-start',
    borderColor: '#e5e5e5',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  notificationCardUnread: {
    backgroundColor: '#fff7f8',
    borderColor: '#ffd2db',
  },
  iconWrap: {
    alignItems: 'center',
    backgroundColor: '#fff0f3',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  iconWrapUnread: {
    backgroundColor: Colors.primary,
  },
  notificationBody: {
    flex: 1,
    gap: 5,
  },
  notificationTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  notificationTitle: {
    color: Colors.dark,
    flex: 1,
    fontFamily: 'mon-b',
    fontSize: 16,
  },
  unreadDot: {
    backgroundColor: Colors.primary,
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  notificationMessage: {
    color: Colors.dark,
    fontFamily: 'mon',
    lineHeight: 20,
  },
  notificationDate: {
    color: Colors.grey,
    fontFamily: 'mon-sb',
    fontSize: 12,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#fafafa',
    borderColor: '#e5e5e5',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
    padding: 22,
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
    fontSize: 18,
    textAlign: 'center',
  },
  emptyText: {
    color: Colors.grey,
    fontFamily: 'mon',
    lineHeight: 21,
    textAlign: 'center',
  },
});
