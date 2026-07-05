import { useRef, useState } from 'react';
import {
  Alert,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '@clerk/clerk-expo';
import Colors from '@/constants/Colors';
import { defaultStyles } from '@/constants/Styles';
import { createBooking, upsertUser } from '@/lib/database/listings';

const asString = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value ?? '');
const onlyDigits = (value: string) => value.replace(/\D/g, '');

const formatCardNumber = (value: string) =>
  onlyDigits(value)
    .slice(0, 16)
    .replace(/(.{4})/g, '$1 ')
    .trim();

const formatExpiry = (value: string) => {
  const digits = onlyDigits(value).slice(0, 4);

  if (digits.length <= 2) {
    return digits;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
};

const PaymentPage = () => {
  const router = useRouter();
  const { user } = useUser();
  const params = useLocalSearchParams();
  const scale = useRef(new Animated.Value(0.8)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [isPaying, setIsPaying] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const listingId = asString(params.listingId);
  const checkIn = asString(params.checkIn);
  const checkOut = asString(params.checkOut);
  const adults = Number(asString(params.adults)) || 1;
  const children = Number(asString(params.children)) || 0;
  const totalPrice = Number(asString(params.totalPrice)) || 0;
  const nights = Number(asString(params.nights)) || 1;

  const validateExpiry = () => {
    if (!/^\d{2}\/\d{2}$/.test(expiry)) {
      return false;
    }

    const month = Number(expiry.slice(0, 2));
    return month >= 1 && month <= 12;
  };

  const startSuccessAnimation = () => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const onPay = async () => {
    if (!user?.id) {
      Alert.alert('Login required', 'Please log in before completing payment.');
      return;
    }

    if (!listingId || !checkIn || !checkOut) {
      Alert.alert('Payment unavailable', 'Reservation details are missing.');
      return;
    }

    if (onlyDigits(cardNumber).length !== 16) {
      Alert.alert('Invalid card', 'Card number must contain exactly 16 digits.');
      return;
    }

    if (!validateExpiry()) {
      Alert.alert('Invalid expiry date', 'Expiry date must be in MM/YY format.');
      return;
    }

    if (onlyDigits(cvv).length !== 3) {
      Alert.alert('Invalid CVV', 'CVV must contain exactly 3 digits.');
      return;
    }

    setIsPaying(true);

    try {
      await upsertUser({
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null,
        first_name: user.firstName,
        last_name: user.lastName,
        image_url: user.imageUrl,
      });
      await createBooking({
        user_id: user.id,
        listing_id: listingId,
        check_in: checkIn,
        check_out: checkOut,
        adults,
        children,
        total_price: totalPrice,
        status: 'pending',
      });

      setIsSuccess(true);
      startSuccessAnimation();

      setTimeout(() => {
        router.replace('/');
      }, 3000);
    } catch (error) {
      Alert.alert('Payment failed', error instanceof Error ? error.message : 'Try again');
      setIsPaying(false);
    }
  };

  if (isSuccess) {
    return (
      <View style={styles.successContainer}>
        <Stack.Screen options={{ title: 'Request sent' }} />
        <Animated.View style={[styles.successIcon, { opacity, transform: [{ scale }] }]}>
          <Ionicons name="checkmark" size={58} color="#fff" />
        </Animated.View>
        <Text style={styles.successTitle}>Reservation request sent</Text>
        <Text style={styles.successText}>The host can now accept or cancel it. Taking you home...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <Stack.Screen options={{ title: 'Payment' }} />

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Reservation summary</Text>
        <SummaryRow label="Dates" value={`${checkIn} - ${checkOut}`} />
        <SummaryRow label="Guests" value={`${adults} adult${adults > 1 ? 's' : ''}, ${children} children`} />
        <SummaryRow label="Nights" value={String(nights)} />
        <View style={styles.summaryDivider} />
        <SummaryRow label="Total" value={`EUR ${totalPrice}`} strong />
      </View>

      <View style={styles.cardForm}>
        <Text style={styles.formTitle}>Fake payment card</Text>
        <View style={styles.field}>
          <Text style={styles.label}>Card number</Text>
          <TextInput
            style={styles.input}
            value={cardNumber}
            onChangeText={(value) => setCardNumber(formatCardNumber(value))}
            placeholder="1234 5678 9012 3456"
            placeholderTextColor={Colors.grey}
            keyboardType="number-pad"
            maxLength={19}
          />
        </View>

        <View style={styles.row}>
          <View style={styles.halfField}>
            <Text style={styles.label}>Expiry</Text>
            <TextInput
              style={styles.input}
              value={expiry}
              onChangeText={(value) => setExpiry(formatExpiry(value))}
              placeholder="MM/YY"
              placeholderTextColor={Colors.grey}
              keyboardType="number-pad"
              maxLength={5}
            />
          </View>
          <View style={styles.halfField}>
            <Text style={styles.label}>CVV</Text>
            <TextInput
              style={styles.input}
              value={cvv}
              onChangeText={(value) => setCvv(onlyDigits(value).slice(0, 3))}
              placeholder="123"
              placeholderTextColor={Colors.grey}
              keyboardType="number-pad"
              maxLength={3}
              secureTextEntry
            />
          </View>
        </View>
      </View>

      <TouchableOpacity style={[defaultStyles.btn, isPaying && styles.disabledButton]} disabled={isPaying} onPress={onPay}>
        <Text style={defaultStyles.btnText}>{isPaying ? 'Paying...' : `Pay EUR ${totalPrice}`}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const SummaryRow = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
  <View style={styles.summaryRow}>
    <Text style={[styles.summaryLabel, strong && styles.strongText]}>{label}</Text>
    <Text style={[styles.summaryValue, strong && styles.strongText]}>{value}</Text>
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
  summaryCard: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: '#f8f8f8',
    gap: 12,
  },
  summaryTitle: {
    fontFamily: 'mon-b',
    fontSize: 20,
    color: Colors.dark,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
  },
  summaryLabel: {
    fontFamily: 'mon',
    color: Colors.grey,
  },
  summaryValue: {
    fontFamily: 'mon-sb',
    color: Colors.dark,
    flexShrink: 1,
    textAlign: 'right',
  },
  summaryDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#d9d9d9',
  },
  strongText: {
    fontFamily: 'mon-b',
    fontSize: 17,
    color: Colors.dark,
  },
  cardForm: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e0e0e0',
    padding: 16,
    gap: 14,
  },
  formTitle: {
    fontFamily: 'mon-b',
    fontSize: 20,
    color: Colors.dark,
  },
  field: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfField: {
    flex: 1,
    gap: 6,
  },
  label: {
    fontFamily: 'mon-sb',
    color: Colors.dark,
  },
  input: {
    ...defaultStyles.inputField,
    fontFamily: 'mon',
    color: Colors.dark,
  },
  disabledButton: {
    opacity: 0.6,
  },
  successContainer: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 14,
  },
  successIcon: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#2fb344',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontFamily: 'mon-b',
    fontSize: 24,
    color: Colors.dark,
  },
  successText: {
    fontFamily: 'mon',
    color: Colors.grey,
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default PaymentPage;
