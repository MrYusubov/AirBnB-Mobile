import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import MapView, { Region } from 'react-native-maps';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import { defaultStyles } from '@/constants/Styles';
import { addListing, Category, getCategories } from '@/lib/database/listings';
import { uploadImageToCloudinary } from '@/lib/cloudinary';

type AddressSuggestion = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

const initialRegion: Region = {
  latitude: 40.4093,
  longitude: 49.8671,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

const placeholderColor = '#5f5f5f';

export default function AddHousePage() {
  const router = useRouter();
  const { user } = useUser();
  const mapRef = useRef<MapView | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [roomType, setRoomType] = useState('Entire home');
  const [price, setPrice] = useState('');
  const [address, setAddress] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [beds, setBeds] = useState('');
  const [bathrooms, setBathrooms] = useState('');
  const [guests, setGuests] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [region, setRegion] = useState(initialRegion);
  const [images, setImages] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showsUserLocation, setShowsUserLocation] = useState(false);

  const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress ?? null;

  useEffect(() => {
    let isMounted = true;

    const loadCategories = async () => {
      const nextCategories = await getCategories();

      if (!isMounted) {
        return;
      }

      setCategories(nextCategories);
      setSelectedCategoryId((current) => current ?? nextCategories[0]?.id ?? null);
    };

    loadCategories().catch((error) => {
      console.error('Failed to load categories from SQLite', error);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const onPickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setImages(result.assets.map((asset) => asset.uri));
    }
  };

  const onSearchAddress = async () => {
    if (!address.trim()) {
      return;
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(address)}`
      );

      if (!response.ok) {
        throw new Error(`Address search failed: ${response.status}`);
      }

      const payload = (await response.json()) as AddressSuggestion[];
      setSuggestions(payload);
    } catch (error) {
      Alert.alert('Address search failed', error instanceof Error ? error.message : 'Try again');
    }
  };

  const onSelectSuggestion = (suggestion: AddressSuggestion) => {
    const latitude = Number(suggestion.lat);
    const longitude = Number(suggestion.lon);
    const nextRegion = {
      latitude,
      longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };

    setAddress(suggestion.display_name);
    setRegion(nextRegion);
    setSuggestions([]);
    mapRef.current?.animateToRegion(nextRegion, 350);
  };

  const onLocateMe = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert('Location permission needed', 'Please allow location access to use your current position.');
      return;
    }

    const location = await Location.getCurrentPositionAsync({});
    const nextRegion = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };

    setShowsUserLocation(true);
    setRegion(nextRegion);
    mapRef.current?.animateToRegion(nextRegion, 350);
  };

  const onSubmit = async () => {
    if (!user) {
      Alert.alert('Login required', 'Please log in before adding a house.');
      return;
    }

    if (!name.trim() || !description.trim() || !price.trim() || !address.trim() || !selectedCategoryId) {
      Alert.alert('Missing information', 'Please fill title, description, category, price and address.');
      return;
    }

    setIsSaving(true);

    try {
      const uploadedImages = [];

      for (const imageUri of images) {
        uploadedImages.push(await uploadImageToCloudinary(imageUri));
      }

      const imageUrls = uploadedImages.map((item) => item.secure_url);
      const publicIds = uploadedImages.map((item) => item.public_id);

      await addListing({
        name: name.trim(),
        description: description.trim(),
        category_id: selectedCategoryId,
        room_type: roomType.trim(),
        price: Number(price),
        smart_location: address.trim(),
        latitude: region.latitude,
        longitude: region.longitude,
        bedrooms: Number(bedrooms) || 0,
        beds: Number(beds) || 0,
        bathrooms: Number(bathrooms) || 0,
        guests_included: Number(guests) || 0,
        host_name: user.fullName ?? user.firstName ?? email ?? 'Host',
        owner_user_id: user.id,
        owner_email: email,
        status: 'pending',
        image_urls: imageUrls,
        cloudinary_public_ids: publicIds,
        medium_url: imageUrls[0],
        xl_picture_url: imageUrls[0],
        review_scores_rating: 0,
        number_of_reviews: 0,
      });

      Alert.alert('Submitted', 'Your house is pending admin review.');
      router.back();
    } catch (error) {
      Alert.alert('Could not add house', error instanceof Error ? error.message : 'Try again');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>House details</Text>
      <View style={styles.field}>
        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          placeholder="Cozy apartment near the city center"
          placeholderTextColor={placeholderColor}
          value={name}
          onChangeText={setName}
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Describe the house, rules and nearby places"
          placeholderTextColor={placeholderColor}
          value={description}
          onChangeText={setDescription}
          multiline
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Room type</Text>
        <TextInput
          style={styles.input}
          placeholder="Entire home, private room..."
          placeholderTextColor={placeholderColor}
          value={roomType}
          onChangeText={setRoomType}
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Category</Text>
        <View style={styles.categoryGrid}>
          {categories.map((category) => {
            const isSelected = selectedCategoryId === category.id;

            return (
              <TouchableOpacity
                key={category.id}
                style={[styles.categoryButton, isSelected && styles.categoryButtonSelected]}
                onPress={() => setSelectedCategoryId(category.id)}>
                <MaterialIcons
                  name={category.icon as any}
                  size={22}
                  color={isSelected ? Colors.primary : Colors.dark}
                />
                <Text style={[styles.categoryText, isSelected && styles.categoryTextSelected]}>
                  {category.title}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Price per night</Text>
        <TextInput
          style={styles.input}
          placeholder="120"
          placeholderTextColor={placeholderColor}
          value={price}
          onChangeText={setPrice}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.grid}>
        <View style={styles.gridField}>
          <Text style={styles.label}>Guests</Text>
          <TextInput
            style={styles.input}
            placeholder="2"
            placeholderTextColor={placeholderColor}
            value={guests}
            onChangeText={setGuests}
            keyboardType="numeric"
          />
        </View>
        <View style={styles.gridField}>
          <Text style={styles.label}>Bedrooms</Text>
          <TextInput
            style={styles.input}
            placeholder="1"
            placeholderTextColor={placeholderColor}
            value={bedrooms}
            onChangeText={setBedrooms}
            keyboardType="numeric"
          />
        </View>
        <View style={styles.gridField}>
          <Text style={styles.label}>Beds</Text>
          <TextInput
            style={styles.input}
            placeholder="1"
            placeholderTextColor={placeholderColor}
            value={beds}
            onChangeText={setBeds}
            keyboardType="numeric"
          />
        </View>
        <View style={styles.gridField}>
          <Text style={styles.label}>Bathrooms</Text>
          <TextInput
            style={styles.input}
            placeholder="1"
            placeholderTextColor={placeholderColor}
            value={bathrooms}
            onChangeText={setBathrooms}
            keyboardType="numeric"
          />
        </View>
      </View>

      <Text style={styles.sectionTitle}>Photos</Text>
      <TouchableOpacity style={styles.secondaryButton} onPress={onPickImages}>
        <Ionicons name="images-outline" size={20} color={Colors.dark} />
        <Text style={styles.secondaryButtonText}>Choose house photos</Text>
      </TouchableOpacity>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imageRow}>
        {images.map((uri) => (
          <Image key={uri} source={{ uri }} style={styles.previewImage} />
        ))}
      </ScrollView>

      <Text style={styles.sectionTitle}>Location</Text>
      <Text style={styles.label}>Address</Text>
      <View style={styles.addressRow}>
        <TextInput
          style={[styles.input, styles.addressInput]}
          placeholder="Search or write the full address"
          placeholderTextColor={placeholderColor}
          value={address}
          onChangeText={setAddress}
        />
        <TouchableOpacity style={styles.findButton} onPress={onSearchAddress}>
          <Ionicons name="search" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
      {suggestions.map((suggestion) => (
        <TouchableOpacity key={suggestion.place_id} style={styles.suggestion} onPress={() => onSelectSuggestion(suggestion)}>
          <Text style={styles.suggestionText}>{suggestion.display_name}</Text>
        </TouchableOpacity>
      ))}
      <Text style={styles.mapHint}>Move the map until the pin is exactly over the house.</Text>
      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          region={region}
          showsUserLocation={showsUserLocation}
          onRegionChangeComplete={setRegion}
        />
        <View pointerEvents="none" style={styles.centerPin}>
          <Ionicons name="location-sharp" size={42} color={Colors.primary} />
        </View>
        <TouchableOpacity style={styles.locateButton} onPress={onLocateMe}>
          <Ionicons name="navigate" size={22} color={Colors.dark} />
        </TouchableOpacity>
      </View>
      <Text style={styles.coordinates}>
        Selected: {region.latitude.toFixed(5)}, {region.longitude.toFixed(5)}
      </Text>

      <TouchableOpacity style={[defaultStyles.btn, styles.submitButton]} onPress={onSubmit} disabled={isSaving}>
        <Text style={defaultStyles.btnText}>{isSaving ? 'Submitting...' : 'Submit for Review'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
    gap: 12,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontFamily: 'mon-b',
    fontSize: 18,
    marginTop: 10,
  },
  field: {
    gap: 6,
  },
  label: {
    fontFamily: 'mon-sb',
    fontSize: 14,
    color: Colors.dark,
  },
  input: {
    ...defaultStyles.inputField,
    fontFamily: 'mon',
    color: Colors.dark,
  },
  textArea: {
    height: 110,
    textAlignVertical: 'top',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridField: {
    width: '47%',
    flexGrow: 1,
    gap: 6,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryButton: {
    width: '47%',
    minHeight: 54,
    flexGrow: 1,
    borderWidth: 1,
    borderColor: '#dedede',
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
  },
  categoryButtonSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#fff4f6',
  },
  categoryText: {
    flex: 1,
    fontFamily: 'mon-sb',
    color: Colors.dark,
  },
  categoryTextSelected: {
    color: Colors.primary,
  },
  secondaryButton: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ABABAB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryButtonText: {
    fontFamily: 'mon-sb',
  },
  imageRow: {
    gap: 10,
  },
  previewImage: {
    width: 110,
    height: 90,
    borderRadius: 10,
    backgroundColor: '#eee',
  },
  addressRow: {
    flexDirection: 'row',
    gap: 8,
  },
  addressInput: {
    flex: 1,
  },
  findButton: {
    width: 48,
    borderRadius: 10,
    backgroundColor: Colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestion: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
  },
  suggestionText: {
    fontFamily: 'mon',
    color: Colors.dark,
  },
  mapHint: {
    fontFamily: 'mon',
    color: Colors.grey,
  },
  mapWrap: {
    height: 260,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#eee',
  },
  centerPin: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -21,
    marginTop: -42,
  },
  locateButton: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: {
      width: 0,
      height: 3,
    },
  },
  coordinates: {
    fontFamily: 'mon',
    color: Colors.grey,
    fontSize: 12,
  },
  submitButton: {
    marginTop: 10,
  },
});
