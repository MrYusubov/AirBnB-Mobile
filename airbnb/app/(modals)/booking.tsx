import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { defaultStyles } from '@/constants/Styles';
import Colors from '@/constants/Colors';

const asString = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value ?? '');

const Page = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ search?: string; guests?: string }>();
  const initialGuests = Math.max(0, Number(asString(params.guests)) || 0);
  const [searchQuery, setSearchQuery] = useState(asString(params.search));
  const [adults, setAdults] = useState(initialGuests);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);

  const totalGuests = adults + children + infants;

  const submitSearch = (nextQuery = searchQuery) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    router.dismissTo({
      pathname: '/',
      params: {
        search: nextQuery.trim(),
        guests: String(totalGuests),
      },
    });
  };

  const clearSearch = () => {
    setSearchQuery('');
    setAdults(0);
    setChildren(0);
    setInfants(0);

    router.dismissTo({
      pathname: '/',
      params: {
        search: '',
        guests: '0',
      },
    });
  };

  return (
    <BlurView intensity={72} style={styles.container} tint="light">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.card}>
            <Text style={styles.cardHeader}>Search homes</Text>
            <Text style={styles.cardSubtitle}>
              Search by home name, address, or city.
            </Text>

            <View style={styles.searchSection}>
              <Ionicons style={styles.searchIcon} name="search" size={20} color={Colors.dark} />
              <TextInput
                autoCapitalize="words"
                autoCorrect={false}
                onChangeText={setSearchQuery}
                onSubmitEditing={() => submitSearch()}
                placeholder="Search home, address, or city..."
                placeholderTextColor={Colors.grey}
                returnKeyType="search"
                style={styles.inputField}
                value={searchQuery}
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearInputButton}>
                  <Ionicons name="close-circle" size={21} color={Colors.grey} />
                </TouchableOpacity>
              ) : null}
            </View>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(130)} style={styles.card}>
            <Text style={styles.sectionTitle}>Who's coming?</Text>
            <GuestCounter
              title="Adults"
              subtitle="Ages 13 or above"
              value={adults}
              onMinus={() => setAdults((value) => Math.max(0, value - 1))}
              onPlus={() => setAdults((value) => value + 1)}
            />
            <GuestCounter
              title="Children"
              subtitle="Ages 2-12"
              value={children}
              onMinus={() => setChildren((value) => Math.max(0, value - 1))}
              onPlus={() => setChildren((value) => value + 1)}
            />
            <GuestCounter
              title="Infants"
              subtitle="Under 2"
              value={infants}
              onMinus={() => setInfants((value) => Math.max(0, value - 1))}
              onPlus={() => setInfants((value) => value + 1)}
            />
          </Animated.View>
        </ScrollView>

        <Animated.View style={defaultStyles.footer} entering={SlideInDown.delay(200)}>
          <View style={styles.footerContent}>
            <TouchableOpacity style={styles.clearButton} onPress={clearSearch}>
              <Text style={styles.clearText}>Clear all</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[defaultStyles.btn, styles.searchButton]}
              onPress={() => submitSearch()}>
              <Ionicons
                name="search-outline"
                size={24}
                style={defaultStyles.btnIcon}
                color="#fff"
              />
              <Text style={defaultStyles.btnText}>Search</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </BlurView>
  );
};

const GuestCounter = ({
  title,
  subtitle,
  value,
  onMinus,
  onPlus,
}: {
  title: string;
  subtitle: string;
  value: number;
  onMinus: () => void;
  onPlus: () => void;
}) => (
  <View style={styles.guestItem}>
    <View>
      <Text style={styles.guestTitle}>{title}</Text>
      <Text style={styles.guestSubtitle}>{subtitle}</Text>
    </View>

    <View style={styles.counter}>
      <TouchableOpacity onPress={onMinus} disabled={value <= 0}>
        <Ionicons
          name="remove-circle-outline"
          size={28}
          color={value > 0 ? Colors.grey : '#cdcdcd'}
        />
      </TouchableOpacity>
      <Text style={styles.counterValue}>{value}</Text>
      <TouchableOpacity onPress={onPlus}>
        <Ionicons name="add-circle-outline" size={28} color={Colors.grey} />
      </TouchableOpacity>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    gap: 12,
    paddingTop: 100,
    paddingHorizontal: 10,
    paddingBottom: 110,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    gap: 14,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: {
      width: 2,
      height: 2,
    },
  },
  cardHeader: {
    color: Colors.dark,
    fontFamily: 'mon-b',
    fontSize: 25,
  },
  cardSubtitle: {
    color: Colors.grey,
    fontFamily: 'mon',
    lineHeight: 20,
  },
  searchSection: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ABABAB',
    borderRadius: 16,
  },
  searchIcon: {
    paddingLeft: 14,
    paddingRight: 8,
  },
  inputField: {
    flex: 1,
    color: Colors.dark,
    fontFamily: 'mon-sb',
    fontSize: 15,
    paddingVertical: 12,
  },
  clearInputButton: {
    padding: 12,
  },
  sectionTitle: {
    color: Colors.dark,
    fontFamily: 'mon-b',
    fontSize: 18,
  },
  guestItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  guestTitle: {
    color: Colors.dark,
    fontFamily: 'mon-sb',
    fontSize: 15,
  },
  guestSubtitle: {
    color: Colors.grey,
    fontFamily: 'mon',
    fontSize: 13,
    marginTop: 3,
  },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  counterValue: {
    color: Colors.dark,
    fontFamily: 'mon-sb',
    fontSize: 16,
    minWidth: 20,
    textAlign: 'center',
  },
  footerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clearButton: {
    height: '100%',
    justifyContent: 'center',
  },
  clearText: {
    color: Colors.dark,
    fontSize: 18,
    fontFamily: 'mon-sb',
    textDecorationLine: 'underline',
  },
  searchButton: {
    paddingRight: 20,
    paddingLeft: 50,
  },
});

export default Page;
