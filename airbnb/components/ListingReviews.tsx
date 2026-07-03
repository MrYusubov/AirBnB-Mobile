import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '@clerk/clerk-expo';
import Colors from '@/constants/Colors';
import { defaultStyles } from '@/constants/Styles';
import {
  addReview,
  getListingReviews,
  getReviewEligibility,
  getReviewStats,
  Review,
  ReviewStats,
} from '@/lib/database/listings';

const PAGE_SIZE = 5;
const starRows: Array<1 | 2 | 3 | 4 | 5> = [5, 4, 3, 2, 1];

const emptyStats: ReviewStats = {
  average: 0,
  total: 0,
  distribution: {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  },
};

type Eligibility = {
  canReview: boolean;
  bookingId: string | null;
  message: string | null;
};

type Props = {
  listingId: string;
};

const formatReviewDate = (value: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const ListingReviews = ({ listingId }: Props) => {
  const { isSignedIn, user } = useUser();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<ReviewStats>(emptyStats);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [eligibility, setEligibility] = useState<Eligibility>({
    canReview: false,
    bookingId: null,
    message: null,
  });
  const [selectedRating, setSelectedRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadReviews = useCallback(async () => {
    const [nextStats, nextReviews] = await Promise.all([
      getReviewStats(listingId),
      getListingReviews(listingId, visibleCount, 0),
    ]);

    setStats(nextStats);
    setReviews(nextReviews);

    if (user?.id) {
      setEligibility(await getReviewEligibility(user.id, listingId));
    } else {
      setEligibility({
        canReview: false,
        bookingId: null,
        message: 'Log in and complete a stay to write a review.',
      });
    }
  }, [listingId, user?.id, visibleCount]);

  useEffect(() => {
    loadReviews().catch((error) => {
      console.error('Failed to load reviews', error);
    });
  }, [loadReviews]);

  const onSubmitReview = async () => {
    if (!user?.id || !eligibility.bookingId) {
      Alert.alert('Not ready yet', eligibility.message ?? 'You can review this home after your stay.');
      return;
    }

    if (!comment.trim()) {
      Alert.alert('Missing review', 'Please write a short comment before submitting.');
      return;
    }

    setIsSubmitting(true);

    try {
      await addReview({
        listingId,
        userId: user.id,
        bookingId: eligibility.bookingId,
        userName: user.fullName ?? user.firstName ?? 'Guest',
        rating: selectedRating,
        comment,
      });
      setComment('');
      setSelectedRating(5);
      await loadReviews();
    } catch (error) {
      Alert.alert('Could not submit review', error instanceof Error ? error.message : 'Try again');
    } finally {
      setIsSubmitting(false);
    }
  };

  const averageText = stats.total > 0 ? stats.average.toFixed(1) : '0.0';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Reviews</Text>
        <View style={styles.averageRow}>
          <Ionicons name="star" size={18} color={Colors.dark} />
          <Text style={styles.averageText}>{averageText}</Text>
          <Text style={styles.totalText}>({stats.total})</Text>
        </View>
      </View>

      <View style={styles.distribution}>
        {starRows.map((star) => {
          const count = stats.distribution[star];
          const width = stats.total > 0 ? `${(count / stats.total) * 100}%` : '0%';

          return (
            <View key={star} style={styles.distributionRow}>
              <Text style={styles.starLabel}>{star}</Text>
              <Ionicons name="star" size={13} color={Colors.dark} />
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: width as any }]} />
              </View>
              <Text style={styles.countLabel}>{count}</Text>
            </View>
          );
        })}
      </View>

      {reviews.length === 0 ? (
        <Text style={styles.emptyText}>No reviews yet. The first completed guest review will show here.</Text>
      ) : (
        <View style={styles.reviewList}>
          {reviews.map((review) => (
            <View key={review.id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{(review.user_name ?? 'G').charAt(0)}</Text>
                </View>
                <View style={styles.reviewMeta}>
                  <Text style={styles.reviewer}>{review.user_name ?? 'Guest'}</Text>
                  <Text style={styles.reviewDate}>{formatReviewDate(review.created_at)}</Text>
                </View>
                <View style={styles.reviewStars}>
                  <Ionicons name="star" size={14} color={Colors.dark} />
                  <Text style={styles.reviewRating}>{review.rating}</Text>
                </View>
              </View>
              <Text style={styles.comment}>{review.comment}</Text>
            </View>
          ))}
        </View>
      )}

      {reviews.length < stats.total && (
        <TouchableOpacity style={styles.showMoreButton} onPress={() => setVisibleCount((value) => value + PAGE_SIZE)}>
          <Text style={styles.showMoreText}>Show more reviews</Text>
        </TouchableOpacity>
      )}

      {isSignedIn && eligibility.canReview && (
        <View style={styles.writeCard}>
          <Text style={styles.writeTitle}>Write a review</Text>
          <View style={styles.starsPicker}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => setSelectedRating(star)}>
                <Ionicons
                  name={star <= selectedRating ? 'star' : 'star-outline'}
                  size={28}
                  color={Colors.primary}
                />
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.reviewInput}
            value={comment}
            onChangeText={setComment}
            placeholder="Tell future guests what your stay was like"
            placeholderTextColor={Colors.grey}
            multiline
          />
          <TouchableOpacity
            style={[defaultStyles.btn, isSubmitting && styles.disabledButton]}
            disabled={isSubmitting}
            onPress={onSubmitReview}>
            <Text style={defaultStyles.btnText}>{isSubmitting ? 'Submitting...' : 'Submit Review'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {isSignedIn && !eligibility.canReview && (
        <Text style={styles.reviewHint}>{eligibility.message}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    fontFamily: 'mon-b',
    fontSize: 22,
    color: Colors.dark,
  },
  averageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  averageText: {
    fontFamily: 'mon-b',
    fontSize: 18,
    color: Colors.dark,
  },
  totalText: {
    fontFamily: 'mon',
    color: Colors.grey,
  },
  distribution: {
    gap: 8,
  },
  distributionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  starLabel: {
    width: 12,
    fontFamily: 'mon-sb',
    color: Colors.dark,
  },
  barTrack: {
    flex: 1,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#eeeeee',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: Colors.dark,
  },
  countLabel: {
    width: 22,
    textAlign: 'right',
    fontFamily: 'mon',
    color: Colors.grey,
    fontVariant: ['tabular-nums'],
  },
  emptyText: {
    fontFamily: 'mon',
    color: Colors.grey,
    lineHeight: 22,
  },
  reviewList: {
    gap: 14,
  },
  reviewCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e0e0e0',
    gap: 10,
    backgroundColor: '#fff',
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#f4f4f4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'mon-b',
    color: Colors.dark,
    textTransform: 'uppercase',
  },
  reviewMeta: {
    flex: 1,
  },
  reviewer: {
    fontFamily: 'mon-sb',
    color: Colors.dark,
  },
  reviewDate: {
    fontFamily: 'mon',
    color: Colors.grey,
    fontSize: 12,
  },
  reviewStars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  reviewRating: {
    fontFamily: 'mon-sb',
    color: Colors.dark,
  },
  comment: {
    fontFamily: 'mon',
    color: Colors.dark,
    lineHeight: 22,
  },
  showMoreButton: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  showMoreText: {
    fontFamily: 'mon-sb',
    color: Colors.dark,
  },
  writeCard: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#fff7f8',
    gap: 12,
  },
  writeTitle: {
    fontFamily: 'mon-b',
    fontSize: 18,
    color: Colors.dark,
  },
  starsPicker: {
    flexDirection: 'row',
    gap: 8,
  },
  reviewInput: {
    minHeight: 100,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d8d8d8',
    backgroundColor: '#fff',
    padding: 12,
    fontFamily: 'mon',
    color: Colors.dark,
    textAlignVertical: 'top',
  },
  disabledButton: {
    opacity: 0.6,
  },
  reviewHint: {
    fontFamily: 'mon',
    color: Colors.grey,
    lineHeight: 21,
  },
});

export default ListingReviews;
