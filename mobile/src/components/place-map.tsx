import MapView, { Marker, PROVIDER_DEFAULT, type Region } from 'react-native-maps';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface MapPlace {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  rating: number | null;
}

export interface PlaceMapProps {
  places: MapPlace[];
  selectedId: string | null;
  region: Region | null;
  onSelect: (placeId: string) => void;
  onRegionChangeComplete?: (region: Region) => void;
}

/**
 * Native map with rating pins (Explore). Selecting a pin reports the place id
 * up so the detail sheet can update. Uses react-native-maps, which only runs
 * on native — the `.web` twin renders a graceful fallback.
 */
export function PlaceMap({
  places,
  selectedId,
  region,
  onSelect,
  onRegionChangeComplete,
}: PlaceMapProps) {
  const theme = useTheme();

  return (
    <View style={styles.fill}>
      <MapView
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        region={region ?? undefined}
        onRegionChangeComplete={onRegionChangeComplete}
        showsUserLocation
        showsMyLocationButton={false}
        toolbarEnabled={false}
      >
        {places.map((place) => {
          const selected = place.placeId === selectedId;
          return (
            <Marker
              key={place.placeId}
              coordinate={{ latitude: place.lat, longitude: place.lng }}
              onPress={() => onSelect(place.placeId)}
              tracksViewChanges={false}
              anchor={{ x: 0.5, y: 1 }}
            >
              <View
                style={[
                  styles.pin,
                  {
                    backgroundColor: selected ? theme.primary : theme.surfaceCard,
                    borderColor: selected ? theme.primary : theme.borderSubtle,
                  },
                ]}
              >
                {place.rating != null ? (
                  <ThemedText
                    type="smallBold"
                    style={{ color: selected ? theme.onPrimary : theme.text }}
                  >
                    ★ {place.rating.toFixed(1)}
                  </ThemedText>
                ) : (
                  <ThemedText
                    type="smallBold"
                    style={{ color: selected ? theme.onPrimary : theme.text }}
                  >
                    ◎
                  </ThemedText>
                )}
              </View>
              <View
                style={[styles.pinStem, { backgroundColor: selected ? theme.primary : theme.surfaceCard }]}
              />
            </Marker>
          );
        })}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  pin: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  pinStem: {
    width: 3,
    height: 8,
    alignSelf: 'center',
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
});
