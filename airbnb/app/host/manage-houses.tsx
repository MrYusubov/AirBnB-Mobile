import Colors from '@/constants/Colors';
import { defaultStyles } from '@/constants/Styles';
import {
  deleteHostListing,
  getHostListings,
  getHostReservations,
  HostReservation,
  Listing,
  updateBookingStatus,
  updateListingPrice,
} from '@/lib/database/listings';
import { useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const RESERVATIONS_PAGE_SIZE = 6;
const toDate = (value: string) => new Date(`${value}T00:00:00`);
const toIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const addMonths = (date: Date, months: number) => new Date(date.getFullYear(), date.getMonth() + months, 1);
const formatMoney = (value: number | string | null | undefined) => `$${Number(value ?? 0).toFixed(0)}`;
const formatDate = (value: string) =>
  toDate(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
const formatGuests = (reservation: HostReservation) =>
  `${reservation.adults} adult${reservation.adults > 1 ? 's' : ''}, ${reservation.children} children, ${reservation.infants} infant${reservation.infants === 1 ? '' : 's'}`;
const isAcceptedReservation = (reservation: HostReservation) =>
  reservation.status === 'accepted' || reservation.status === 'paid';
const isCompletedReservation = (reservation: HostReservation, todayIso: string) =>
  isAcceptedReservation(reservation) && reservation.check_out <= todayIso;

const getMonthInfo = (monthDate: Date, reservations: HostReservation[]) => {
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const nextMonthStart = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1);
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const firstWeekday = monthStart.getDay();
  const reservedDays = new Set<string>();
  const monthReservations = reservations.filter((reservation) => {
    const start = toDate(reservation.check_in);
    const end = toDate(reservation.check_out);
    return isAcceptedReservation(reservation) && start < nextMonthStart && end > monthStart;
  });

  monthReservations.forEach((reservation) => {
    let cursor = new Date(Math.max(toDate(reservation.check_in).getTime(), monthStart.getTime()));
    const end = new Date(Math.min(toDate(reservation.check_out).getTime(), nextMonthStart.getTime()));

    while (cursor < end) {
      reservedDays.add(toIsoDate(cursor));
      cursor = addDays(cursor, 1);
    }
  });

  return {
    daysInMonth,
    firstWeekday,
    monthReservations,
    reservedDays,
  };
};

export default function ManageHousesPage() {
  const router = useRouter();
  const { isLoaded, user } = useUser();
  const [houses, setHouses] = useState<Listing[]>([]);
  const [reservations, setReservations] = useState<HostReservation[]>([]);
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [reservationPage, setReservationPage] = useState(1);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const [nextHouses, nextReservations] = await Promise.all([
        getHostListings(user.id),
        getHostReservations(user.id),
      ]);

      setHouses(nextHouses);
      setReservations(nextReservations);
      setPriceDrafts(
        nextHouses.reduce<Record<string, string>>((acc, house) => {
          acc[house.id] = String(house.price ?? 0);
          return acc;
        }, {})
      );
    } catch (error) {
      Alert.alert('Could not load host dashboard', error instanceof Error ? error.message : 'Try again');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard])
  );

  const pendingReservations = reservations.filter((reservation) => reservation.status === 'pending');
  const acceptedReservations = reservations.filter(isAcceptedReservation);
  const todayIso = toIsoDate(new Date());
  const reservationPageCount = Math.max(1, Math.ceil(reservations.length / RESERVATIONS_PAGE_SIZE));
  const activeReservationPage = Math.min(reservationPage, reservationPageCount);
  const reservationStartIndex = (activeReservationPage - 1) * RESERVATIONS_PAGE_SIZE;
  const paginatedReservations = reservations.slice(
    reservationStartIndex,
    reservationStartIndex + RESERVATIONS_PAGE_SIZE
  );
  const reservationEndIndex = reservationStartIndex + paginatedReservations.length;
  const acceptedRevenue = acceptedReservations.reduce(
    (sum, reservation) => sum + Number(reservation.total_price ?? 0),
    0
  );
  const monthLabel = visibleMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
  const monthInfo = useMemo(
    () => getMonthInfo(visibleMonth, reservations),
    [reservations, visibleMonth]
  );

  useEffect(() => {
    setReservationPage((page) => Math.min(page, reservationPageCount));
  }, [reservationPageCount]);

  const onSavePrice = async (house: Listing) => {
    if (!user?.id) {
      return;
    }

    const nextPrice = Number(priceDrafts[house.id]);

    if (!Number.isFinite(nextPrice) || nextPrice < 0) {
      Alert.alert('Invalid price', 'Please enter a valid price.');
      return;
    }

    try {
      await updateListingPrice(house.id, user.id, nextPrice);
      await loadDashboard();
    } catch (error) {
      Alert.alert('Could not update price', error instanceof Error ? error.message : 'Try again');
    }
  };

  const onDeleteHouse = (house: Listing) => {
    if (!user?.id) {
      return;
    }

    Alert.alert('Delete house', `Delete "${house.name}" and its reservations?`, [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteHostListing(house.id, user.id);
            await loadDashboard();
          } catch (error) {
            Alert.alert('Could not delete house', error instanceof Error ? error.message : 'Try again');
          }
        },
      },
    ]);
  };

  const onSetReservationStatus = async (
    reservation: HostReservation,
    status: 'accepted' | 'cancelled'
  ) => {
    try {
      await updateBookingStatus(reservation.id, status);
      await loadDashboard();
    } catch (error) {
      Alert.alert('Could not update reservation', error instanceof Error ? error.message : 'Try again');
    }
  };

  if (isLoaded && !user) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: 'Manage houses' }} />
        <Text style={styles.emptyTitle}>Login required</Text>
        <Text style={styles.emptyText}>Please log in to manage your houses.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic">
      <Stack.Screen options={{ title: 'Manage houses' }} />

      <View style={styles.hero}>
        <Text style={styles.title}>Host dashboard</Text>
        <Text style={styles.subtitle}>
          Manage your houses, approve reservation requests, and watch accepted stays month by month.
        </Text>
      </View>

      <View style={styles.statsRow}>
        <StatCard label="Houses" value={String(houses.length)} icon="home-outline" />
        <StatCard label="Pending" value={String(pendingReservations.length)} icon="time-outline" />
        <StatCard label="Accepted" value={formatMoney(acceptedRevenue)} icon="trending-up-outline" />
      </View>

      <SectionHeader
        title="Your houses"
        subtitle="Edit nightly price or remove houses you no longer host."
      />

      {isLoading ? (
        <Text style={styles.loadingText}>Loading host data...</Text>
      ) : houses.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="home-outline" size={30} color={Colors.grey} />
          <Text style={styles.emptyTitle}>No houses yet</Text>
          <Text style={styles.emptyText}>Add your first house and it will appear here.</Text>
          <TouchableOpacity
            style={[defaultStyles.btn, styles.addHouseButton]}
            onPress={() => router.push('/(modals)/add-house')}>
            <Text style={defaultStyles.btnText}>Add House</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.houseList}>
          {houses.map((house) => (
            <HouseCard
              key={house.id}
              house={house}
              priceDraft={priceDrafts[house.id] ?? ''}
              onChangePrice={(value) =>
                setPriceDrafts((current) => ({
                  ...current,
                  [house.id]: value.replace(/[^0-9.]/g, ''),
                }))
              }
              onDelete={() => onDeleteHouse(house)}
              onOpen={() => router.push(`/listing/${house.id}`)}
              onSavePrice={() => onSavePrice(house)}
            />
          ))}
        </View>
      )}

      <SectionHeader
        title="Reservations"
        subtitle="Accept or cancel requests from guests who want to stay in your houses."
      />

      {reservations.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="calendar-outline" size={30} color={Colors.grey} />
          <Text style={styles.emptyTitle}>No reservations yet</Text>
          <Text style={styles.emptyText}>Reservation requests will show up here.</Text>
        </View>
      ) : (
        <View style={styles.reservationList}>
          <Text style={styles.paginationSummary}>
            Showing {reservationStartIndex + 1}-{reservationEndIndex} of {reservations.length}
          </Text>
          {paginatedReservations.map((reservation) => (
            <ReservationCard
              key={reservation.id}
              isCompleted={isCompletedReservation(reservation, todayIso)}
              reservation={reservation}
              onAccept={() => onSetReservationStatus(reservation, 'accepted')}
              onCancel={() => onSetReservationStatus(reservation, 'cancelled')}
            />
          ))}
          {reservationPageCount > 1 ? (
            <PaginationControls
              onNext={() => setReservationPage(Math.min(reservationPageCount, activeReservationPage + 1))}
              onPrevious={() => setReservationPage(Math.max(1, activeReservationPage - 1))}
              page={activeReservationPage}
              pageCount={reservationPageCount}
            />
          ) : null}
        </View>
      )}

      <SectionHeader
        title="Accepted calendar"
        subtitle="Reserved nights are highlighted for the selected month."
      />

      <View style={styles.chartCard}>
        <View style={styles.monthHeader}>
          <TouchableOpacity style={styles.monthButton} onPress={() => setVisibleMonth((month) => addMonths(month, -1))}>
            <Ionicons name="chevron-back" size={22} color={Colors.dark} />
          </TouchableOpacity>
          <Text style={styles.monthTitle}>{monthLabel}</Text>
          <TouchableOpacity style={styles.monthButton} onPress={() => setVisibleMonth((month) => addMonths(month, 1))}>
            <Ionicons name="chevron-forward" size={22} color={Colors.dark} />
          </TouchableOpacity>
        </View>

        <View style={styles.weekRow}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
            <Text key={`${day}-${index}`} style={styles.weekDay}>
              {day}
            </Text>
          ))}
        </View>

        <View style={styles.dayGrid}>
          {Array.from({ length: monthInfo.firstWeekday }).map((_, index) => (
            <View key={`empty-${index}`} style={[styles.dayCell, styles.placeholderDay]} />
          ))}
          {Array.from({ length: monthInfo.daysInMonth }).map((_, index) => {
            const day = index + 1;
            const iso = toIsoDate(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day));
            const reserved = monthInfo.reservedDays.has(iso);

            return (
              <View key={iso} style={[styles.dayCell, reserved && styles.reservedDay]}>
                <Text style={[styles.dayText, reserved && styles.reservedDayText]}>{day}</Text>
              </View>
            );
          })}
        </View>

        {monthInfo.monthReservations.length === 0 ? (
          <Text style={styles.chartEmpty}>No accepted stays for this month.</Text>
        ) : (
          <View style={styles.chartReservations}>
            {monthInfo.monthReservations.map((reservation) => (
              <View key={reservation.id} style={styles.chartReservationRow}>
                <View style={styles.chartDot} />
                <View style={styles.chartReservationText}>
                  <Text numberOfLines={1} style={styles.chartReservationTitle}>
                    {reservation.listing_name ?? 'House'}
                  </Text>
                  <Text style={styles.chartReservationMeta}>
                    {formatDate(reservation.check_in)} - {formatDate(reservation.check_out)} ·{' '}
                    {reservation.guest_name ?? reservation.guest_email ?? 'Guest'}
                  </Text>
                </View>
                <Text style={styles.chartPrice}>{formatMoney(reservation.total_price)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const SectionHeader = ({ title, subtitle }: { title: string; subtitle: string }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <Text style={styles.sectionSubtitle}>{subtitle}</Text>
  </View>
);

const StatCard = ({ label, value, icon }: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap }) => (
  <View style={styles.statCard}>
    <Ionicons name={icon} size={20} color={Colors.primary} />
    <Text numberOfLines={1} style={styles.statValue}>
      {value}
    </Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const HouseCard = ({
  house,
  priceDraft,
  onChangePrice,
  onDelete,
  onOpen,
  onSavePrice,
}: {
  house: Listing;
  priceDraft: string;
  onChangePrice: (value: string) => void;
  onDelete: () => void;
  onOpen: () => void;
  onSavePrice: () => void;
}) => {
  const imageUrl = house.image_urls?.[0] ?? house.medium_url ?? house.xl_picture_url;

  return (
    <View style={styles.houseCard}>
      <TouchableOpacity activeOpacity={0.88} onPress={onOpen}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.houseImage} />
        ) : (
          <View style={[styles.houseImage, styles.emptyImage]}>
            <Ionicons name="image-outline" size={30} color={Colors.grey} />
          </View>
        )}
        <View style={[styles.statusPill, getListingStatusStyle(house.status)]}>
          <Text style={styles.statusPillText}>{house.status ?? 'pending'}</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.houseBody}>
        <Text numberOfLines={1} style={styles.houseTitle}>
          {house.name}
        </Text>
        <Text style={styles.houseMeta}>
          {house.smart_location ?? 'No address'} {house.category_title ? `· ${house.category_title}` : ''}
        </Text>
        <Text style={styles.houseMeta}>{house.room_type ?? 'Home'}</Text>

        <View style={styles.priceEditor}>
          <View style={styles.priceField}>
            <Text style={styles.inputLabel}>Nightly price</Text>
            <TextInput
              keyboardType="decimal-pad"
              onChangeText={onChangePrice}
              placeholder="0"
              placeholderTextColor="#888"
              style={styles.priceInput}
              value={priceDraft}
            />
          </View>
          <TouchableOpacity style={styles.savePriceButton} onPress={onSavePrice}>
            <Text style={styles.savePriceText}>Save</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.houseActions}>
          <TouchableOpacity style={styles.secondaryAction} onPress={onOpen}>
            <Ionicons name="eye-outline" size={18} color={Colors.dark} />
            <Text style={styles.secondaryActionText}>View</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteAction} onPress={onDelete}>
            <Ionicons name="trash-outline" size={18} color="#b42318" />
            <Text style={styles.deleteActionText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const ReservationCard = ({
  reservation,
  isCompleted,
  onAccept,
  onCancel,
}: {
  reservation: HostReservation;
  isCompleted: boolean;
  onAccept: () => void;
  onCancel: () => void;
}) => {
  const statusLabel = isCompleted ? 'completed' : reservation.status === 'paid' ? 'accepted' : reservation.status;
  const canCancelAcceptedReservation =
    (reservation.status === 'accepted' || reservation.status === 'paid') && !isCompleted;

  return (
    <View style={styles.reservationCard}>
      <View style={styles.reservationMain}>
        <View style={styles.guestAvatar}>
          <Ionicons name="person-outline" size={20} color={Colors.dark} />
        </View>
        <View style={styles.reservationInfo}>
          <Text numberOfLines={1} style={styles.guestName}>
            {reservation.guest_name ?? reservation.guest_email ?? 'Guest'}
          </Text>
          <Text numberOfLines={1} style={styles.reservationHouse}>
            {reservation.listing_name ?? 'House'}
          </Text>
          <Text style={styles.reservationDates}>
            {formatDate(reservation.check_in)} → {formatDate(reservation.check_out)}
          </Text>
          <Text style={styles.reservationGuests}>{formatGuests(reservation)}</Text>
          <Text style={styles.reservationPrice}>{formatMoney(reservation.total_price)}</Text>
        </View>
      </View>

      <View style={styles.reservationActions}>
        <View style={[styles.reservationStatus, getReservationStatusStyle(reservation.status)]}>
          <Text style={styles.reservationStatusText}>{statusLabel}</Text>
        </View>
        {reservation.status === 'pending' ? (
          <View style={styles.iconActions}>
            <TouchableOpacity style={[styles.iconAction, styles.acceptIcon]} onPress={onAccept}>
              <Ionicons name="checkmark" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.iconAction, styles.cancelIcon]} onPress={onCancel}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : canCancelAcceptedReservation ? (
          <TouchableOpacity style={[styles.iconAction, styles.cancelIcon]} onPress={onCancel}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

const PaginationControls = ({
  page,
  pageCount,
  onPrevious,
  onNext,
}: {
  page: number;
  pageCount: number;
  onPrevious: () => void;
  onNext: () => void;
}) => {
  const isFirstPage = page <= 1;
  const isLastPage = page >= pageCount;

  return (
    <View style={styles.paginationCard}>
      <TouchableOpacity
        disabled={isFirstPage}
        onPress={onPrevious}
        style={[styles.paginationButton, isFirstPage && styles.paginationButtonDisabled]}>
        <Ionicons name="chevron-back" size={18} color={isFirstPage ? '#a8a8a8' : Colors.dark} />
        <Text style={[styles.paginationButtonText, isFirstPage && styles.paginationButtonTextDisabled]}>
          Prev
        </Text>
      </TouchableOpacity>

      <Text style={styles.paginationPageText}>
        Page {page} / {pageCount}
      </Text>

      <TouchableOpacity
        disabled={isLastPage}
        onPress={onNext}
        style={[styles.paginationButton, isLastPage && styles.paginationButtonDisabled]}>
        <Text style={[styles.paginationButtonText, isLastPage && styles.paginationButtonTextDisabled]}>
          Next
        </Text>
        <Ionicons name="chevron-forward" size={18} color={isLastPage ? '#a8a8a8' : Colors.dark} />
      </TouchableOpacity>
    </View>
  );
};

const getListingStatusStyle = (status?: Listing['status']) => {
  if (status === 'accepted') {
    return styles.acceptedPill;
  }

  if (status === 'rejected') {
    return styles.rejectedPill;
  }

  return styles.pendingPill;
};

const getReservationStatusStyle = (status: HostReservation['status']) => {
  if (status === 'accepted' || status === 'paid') {
    return styles.acceptedReservation;
  }

  if (status === 'cancelled') {
    return styles.cancelledReservation;
  }

  return styles.pendingReservation;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    gap: 18,
    padding: 18,
    paddingBottom: 42,
  },
  hero: {
    gap: 8,
  },
  title: {
    color: Colors.dark,
    fontFamily: 'mon-b',
    fontSize: 28,
  },
  subtitle: {
    color: Colors.grey,
    fontFamily: 'mon',
    fontSize: 14,
    lineHeight: 21,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: '#fff5f7',
    gap: 6,
    padding: 12,
  },
  statValue: {
    color: Colors.dark,
    fontFamily: 'mon-b',
    fontSize: 18,
  },
  statLabel: {
    color: Colors.grey,
    fontFamily: 'mon',
    fontSize: 12,
  },
  sectionHeader: {
    gap: 4,
    marginTop: 4,
  },
  sectionTitle: {
    color: Colors.dark,
    fontFamily: 'mon-b',
    fontSize: 21,
  },
  sectionSubtitle: {
    color: Colors.grey,
    fontFamily: 'mon',
    fontSize: 13,
    lineHeight: 19,
  },
  loadingText: {
    color: Colors.grey,
    fontFamily: 'mon-sb',
    textAlign: 'center',
  },
  houseList: {
    gap: 14,
  },
  houseCard: {
    borderColor: '#e0e0e0',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  houseImage: {
    backgroundColor: '#f2f2f2',
    height: 180,
    width: '100%',
  },
  emptyImage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPill: {
    borderRadius: 999,
    left: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    position: 'absolute',
    top: 12,
  },
  pendingPill: {
    backgroundColor: '#B7791F',
  },
  acceptedPill: {
    backgroundColor: '#0A7F39',
  },
  rejectedPill: {
    backgroundColor: '#B42318',
  },
  statusPillText: {
    color: '#fff',
    fontFamily: 'mon-b',
    fontSize: 12,
    textTransform: 'capitalize',
  },
  houseBody: {
    gap: 9,
    padding: 14,
  },
  houseTitle: {
    color: Colors.dark,
    fontFamily: 'mon-b',
    fontSize: 18,
  },
  houseMeta: {
    color: Colors.grey,
    fontFamily: 'mon',
    fontSize: 13,
  },
  priceEditor: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  priceField: {
    flex: 1,
    gap: 6,
  },
  inputLabel: {
    color: Colors.dark,
    fontFamily: 'mon-sb',
    fontSize: 12,
  },
  priceInput: {
    ...defaultStyles.inputField,
    color: Colors.dark,
    fontFamily: 'mon-sb',
  },
  savePriceButton: {
    alignItems: 'center',
    backgroundColor: Colors.dark,
    borderRadius: 12,
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  savePriceText: {
    color: '#fff',
    fontFamily: 'mon-b',
  },
  houseActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  secondaryAction: {
    alignItems: 'center',
    backgroundColor: '#f4f4f4',
    borderRadius: 12,
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    height: 44,
    justifyContent: 'center',
  },
  secondaryActionText: {
    color: Colors.dark,
    fontFamily: 'mon-b',
  },
  deleteAction: {
    alignItems: 'center',
    backgroundColor: '#fff1f1',
    borderRadius: 12,
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    height: 44,
    justifyContent: 'center',
  },
  deleteActionText: {
    color: '#b42318',
    fontFamily: 'mon-b',
  },
  reservationList: {
    gap: 12,
  },
  paginationSummary: {
    color: Colors.grey,
    fontFamily: 'mon-sb',
    fontSize: 12,
    textAlign: 'right',
  },
  reservationCard: {
    alignItems: 'center',
    borderColor: '#e1e1e1',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    padding: 14,
  },
  reservationMain: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  guestAvatar: {
    alignItems: 'center',
    backgroundColor: '#f2f2f2',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  reservationInfo: {
    flex: 1,
    gap: 3,
  },
  guestName: {
    color: Colors.dark,
    fontFamily: 'mon-b',
    fontSize: 15,
  },
  reservationHouse: {
    color: Colors.dark,
    fontFamily: 'mon-sb',
    fontSize: 13,
  },
  reservationDates: {
    color: Colors.grey,
    fontFamily: 'mon',
    fontSize: 12,
  },
  reservationGuests: {
    color: Colors.grey,
    fontFamily: 'mon',
    fontSize: 12,
  },
  reservationPrice: {
    color: Colors.dark,
    fontFamily: 'mon-b',
    fontSize: 13,
  },
  reservationActions: {
    alignItems: 'flex-end',
    gap: 9,
  },
  reservationStatus: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pendingReservation: {
    backgroundColor: '#fff7e6',
  },
  acceptedReservation: {
    backgroundColor: '#e8f7ee',
  },
  cancelledReservation: {
    backgroundColor: '#fdecec',
  },
  reservationStatusText: {
    color: Colors.dark,
    fontFamily: 'mon-b',
    fontSize: 11,
    textTransform: 'capitalize',
  },
  iconActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconAction: {
    alignItems: 'center',
    borderRadius: 19,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  acceptIcon: {
    backgroundColor: '#0a7f39',
  },
  cancelIcon: {
    backgroundColor: '#b42318',
  },
  paginationCard: {
    alignItems: 'center',
    backgroundColor: '#fafafa',
    borderColor: '#e4e4e4',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    padding: 10,
  },
  paginationButton: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 4,
    minWidth: 92,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  paginationButtonDisabled: {
    backgroundColor: '#f0f0f0',
  },
  paginationButtonText: {
    color: Colors.dark,
    fontFamily: 'mon-b',
    fontSize: 12,
  },
  paginationButtonTextDisabled: {
    color: '#a8a8a8',
  },
  paginationPageText: {
    color: Colors.dark,
    flex: 1,
    fontFamily: 'mon-b',
    fontSize: 12,
    textAlign: 'center',
  },
  chartCard: {
    borderColor: '#e0e0e0',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 14,
    padding: 14,
  },
  monthHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  monthButton: {
    alignItems: 'center',
    backgroundColor: '#f3f3f3',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  monthTitle: {
    color: Colors.dark,
    fontFamily: 'mon-b',
    fontSize: 18,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weekDay: {
    color: Colors.grey,
    fontFamily: 'mon-b',
    fontSize: 12,
    textAlign: 'center',
    width: '13.2%',
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  dayCell: {
    alignItems: 'center',
    aspectRatio: 1,
    backgroundColor: '#f6f6f6',
    borderRadius: 12,
    justifyContent: 'center',
    width: '13.2%',
  },
  placeholderDay: {
    backgroundColor: 'transparent',
  },
  reservedDay: {
    backgroundColor: Colors.primary,
  },
  dayText: {
    color: Colors.dark,
    fontFamily: 'mon-sb',
    fontSize: 12,
  },
  reservedDayText: {
    color: '#fff',
  },
  chartEmpty: {
    color: Colors.grey,
    fontFamily: 'mon',
    textAlign: 'center',
  },
  chartReservations: {
    borderTopColor: '#e5e5e5',
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
    paddingTop: 12,
  },
  chartReservationRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  chartDot: {
    backgroundColor: Colors.primary,
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  chartReservationText: {
    flex: 1,
    gap: 2,
  },
  chartReservationTitle: {
    color: Colors.dark,
    fontFamily: 'mon-b',
  },
  chartReservationMeta: {
    color: Colors.grey,
    fontFamily: 'mon',
    fontSize: 12,
  },
  chartPrice: {
    color: Colors.dark,
    fontFamily: 'mon-b',
    fontSize: 13,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#fafafa',
    borderColor: '#e6e6e6',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
    padding: 20,
  },
  addHouseButton: {
    alignSelf: 'stretch',
    marginTop: 8,
  },
  centered: {
    alignItems: 'center',
    backgroundColor: '#fff',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  emptyTitle: {
    color: Colors.dark,
    fontFamily: 'mon-b',
    fontSize: 18,
  },
  emptyText: {
    color: Colors.grey,
    fontFamily: 'mon',
    lineHeight: 20,
    textAlign: 'center',
  },
});
