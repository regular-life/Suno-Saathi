import { useEffect, useRef, useState } from 'react';
import { APIProvider, Map, Marker, useMap, AdvancedMarker, useAdvancedMarkerRef } from '@vis.gl/react-google-maps';
import classes from './map.module.scss';
import { IconSearch } from '@tabler/icons-react';
import { DEFAULT_CENTER, DEFAULT_ZOOM } from '@/utils/constants';
import { useNavigationStore } from '@/navigation/navigation-store';
import { useNavigationPlaces, useNavigationGeocode } from '@/navigation/navigation.query';
import { voiceService } from '@/voice/voice-service';

// Function to decode Google Maps encoded polyline
function decode(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0, lat = 0, lng = 0;

  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

// Map component that handles the actual map instance and route display
function MapComponent() {
  const map = useMap();
  const { 
    setMapInstance, 
    markers, 
    currentRoute, 
    isNavigating,
    setMarkers,
    origin,
    destination,
    setDestination,
    getDirections,
    currentStep
  } = useNavigationStore();
  const polylineRef = useRef<google.maps.Polyline | null>(null);

  useEffect(() => {
    if (map) {
      setMapInstance(map);
    }
  }, [map, setMapInstance]);

  // Handle marker drag end event - updates location and recalculates route
  const handleMarkerDragEnd = async (markerId: string, newPosition: google.maps.LatLng) => {
    // Only process origin marker (user location)
    if (markerId !== 'origin') return;
    
    // Update the marker position in the store
    const updatedMarkers = markers.map(marker => {
      if (marker.id === markerId) {
        return {
          ...marker,
          position: { 
            lat: newPosition.lat(), 
            lng: newPosition.lng() 
          }
        };
      }
      return marker;
    });
    
    setMarkers(updatedMarkers);
    
    // Mock a position object for the navigation system
    const mockPosition = {
      coords: {
        latitude: newPosition.lat(),
        longitude: newPosition.lng(),
        accuracy: 5,
        heading: null,
        speed: null,
        altitude: null,
        altitudeAccuracy: null
      },
      timestamp: Date.now()
    };
    
    // If we have an active route and destination, recalculate the route
    if (destination && isNavigating && currentRoute) {
      // Get updated directions with the new origin
      await getDirections({
        origin: `${newPosition.lat()},${newPosition.lng()}`,
        destination: destination
      });
      
      // Create a custom event to notify the navigation system about the position change
      const positionUpdateEvent = new CustomEvent('userPositionChanged', {
        detail: { 
          position: mockPosition,
          newPosition: { lat: newPosition.lat(), lng: newPosition.lng() } 
        }
      });
      
      // Dispatch the event for other components to react to
      window.dispatchEvent(positionUpdateEvent);
    }
  };

  // Create and update the route polyline
  useEffect(() => {
    // Create path coordinates from polyline if available
    const pathCoordinates = currentRoute && isNavigating && currentRoute.overview_polyline
      ? decode(currentRoute.overview_polyline.points).map(([lat, lng]) => ({ lat, lng }))
      : [];

    // Remove previous polyline if exists
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    // Add new polyline if we have coordinates and map is available
    if (map && pathCoordinates.length > 0 && isNavigating) {
      polylineRef.current = new google.maps.Polyline({
        path: pathCoordinates,
        geodesic: true,
        strokeColor: '#4285F4',
        strokeOpacity: 0.8,
        strokeWeight: 5,
        map: map
      });

      // Fit the map to the route bounds
      if (currentRoute?.bounds) {
        const bounds = new google.maps.LatLngBounds(
          currentRoute.bounds.southwest,
          currentRoute.bounds.northeast
        );
        map.fitBounds(bounds);
      }
    }

    // Cleanup function
    return () => {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
      }
    };
  }, [map, currentRoute, isNavigating]);

  return (
    <>
      {markers.map((marker) => (
        <AdvancedMarker
          key={marker.id}
          position={marker.position}
          title={marker.title}
          draggable={marker.label === 'A'} // Make only user location draggable
          onDragEnd={
            marker.label === 'A' 
            ? (e: google.maps.MapMouseEvent) => 
                e.latLng && handleMarkerDragEnd(marker.id, e.latLng)
            : undefined
          }
        >
          <div
            style={{
              width: '24px',
              height: '24px',
              backgroundColor: marker.color || '#1a73e8',
              borderRadius: '50%',
              border: '2px solid white',
              boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '12px',
              cursor: marker.label === 'A' ? 'grab' : 'default'
            }}
          >
            {marker.label}
          </div>
        </AdvancedMarker>
      ))}
    </>
  );
}

