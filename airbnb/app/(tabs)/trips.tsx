import Colors from '@/constants/Colors';
import { defaultStyles } from '@/constants/Styles';
import { addReview, getCompletedTripsForUser, upsertUser, UserTrip } from '@/lib/database/listings';
import { useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const formatDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

const formatMoney = (value: number | string | null | undefined) => `$${Number(value ?? 0).toFixed(0)}`;
const formatGuests = (trip: UserTrip) =>
  `${trip.adults} adult${trip.adults > 1 ? 's' : ''}, ${trip.children} children, ${trip.infants} infant${trip.infants === 1 ? '' : 's'}`;

const getNights = (checkIn: string, checkOut: string) => {
  const start = new Date(`${checkIn}T00:00:00`).getTime();
  const end = new Date(`${checkOut}T00:00:00`).getTime();
  const diff = end - start;

  if (!Number.isFinite(diff) || diff <= 0) {
    return 1;
  }

  return Math.max(1, Math.round(diff / 86400000));
};

const TripsPage = () => {
  const router = useRouter();
  const { isLoaded, isSignedIn, user } = useUser();
  const [trips, setTrips] = useState<UserTrip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadTrips = useCallback(async () => {
    if (!user?.id) {
      setTrips([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      await upsertUser({
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null,
        first_name: user.firstName,
        last_name: user.lastName,
        image_url: user.imageUrl,
      });
      setTrips(await getCompletedTripsForUser(user.id));
    } catch (error) {
      Alert.alert('Could not load trips', error instanceof Error ? error.message : 'Try again');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadTrips();
    }, [loadTrips])
  );

  const openReviewForm = (trip: UserTrip) => {
    setActiveBookingId(trip.id);
    setRating(5);
    setComment('');
  };

  const onSubmitReview = async (trip: UserTrip) => {
    if (!user?.id) {
      Alert.alert('Login required', 'Please log in to write a review.');
      return;
    }

    if (!comment.trim()) {
      Alert.alert('Missing comment', 'Please write a short comment before submitting.');
      return;
    }

    setIsSubmitting(true);

    try {
      await addReview({
        listingId: trip.listing_id,
        userId: user.id,
        bookingId: trip.id,
        userName: user.fullName ?? user.firstName ?? 'Guest',
        rating,
        comment,
      });
      setActiveBookingId(null);
      setComment('');
      setRating(5);
      await loadTrips();
    } catch (error) {
      Alert.alert('Could not submit review', error instanceof Error ? error.message : 'Try again');
    } finally {
      setIsSubmitting(false);
    }
  };

  const reviewedCount = trips.filter((trip) => trip.review_id).length;

  if (isLoaded && !isSignedIn) {
    return (
      <View style={styles.centered}>
        <Ionicons name="airplane-outline" size={38} color={Colors.grey} />
        <Text style={styles.emptyTitle}>Login to see your trips</Text>
        <Text style={styles.emptyText}>Completed stays and review options will show here.</Text>
        <Link href="/(modals)/login" asChild>
          <TouchableOpacity style={[defaultStyles.btn, styles.loginButton]}>
            <Text style={defaultStyles.btnText}>Log In</Text>
          </TouchableOpacity>
        </Link>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={styles.header}>
        <Text style={styles.title}>Trips</Text>
        <Text style={styles.subtitle}>
          Homes appear here after the host accepts your reservation and your checkout date has passed.
        </Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Ionicons name="bed-outline" size={22} color={Colors.primary} />
          <Text style={styles.statValue}>{trips.length}</Text>
          <Text style={styles.statLabel}>Completed stays</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="chatbubble-ellipses-outline" size={22} color={Colors.primary} />
          <Text style={styles.statValue}>{reviewedCount}</Text>
          <Text style={styles.statLabel}>Reviewed</Text>
        </View>
      </View>

      {isLoading ? (
        <Text style={styles.loadingText}>Loading trips...</Text>
      ) : trips.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="calendar-outline" size={34} color={Colors.grey} />
          <Text style={styles.emptyTitle}>No completed trips yet</Text>
          <Text style={styles.emptyText}>
            Accepted reservations will move here after checkout. Then you can review the house.
          </Text>
          <TouchableOpacity style={[defaultStyles.btn, styles.loginButton]} onPress={() => router.push('/')}>
            <Text style={defaultStyles.btnText}>Explore homes</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.tripList}>
          {trips.map((trip) => (
            <TripCard
              key={trip.id}
              active={activeBookingId === trip.id}
              comment={comment}
              isSubmitting={isSubmitting}
              onCancel={() => setActiveBookingId(null)}
              onChangeComment={setComment}
              onOpen={() => router.push(`/listing/${trip.listing_id}`)}
              onOpenReview={() => openReviewForm(trip)}
              onSelectRating={setRating}
              onSubmit={() => onSubmitReview(trip)}
              rating={rating}
              trip={trip}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const TripCard = ({
  trip,
  active,
  rating,
  comment,
  isSubmitting,
  onOpen,
  onOpenReview,
  onSelectRating,
  onChangeComment,
  onSubmit,
  onCancel,
}: {
  trip: UserTrip;
  active: boolean;
  rating: number;
  comment: string;
  isSubmitting: boolean;
  onOpen: () => void;
  onOpenReview: () => void;
  onSelectRating: (rating: number) => void;
  onChangeComment: (comment: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) => {
  const imageUrl = trip.listing.image_urls?.[0] ?? trip.listing.medium_url ?? trip.listing.xl_picture_url;
  const nights = getNights(trip.check_in, trip.check_out);
  const reviewed = Boolean(trip.review_id);

  return (
    <View style={styles.tripCard}>
      <TouchableOpacity activeOpacity={0.88} onPress={onOpen}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.tripImage} />
        ) : (
          <View style={[styles.tripImage, styles.emptyImage]}>
            <Ionicons name="image-outline" size={34} color={Colors.grey} />
          </View>
        )}
        <View style={styles.completedBadge}>
          <Ionicons name="checkmark-circle" size={15} color="#fff" />
          <Text style={styles.completedBadgeText}>Stayed</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.tripBody}>
        <View style={styles.tripTitleRow}>
          <View style={styles.tripTitleBlock}>
            <Text numberOfLines={1} style={styles.tripTitle}>
              {trip.listing.name}
            </Text>
            <Text numberOfLines={1} style={styles.tripLocation}>
              {trip.listing.smart_location ?? 'No address'}
            </Text>
          </View>
          <Text style={styles.tripPrice}>{formatMoney(trip.total_price)}</Text>
        </View>

        <View style={styles.metaGrid}>
          <MetaPill icon="calendar-outline" label={`${formatDate(trip.check_in)} -> ${formatDate(trip.check_out)}`} />
          <MetaPill icon="moon-outline" label={`${nights} night${nights > 1 ? 's' : ''}`} />
          <MetaPill icon="people-outline" label={formatGuests(trip)} />
        </View>

        {reviewed ? (
          <View style={styles.reviewPreview}>
            <View style={styles.reviewPreviewHeader}>
              <Text style={styles.reviewPreviewTitle}>Your review</Text>
              <View style={styles.reviewStarsSmall}>
                <Ionicons name="star" size={15} color={Colors.primary} />
                <Text style={styles.reviewRatingSmall}>{trip.review_rating}</Text>
              </View>
            </View>
            <Text style={styles.reviewPreviewComment}>{trip.review_comment}</Text>
          </View>
        ) : active ? (
          <View style={styles.writeCard}>
            <Text style={styles.writeTitle}>Write comment</Text>
            <View style={styles.starsPicker}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => onSelectRating(star)}>
                  <Ionicons
                    name={star <= rating ? 'star' : 'star-outline'}
                    size={30}
                    color={Colors.primary}
                  />
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              multiline
              onChangeText={onChangeComment}
              placeholder="Tell future guests what your stay was like"
              placeholderTextColor={Colors.grey}
              style={styles.reviewInput}
              value={comment}
            />
            <View style={styles.writeActions}>
              <TouchableOpacity style={styles.cancelReviewButton} onPress={onCancel}>
                <Text style={styles.cancelReviewText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={isSubmitting}
                onPress={onSubmit}
                style={[styles.submitReviewButton, isSubmitting && styles.disabledButton]}>
                <Text style={styles.submitReviewText}>
                  {isSubmitting ? 'Submitting...' : 'Submit'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.writeButton} onPress={onOpenReview}>
            <Ionicons name="create-outline" size={18} color={Colors.primary} />
            <Text style={styles.writeButtonText}>Write comment</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const MetaPill = ({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) => (
  <View style={styles.metaPill}>
    <Ionicons name={icon} size={15} color={Colors.grey} />
    <Text numberOfLines={1} style={styles.metaPillText}>
      {label}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    gap: 18,
    padding: 20,
    paddingBottom: 42,
  },
  header: {
    gap: 8,
  },
  title: {
    color: Colors.dark,
    fontFamily: 'mon-b',
    fontSize: 30,
  },
  subtitle: {
    color: Colors.grey,
    fontFamily: 'mon',
    fontSize: 14,
    lineHeight: 21,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    backgroundColor: '#fff5f7',
    borderRadius: 18,
    flex: 1,
    gap: 7,
    padding: 14,
  },
  statValue: {
    color: Colors.dark,
    fontFamily: 'mon-b',
    fontSize: 24,
  },
  statLabel: {
    color: Colors.grey,
    fontFamily: 'mon',
    fontSize: 12,
  },
  loadingText: {
    color: Colors.grey,
    fontFamily: 'mon-sb',
    textAlign: 'center',
  },
  tripList: {
    gap: 18,
  },
  tripCard: {
    borderColor: '#e1e1e1',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  tripImage: {
    backgroundColor: '#f2f2f2',
    height: 220,
    width: '100%',
  },
  emptyImage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(10, 127, 57, 0.92)',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 5,
    left: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    position: 'absolute',
    top: 12,
  },
  completedBadgeText: {
    color: '#fff',
    fontFamily: 'mon-b',
    fontSize: 12,
  },
  tripBody: {
    gap: 13,
    padding: 14,
  },
  tripTitleRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  tripTitleBlock: {
    flex: 1,
    gap: 4,
  },
  tripTitle: {
    color: Colors.dark,
    fontFamily: 'mon-b',
    fontSize: 18,
  },
  tripLocation: {
    color: Colors.grey,
    fontFamily: 'mon',
    fontSize: 13,
  },
  tripPrice: {
    color: Colors.dark,
    fontFamily: 'mon-b',
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaPill: {
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 5,
    maxWidth: '100%',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  metaPillText: {
    color: Colors.dark,
    fontFamily: 'mon-sb',
    fontSize: 12,
  },
  writeButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#fff0f3',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  writeButtonText: {
    color: Colors.primary,
    fontFamily: 'mon-b',
  },
  writeCard: {
    backgroundColor: '#fff7f8',
    borderRadius: 16,
    gap: 12,
    padding: 14,
  },
  writeTitle: {
    color: Colors.dark,
    fontFamily: 'mon-b',
    fontSize: 17,
  },
  starsPicker: {
    flexDirection: 'row',
    gap: 8,
  },
  reviewInput: {
    backgroundColor: '#fff',
    borderColor: '#d8d8d8',
    borderRadius: 12,
    borderWidth: 1,
    color: Colors.dark,
    fontFamily: 'mon',
    minHeight: 96,
    padding: 12,
    textAlignVertical: 'top',
  },
  writeActions: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelReviewButton: {
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    flex: 1,
    height: 46,
    justifyContent: 'center',
  },
  cancelReviewText: {
    color: Colors.dark,
    fontFamily: 'mon-b',
  },
  submitReviewButton: {
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    flex: 1,
    height: 46,
    justifyContent: 'center',
  },
  submitReviewText: {
    color: '#fff',
    fontFamily: 'mon-b',
  },
  disabledButton: {
    opacity: 0.6,
  },
  reviewPreview: {
    backgroundColor: '#f8f8f8',
    borderRadius: 16,
    gap: 8,
    padding: 13,
  },
  reviewPreviewHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  reviewPreviewTitle: {
    color: Colors.dark,
    fontFamily: 'mon-b',
  },
  reviewStarsSmall: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  reviewRatingSmall: {
    color: Colors.dark,
    fontFamily: 'mon-b',
  },
  reviewPreviewComment: {
    color: Colors.dark,
    fontFamily: 'mon',
    lineHeight: 21,
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
  loginButton: {
    alignSelf: 'stretch',
    marginTop: 8,
  },
});

export default TripsPage;
