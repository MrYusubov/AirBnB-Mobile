import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '@clerk/clerk-expo';
import Colors from '@/constants/Colors';
import { defaultStyles } from '@/constants/Styles';
import { getListingById, Listing } from '@/lib/database/listings';
// @ts-ignore
import DatePicker from 'react-native-modern-datepicker';

const dateToIso = (date: Date) => date.toISOString().slice(0, 10);
const pickerToIso = (value: string) => value.replace(/\//g, '-');
const isoToPicker = (value: string) => value.replace(/-/g, '/');

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const getNightCount = (checkIn: string, checkOut: string) => {
  const start = new Date(`${checkIn}T00:00:00`);
  const end = new Date(`${checkOut}T00:00:00`);
  const diff = end.getTime() - start.getTime();

  if (!Number.isFinite(diff) || diff <= 0) {
    return 1;
  }

  return Math.max(1, Math.round(diff / 86400000));
};

const ReservePage = () => {
  const router = useRouter();
  const { user } = useUser();
  const { listingId: listingIdParam } = useLocalSearchParams();
  const listingId = Array.isArray(listingIdParam) ? listingIdParam[0] : listingIdParam;
  const today = useMemo(() => new Date(), []);
  const [listing, setListing] = useState<Listing | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [checkIn, setCheckIn] = useState(dateToIso(today));
  const [checkOut, setCheckOut] = useState(dateToIso(addDays(today, 1)));
  const [activeDateField, setActiveDateField] = useState<'checkIn' | 'checkOut'>('checkIn');

  useEffect(() => {
    let isMounted = true;

    const loadListing = async () => {
      if (!listingId) {
        setIsLoading(false);
        return;
      }

      const nextListing = await getListingById(listingId);

      if (isMounted) {
        setListing(nextListing);
        setIsLoading(false);
      }
    };

    loadListing().catch((error) => {
      console.error('Failed to load listing for reservation', error);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [listingId]);

  const nightlyPrice = Number(listing?.price ?? 0);
  const nights = getNightCount(checkIn, checkOut);
  const totalPrice = nightlyPrice * nights;

  const onSelectDate = (value: string) => {
    const nextIso = pickerToIso(value);

    if (activeDateField === 'checkIn') {
      const nextCheckout = new Date(`${checkOut}T00:00:00`) <= new Date(`${nextIso}T00:00:00`)
        ? dateToIso(addDays(new Date(`${nextIso}T00:00:00`), 1))
        : checkOut;

      setCheckIn(nextIso);
      setCheckOut(nextCheckout);
      setActiveDateField('checkOut');
      return;
    }

    if (new Date(`${nextIso}T00:00:00`) <= new Date(`${checkIn}T00:00:00`)) {
      Alert.alert('Choose a later date', 'Check-out must be after check-in.');
      return;
    }

    setCheckOut(nextIso);
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

    router.push({
      pathname: '/(modals)/payment',
      params: {
        listingId,
        checkIn,
        checkOut,
        adults: String(adults),
        children: String(children),
        totalPrice: String(totalPrice),
        nights: String(nights),
      },
    });
  };

  const changeAdults = (delta: number) => setAdults((value) => Math.max(1, value + delta));
  const changeChildren = (delta: number) => setChildren((value) => Math.max(0, value + delta));

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
              EUR {nightlyPrice} night - {listing?.smart_location ?? 'Selected home'}
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
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Dates</Text>
            <View style={styles.dateTabs}>
              <TouchableOpacity
                style={[styles.dateTab, activeDateField === 'checkIn' && styles.dateTabActive]}
                onPress={() => setActiveDateField('checkIn')}>
                <Text style={styles.dateLabel}>Check-in</Text>
                <Text style={styles.dateValue}>{checkIn}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dateTab, activeDateField === 'checkOut' && styles.dateTabActive]}
                onPress={() => setActiveDateField('checkOut')}>
                <Text style={styles.dateLabel}>Check-out</Text>
                <Text style={styles.dateValue}>{checkOut}</Text>
              </TouchableOpacity>
            </View>

            <DatePicker
              options={{
                defaultFont: 'mon',
                headerFont: 'mon-sb',
                mainColor: Colors.primary,
                borderColor: 'transparent',
              }}
              current={isoToPicker(checkIn)}
              selected={activeDateField === 'checkIn' ? isoToPicker(checkIn) : isoToPicker(checkOut)}
              isGregorian
              mode="calendar"
              onSelectedChange={onSelectDate}
              onDateChange={onSelectDate}
              onMonthYearChange={() => {}}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Price details</Text>
            <PriceRow label={`EUR ${nightlyPrice} x ${nights} night${nights > 1 ? 's' : ''}`} value={`EUR ${totalPrice}`} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>EUR {totalPrice}</Text>
            </View>
          </View>

          <TouchableOpacity style={[defaultStyles.btn, styles.payButton]} onPress={onPay}>
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
  sectionTitle: {
    fontFamily: 'mon-b',
    fontSize: 18,
    color: Colors.dark,
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
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
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
});

export default ReservePage;