// Main map container component
export function MapContainer({ hideSearch = false }: { hideSearch?: boolean }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [markerRef, marker] = useAdvancedMarkerRef();
  const { setMarkers, mapInstance, origin, destination, setDestination, getDirections, markers } = useNavigationStore();
  const geocodeApi = useNavigationGeocode.apiCall;

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsLoading(true);
    setShowResults(true);
    
    try {
      const response = await useNavigationPlaces.apiCall({
        query: searchQuery,
        location: null
      });

      const data = response.data;

      if (data && data.places) {
        // Log the response to see the data structure
        console.log('Places response:', data.places);
        setSearchResults(data.places);
      }
    } catch (error) {
      console.error('Error searching for places:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleSelectPlace = (place: any) => {
    setSearchQuery(place.name);
    setShowResults(false);
    setSelectedPlace(place);
    
    // Convert location to LatLng format if needed
    const location = {
      lat: place.location.lat,
      lng: place.location.lng
    };
    
    // Add marker for selected place
    setMarkers([{
      id: Date.now().toString(),
      position: location,
      title: place.name,
      color: '#1a73e8'
    }]);

    // Center map on selected location
    if (mapInstance) {
      mapInstance.setCenter(location);
      mapInstance.setZoom(15);
    }
  };

  // Handle destination change commands from voice assistant
  useEffect(() => {
    voiceService.setChangeDestinationCallback(async (dest: string) => {
      if (!dest || dest.trim() === '') {
        console.error('Empty destination received');
        return;
      }
      
      // Update destination in store
      setDestination(dest);
      console.log('Voice command: changing destination to', dest);

      // Create a safer notification that doesn't rely on DOM manipulation
      const showNotification = () => {
        if (!mapInstance) return;
        
        // Use an overlay div that already exists or create a temporary one
        let notificationContainer = document.getElementById('map-notifications');
        if (!notificationContainer) {
          notificationContainer = document.createElement('div');
          notificationContainer.id = 'map-notifications';
          notificationContainer.style.position = 'absolute';
          notificationContainer.style.top = '20px';
          notificationContainer.style.left = '50%';
          notificationContainer.style.transform = 'translateX(-50%)';
          notificationContainer.style.zIndex = '1000';
          document.body.appendChild(notificationContainer);
        }
        
        const notification = document.createElement('div');
        notification.innerText = `Changing destination to ${dest}...`;
        notification.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        notification.style.color = 'white';
        notification.style.padding = '10px 20px';
        notification.style.borderRadius = '4px';
        notification.style.marginBottom = '10px';
        notification.style.fontWeight = 'bold';
        notification.style.textAlign = 'center';
        
        notificationContainer.appendChild(notification);
        
        // Remove after 5 seconds
        setTimeout(() => {
          if (notificationContainer.contains(notification)) {
            notificationContainer.removeChild(notification);
          }
          // Clean up the container if empty
          if (notificationContainer.childNodes.length === 0) {
            document.body.removeChild(notificationContainer);
          }
        }, 5000);
      };
      
      showNotification();
      
      try {
        // Geocode the new destination
        const res = await geocodeApi({ address: dest });
        const data = res.data;
        
        if (data.status === 'OK' && data.results.length > 0) {
          const loc = data.results[0].geometry.location;
          
          // Get safe coordinates for the origin
          let originCoords = { lat: 0, lng: 0 };
          
          // Try to get coordinates from markers first
          const originMarker = markers.find(m => m.label === 'A');
          if (originMarker) {
            originCoords = { 
              lat: originMarker.position.lat, 
              lng: originMarker.position.lng 
            };
          }
          // Or try to parse from origin string
          else if (origin && origin.includes(',')) {
            const [lat, lng] = origin.split(',').map(Number);
            if (!isNaN(lat) && !isNaN(lng)) {
              originCoords = { lat, lng };
            }
          }
          // Fallback to map center
          else if (mapInstance) {
            const center = mapInstance.getCenter();
            if (center) {
              originCoords = {
                lat: center.lat(),
                lng: center.lng()
              };
            }
          }
          
          // Update markers
          setMarkers([
            { 
              id: 'origin', 
              position: originCoords, 
              title: 'Origin', 
              label: 'A' 
            },
            { 
              id: 'destination', 
              position: { lat: loc.lat, lng: loc.lng }, 
              title: dest, 
              label: 'B', 
              color: '#e91e63' 
            }
          ]);
          
          // Format origin string
          const formattedOrigin = `${originCoords.lat},${originCoords.lng}`;
          const formattedDestination = `${loc.lat},${loc.lng}`;
          
          console.log(`Getting directions from ${formattedOrigin} to ${formattedDestination}`);
          
          // Get directions
          await getDirections({
            origin: formattedOrigin,
            destination: formattedDestination
          });
          
          // Fit map to show the route
          if (mapInstance) {
            setTimeout(() => {
              const bounds = new google.maps.LatLngBounds();
              markers.forEach(marker => bounds.extend(marker.position));
              mapInstance.fitBounds(bounds, 20);
            }, 500); // Small delay to ensure markers are updated
          }
        } else {
          console.error('Could not geocode the destination:', dest);
        }
      } catch (e) {
        console.error('Error processing destination change:', e);
      }
    });
  }, [setDestination, setMarkers, origin, getDirections, markers, geocodeApi, mapInstance]);

  return (
    <div className={classes.map}>
      {!hideSearch && (
      <div className={classes.searchBar}>
        <input
          type="text"
          className={classes.searchInput}
          placeholder="Search for a location"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          onFocus={() => searchResults.length > 0 && setShowResults(true)}
        />
        <button className={classes.searchButton} onClick={handleSearch}>
          <IconSearch size={20} />
        </button>
        
        {showResults && searchResults.length > 0 && (
          <div className={classes.searchResults}>
            {searchResults.map((place) => (
              <div 
                key={place.place_id} 
                className={classes.searchResultItem}
                onClick={() => handleSelectPlace(place)}
              >
                <div className={classes.placeName}>{place.name}</div>
                <div className={classes.placeAddress}>
                  {place.address || place.vicinity || "Unknown Address"}
                </div>
              </div>
            ))}
          </div>
        )}
        
        {isLoading && (
          <div className={classes.searchLoading}>
            Loading results...
          </div>
        )}
      </div>
      )}

      <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
        <Map
          defaultCenter={DEFAULT_CENTER}
          defaultZoom={DEFAULT_ZOOM}
          gestureHandling={'greedy'}
          disableDefaultUI={false}
          mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_ID}
          mapTypeControl={false}
        >
          <MapComponent />
          {selectedPlace && (
            <AdvancedMarker
              ref={markerRef}
              position={{
                lat: selectedPlace.location.lat,
                lng: selectedPlace.location.lng
              }}
              title={selectedPlace.name}
            />
          )}
        </Map>
      </APIProvider>
    </div>
  );
} 