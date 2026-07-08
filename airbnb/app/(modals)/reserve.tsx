import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '@clerk/clerk-expo';
import Colors from '@/constants/Colors';
import { defaultStyles } from '@/constants/Styles';
import {
  BookingDateRange,
  getListingById,
  getUnavailableDateRanges,
  Listing,
} from '@/lib/database/listings';

const MS_PER_DAY = 86400000;

const dateToIso = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const parseIsoDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const addDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

const addMonths = (date: Date, months: number) =>
  new Date(date.getFullYear(), date.getMonth() + months, 1);

const getNightCount = (checkIn: string, checkOut: string | null) => {
  if (!checkOut) {
    return 0;
  }

  const diff = parseIsoDate(checkOut).getTime() - parseIsoDate(checkIn).getTime();

  if (!Number.isFinite(diff) || diff <= 0) {
    return 0;
  }

  return Math.round(diff / MS_PER_DAY);
};

const formatShortDate = (value: string | null) => {
  if (!value) {
    return 'Select date';
  }

  return parseIsoDate(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

const getMonthLabel = (date: Date) =>
  date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

const buildUnavailableNightSet = (ranges: BookingDateRange[]) => {
  const unavailable = new Set<string>();

  ranges.forEach((range) => {
    let cursor = parseIsoDate(range.check_in);
    const end = parseIsoDate(range.check_out);

    while (cursor < end) {
      unavailable.add(dateToIso(cursor));
      cursor = addDays(cursor, 1);
    }
  });

  return unavailable;
};

const rangeHasUnavailableNight = (checkIn: string, checkOut: string, unavailable: Set<string>) => {
  let cursor = parseIsoDate(checkIn);
  const end = parseIsoDate(checkOut);

  while (cursor < end) {
    if (unavailable.has(dateToIso(cursor))) {
      return true;
    }

    cursor = addDays(cursor, 1);
  }

  return false;
};

const findNextAvailableCheckIn = (fromIso: string, unavailable: Set<string>) => {
  let cursor = parseIsoDate(fromIso);

  for (let index = 0; index < 365; index += 1) {
    const iso = dateToIso(cursor);

    if (!unavailable.has(iso)) {
      return iso;
    }

    cursor = addDays(cursor, 1);
  }

  return fromIso;
};

const getCalendarDays = (monthDate: Date) => {
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const days: Array<string | null> = Array.from({ length: firstDay.getDay() }, () => null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push(dateToIso(new Date(monthDate.getFullYear(), monthDate.getMonth(), day)));
  }

  return days;
};

const ReservePage = () => {
  const router = useRouter();
  const { user } = useUser();
  const { listingId: listingIdParam } = useLocalSearchParams();
  const listingId = Array.isArray(listingIdParam) ? listingIdParam[0] : listingIdParam;
  const todayIso = useMemo(() => dateToIso(new Date()), []);
  const [listing, setListing] = useState<Listing | null>(null);
  const [unavailableRanges, setUnavailableRanges] = useState<BookingDateRange[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [checkIn, setCheckIn] = useState(todayIso);
  const [checkOut, setCheckOut] = useState<string | null>(null);
  const [activeDateField, setActiveDateField] = useState<'checkIn' | 'checkOut'>('checkOut');
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = parseIsoDate(todayIso);
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [dateMessage, setDateMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadReservationData = async () => {
      if (!listingId) {
        setIsLoading(false);
        return;
      }

      const [nextListing, nextUnavailableRanges] = await Promise.all([
        getListingById(listingId),
        getUnavailableDateRanges(listingId),
      ]);

      if (!isMounted) {
        return;
      }

      const unavailable = buildUnavailableNightSet(nextUnavailableRanges);
      const nextCheckIn = findNextAvailableCheckIn(todayIso, unavailable);

      setListing(nextListing);
      setUnavailableRanges(nextUnavailableRanges);
      setCheckIn(nextCheckIn);
      setCheckOut(null);
      setActiveDateField('checkOut');
      setVisibleMonth(new Date(parseIsoDate(nextCheckIn).getFullYear(), parseIsoDate(nextCheckIn).getMonth(), 1));
      setIsLoading(false);
    };

    loadReservationData().catch((error) => {
      console.error('Failed to load listing for reservation', error);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [listingId, todayIso]);

  const unavailableNightSet = useMemo(
    () => buildUnavailableNightSet(unavailableRanges),
    [unavailableRanges]
  );
  const calendarDays = useMemo(() => getCalendarDays(visibleMonth), [visibleMonth]);
  const nightlyPrice = Number(listing?.price ?? 0);
  const nights = getNightCount(checkIn, checkOut);
  const totalPrice = nightlyPrice * nights;
  const canPay = Boolean(checkOut) && nights > 0;

  const isSelectableDate = (iso: string) => {
    if (iso < todayIso) {
      return false;
    }

    if (activeDateField === 'checkIn') {
      return !unavailableNightSet.has(iso);
    }

    if (iso === checkIn) {
      return false;
    }

    if (iso < checkIn) {
      return !unavailableNightSet.has(iso);
    }

    return !rangeHasUnavailableNight(checkIn, iso, unavailableNightSet);
  };

  const onSelectDate = (iso: string) => {
    setDateMessage('');

    if (activeDateField === 'checkIn') {
      if (iso < todayIso || unavailableNightSet.has(iso)) {
        setDateMessage('This check-in date is unavailable.');
        return;
      }

      setCheckIn(iso);
      setCheckOut(null);
      setActiveDateField('checkOut');
      setVisibleMonth(new Date(parseIsoDate(iso).getFullYear(), parseIsoDate(iso).getMonth(), 1));
      return;
    }

    if (iso <= checkIn) {
      if (iso < todayIso || unavailableNightSet.has(iso)) {
        setDateMessage('This date is unavailable.');
        return;
      }

      setCheckIn(iso);
      setCheckOut(null);
      setActiveDateField('checkOut');
      setVisibleMonth(new Date(parseIsoDate(iso).getFullYear(), parseIsoDate(iso).getMonth(), 1));
      return;
    }

    if (rangeHasUnavailableNight(checkIn, iso, unavailableNightSet)) {
      setDateMessage('This range includes reserved dates. Please choose another checkout date.');
      return;
    }

    setCheckOut(iso);
    setActiveDateField('checkIn');
  };

  const onPay = () => {
    if (!user?.id) {
      Alert.alert('Login required', 'Please log in before reserving this home.');
      return;
    }

    if (!listing || !listingId) {
      Alert.alert('Listing unavailable', 'Please try again from the listing page.');
      return;
    }

    if (!checkOut || nights <= 0) {
      Alert.alert('Select dates', 'Please choose a check-in and check-out date.');
      return;
    }

    if (rangeHasUnavailableNight(checkIn, checkOut, unavailableNightSet)) {
      Alert.alert('Dates unavailable', 'This date range includes reserved dates.');
      return;
    }

    router.push({
      pathname: '/(modals)/payment',
      params: {
        listingId,
        checkIn,
        checkOut,
        adults: String(adults),
        children: String(children),
        infants: String(infants),
        totalPrice: String(totalPrice),
        nights: String(nights),
      },
    });
  };

  const changeAdults = (delta: number) => setAdults((value) => Math.max(1, value + delta));
  const changeChildren = (delta: number) => setChildren((value) => Math.max(0, value + delta));
  const changeInfants = (delta: number) => setInfants((value) => Math.max(0, value + delta));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <Stack.Screen options={{ title: 'Reserve' }} />

      {isLoading ? (
        <Text style={styles.loading}>Loading reservation...</Text>
      ) : (
        <>
          <View style={styles.hero}>
            <Text style={styles.title}>{listing?.name ?? 'Reservation'}</Text>
            <Text style={styles.subtitle}>
              ${nightlyPrice} night - {listing?.smart_location ?? 'Selected home'}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Guests</Text>
            <GuestRow
              title="Adults"
              subtitle="Ages 13 or above"
              value={adults}
              onMinus={() => changeAdults(-1)}
              onPlus={() => changeAdults(1)}
              minusDisabled={adults <= 1}
            />
            <GuestRow
              title="Children"
              subtitle="Ages 2-12"
              value={children}
              onMinus={() => changeChildren(-1)}
              onPlus={() => changeChildren(1)}
              minusDisabled={children <= 0}
            />
            <GuestRow
              title="Infants"
              subtitle="Under 2"
              value={infants}
              onMinus={() => changeInfants(-1)}
              onPlus={() => changeInfants(1)}
              minusDisabled={infants <= 0}
            />
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Dates</Text>
              <Text style={styles.sectionSubtitle}>Reserved dates are disabled until the host cancels them.</Text>
            </View>

            <View style={styles.dateTabs}>
              <TouchableOpacity
                style={[styles.dateTab, activeDateField === 'checkIn' && styles.dateTabActive]}
                onPress={() => setActiveDateField('checkIn')}>
                <Text style={styles.dateLabel}>Check-in</Text>
                <Text style={styles.dateValue}>{formatShortDate(checkIn)}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dateTab, activeDateField === 'checkOut' && styles.dateTabActive]}
                onPress={() => setActiveDateField('checkOut')}>
                <Text style={styles.dateLabel}>Check-out</Text>
                <Text style={styles.dateValue}>{formatShortDate(checkOut)}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.calendarCard}>
              <View style={styles.monthHeader}>
                <TouchableOpacity style={styles.monthButton} onPress={() => setVisibleMonth((date) => addMonths(date, -1))}>
                  <Ionicons name="chevron-back" size={22} color={Colors.dark} />
                </TouchableOpacity>
                <Text style={styles.monthTitle}>{getMonthLabel(visibleMonth)}</Text>
                <TouchableOpacity style={styles.monthButton} onPress={() => setVisibleMonth((date) => addMonths(date, 1))}>
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
                {calendarDays.map((iso, index) => {
                  if (!iso) {
                    return <View key={`empty-${index}`} style={styles.dayCell} />;
                  }

                  const isSelectedStart = iso === checkIn;
                  const isSelectedEnd = iso === checkOut;
                  const isInRange = Boolean(checkOut && iso > checkIn && iso < checkOut);
                  const isUnavailable = unavailableNightSet.has(iso);
                  const isDisabled = !isSelectableDate(iso);
                  const isToday = iso === todayIso;

                  return (
                    <TouchableOpacity
                      key={iso}
                      activeOpacity={0.78}
                      disabled={isDisabled}
                      onPress={() => onSelectDate(iso)}
                      style={[
                        styles.dayCell,
                        isToday && styles.todayCell,
                        isInRange && styles.rangeCell,
                        isSelectedStart && styles.selectedDay,
                        isSelectedEnd && styles.selectedDay,
                        isUnavailable && !isSelectedStart && !isSelectedEnd && !isInRange && styles.unavailableDay,
                        isDisabled && styles.disabledDay,
                      ]}>
                      <Text
                        style={[
                          styles.dayText,
                          isToday && styles.todayText,
                          isInRange && styles.rangeText,
                          (isSelectedStart || isSelectedEnd) && styles.selectedDayText,
                          isUnavailable && !isSelectedStart && !isSelectedEnd && !isInRange && styles.unavailableDayText,
                          isDisabled && styles.disabledDayText,
                        ]}>
                        {parseIsoDate(iso).getDate()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.legendRow}>
                <LegendDot color={Colors.primary} label="Selected" />
                <LegendDot color="#ffe5eb" label="In range" />
                <LegendDot color="#eeeeee" label="Unavailable" />
              </View>
            </View>

            {dateMessage ? <Text style={styles.dateMessage}>{dateMessage}</Text> : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Price details</Text>
            <PriceRow
              label={canPay ? `$${nightlyPrice} x ${nights} night${nights > 1 ? 's' : ''}` : 'Select checkout date'}
              value={canPay ? `$${totalPrice}` : '$0'}
            />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>${totalPrice}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[defaultStyles.btn, styles.payButton, !canPay && styles.disabledButton]}
            disabled={!canPay}
            onPress={onPay}>
            <Text style={defaultStyles.btnText}>Pay</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
};

const GuestRow = ({
  title,
  subtitle,
  value,
  onMinus,
  onPlus,
  minusDisabled,
}: {
  title: string;
  subtitle: string;
  value: number;
  onMinus: () => void;
  onPlus: () => void;
  minusDisabled: boolean;
}) => (
  <View style={styles.guestRow}>
    <View>
      <Text style={styles.guestTitle}>{title}</Text>
      <Text style={styles.guestSubtitle}>{subtitle}</Text>
    </View>
    <View style={styles.counter}>
      <TouchableOpacity onPress={onMinus} disabled={minusDisabled}>
        <Ionicons name="remove-circle-outline" size={28} color={minusDisabled ? '#d0d0d0' : Colors.grey} />
      </TouchableOpacity>
      <Text style={styles.counterText}>{value}</Text>
      <TouchableOpacity onPress={onPlus}>
        <Ionicons name="add-circle-outline" size={28} color={Colors.grey} />
      </TouchableOpacity>
    </View>
  </View>
);

const PriceRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.priceRow}>
    <Text style={styles.priceLabel}>{label}</Text>
    <Text style={styles.priceValue}>{value}</Text>
  </View>
);

const LegendDot = ({ color, label }: { color: string; label: string }) => (
  <View style={styles.legendItem}>
    <View style={[styles.legendDot, { backgroundColor: color }]} />
    <Text style={styles.legendText}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
    gap: 18,
    paddingBottom: 40,
  },
  loading: {
    fontFamily: 'mon-sb',
    textAlign: 'center',
    color: Colors.dark,
  },
  hero: {
    gap: 6,
  },
  title: {
    fontFamily: 'mon-b',
    fontSize: 24,
    color: Colors.dark,
  },
  subtitle: {
    fontFamily: 'mon',
    color: Colors.grey,
  },
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e1e1e1',
    gap: 14,
    backgroundColor: '#fff',
  },
  sectionHeader: {
    gap: 4,
  },
  sectionTitle: {
    fontFamily: 'mon-b',
    fontSize: 18,
    color: Colors.dark,
  },
  sectionSubtitle: {
    fontFamily: 'mon',
    color: Colors.grey,
    fontSize: 12,
    lineHeight: 18,
  },
  guestRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 8,
  },
  guestTitle: {
    fontFamily: 'mon-sb',
    color: Colors.dark,
  },
  guestSubtitle: {
    fontFamily: 'mon',
    color: Colors.grey,
  },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  counterText: {
    minWidth: 22,
    textAlign: 'center',
    fontFamily: 'mon-sb',
    fontSize: 16,
    color: Colors.dark,
    fontVariant: ['tabular-nums'],
  },
  dateTabs: {
    flexDirection: 'row',
    gap: 10,
  },
  dateTab: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dedede',
    gap: 4,
  },
  dateTabActive: {
    borderColor: Colors.primary,
    backgroundColor: '#fff4f6',
  },
  dateLabel: {
    fontFamily: 'mon',
    color: Colors.grey,
    fontSize: 12,
  },
  dateValue: {
    fontFamily: 'mon-sb',
    color: Colors.dark,
  },
  calendarCard: {
    borderRadius: 18,
    backgroundColor: '#fafafa',
    gap: 12,
    padding: 12,
  },
  monthHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  monthButton: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  monthTitle: {
    color: Colors.dark,
    fontFamily: 'mon-b',
    fontSize: 17,
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
    borderRadius: 13,
    justifyContent: 'center',
    width: '13.2%',
  },
  todayCell: {
    borderColor: Colors.dark,
    borderWidth: StyleSheet.hairlineWidth,
  },
  selectedDay: {
    backgroundColor: Colors.primary,
  },
  rangeCell: {
    backgroundColor: '#ffe5eb',
  },
  unavailableDay: {
    backgroundColor: '#eeeeee',
  },
  disabledDay: {
    opacity: 0.5,
  },
  dayText: {
    color: Colors.dark,
    fontFamily: 'mon-sb',
    fontSize: 13,
  },
  todayText: {
    color: Colors.dark,
  },
  selectedDayText: {
    color: '#fff',
    fontFamily: 'mon-b',
  },
  rangeText: {
    color: Colors.primary,
  },
  unavailableDayText: {
    color: Colors.grey,
    textDecorationLine: 'line-through',
  },
  disabledDayText: {
    color: Colors.grey,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  legendDot: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  legendText: {
    color: Colors.grey,
    fontFamily: 'mon',
    fontSize: 12,
  },
  dateMessage: {
    color: Colors.primary,
    fontFamily: 'mon-sb',
    lineHeight: 20,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  priceLabel: {
    flex: 1,
    fontFamily: 'mon',
    color: Colors.dark,
  },
  priceValue: {
    fontFamily: 'mon-sb',
    color: Colors.dark,
  },
  totalRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#dddddd',
    paddingTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalLabel: {
    fontFamily: 'mon-b',
    fontSize: 18,
    color: Colors.dark,
  },
  totalValue: {
    fontFamily: 'mon-b',
    fontSize: 18,
    color: Colors.dark,
  },
  payButton: {
    marginTop: 4,
  },
  disabledButton: {
    opacity: 0.55,
  },
});

export default ReservePage;
