import { useState, useEffect } from 'react';
import { IconCar, IconWalk, IconBike, IconPlayerPlay, IconX, IconCurrentLocation, IconSearch, IconArrowLeft } from '@tabler/icons-react';
import classes from './navigation-panel.module.scss';
import { useNavigationStore, Marker } from './navigation-store';
import { useNavigationPlaces } from './navigation.query';
import { Route, RouteStep } from './navigation-store';
import { decode } from '@googlemaps/polyline-codec';

const formatDistance = (distance: { text: string; value: number }) => distance.text;
const formatDuration = (duration: { text: string; value: number }) => duration.text;

// Reusable search component
function SearchInput({ 
  value, 
  onChange, 
  placeholder, 
  onSelectPlace,
  showCurrentLocation = false,
  onCurrentLocationClick
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  onSelectPlace: (place: any) => void;
  showCurrentLocation?: boolean;
  onCurrentLocationClick?: () => void;
}) {
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async () => {
    if (!value.trim()) return;
    
    setIsLoading(true);
    setShowResults(true);
    
    try {
      const response = await useNavigationPlaces.apiCall({
        query: value,
        location: null
      });

      if (response && response.data && response.data.places) {
        setSearchResults(response.data.places);
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

  return (
    <div className={classes.searchContainer}>
      <div className={classes.inputGroup}>
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyPress={handleKeyPress}
          onFocus={() => searchResults.length > 0 && setShowResults(true)}
        />
        <button className={classes.searchButton} onClick={handleSearch}>
          <IconSearch size={18} />
        </button>
        {showCurrentLocation && (
          <button 
            className={classes.locationButton}
            onClick={onCurrentLocationClick}
            title="Use current location"
          >
            <IconCurrentLocation size={18} />
          </button>
        )}
      </div>
      
      {showResults && searchResults.length > 0 && (
        <div className={classes.searchResults}>
          {searchResults.map((place) => (
            <div 
              key={place.place_id} 
              className={classes.searchResultItem}
              onClick={() => {
                onSelectPlace(place);
                setShowResults(false);
              }}
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
  );
}

export function NavigationPanel({ onClose }: { onClose: () => void }) {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [originCoords, setOriginCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [destinationCoords, setDestinationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routePolyline, setRoutePolyline] = useState<google.maps.Polyline | null>(null);
  
  const {
    travelMode,
    setTravelMode,
    setOrigin: setStoreOrigin,
    setDestination: setStoreDestination,
    currentRoute,
    getDirections,
    startNavigation,
    isNavigating,
    currentStep,
    mapInstance,
    setMarkers,
    toggleSidebar
  } = useNavigationStore();

  // Use the provided onClose function directly instead of toggleSidebar
  const closeNavbar = () => {
    onClose();
  };

  // Sync local state with store
  useEffect(() => {
    setStoreOrigin(origin);
    setStoreDestination(destination);
  }, [origin, destination, setStoreOrigin, setStoreDestination]);

  // Clean up polyline when component unmounts or when we get new directions
  useEffect(() => {
    return () => {
      if (routePolyline) {
        routePolyline.setMap(null);
      }
    };
  }, [routePolyline]);

  const drawRoute = (route: Route) => {
    if (!mapInstance) return;

    // Remove existing polyline if any
    if (routePolyline) {
      routePolyline.setMap(null);
    }

    // Create a new polyline using the overview polyline
    const decodedPath = decode(route.overview_polyline.points);
    const path = decodedPath.map(([lat, lng]) => ({ lat, lng }));
    
    const polyline = new google.maps.Polyline({
      path: path,
      geodesic: true,
      strokeColor: '#4285F4',
      strokeOpacity: 1.0,
      strokeWeight: 5,
    });

    polyline.setMap(mapInstance);
    setRoutePolyline(polyline);

    // Fit map to show the entire route
    const bounds = new google.maps.LatLngBounds();
    polyline.getPath().forEach(point => bounds.extend(point));
    mapInstance.fitBounds(bounds);
  };

  const handleGetCurrentLocation = async () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        });
      });

      const { latitude, longitude } = position.coords;
      const location = { lat: latitude, lng: longitude };
      
      setOrigin('Current Location');
      setOriginCoords(location);
      setError(null);

      // Update markers to include current location
      const currentMarkers = useNavigationStore.getState().markers;
      const newMarkers = currentMarkers.filter((marker: Marker) => marker.id !== 'origin');
      newMarkers.push({
        id: 'origin',
        position: location,
        title: 'Current Location',
        color: '#4285F4', // Google Blue
        label: 'A'
      });
      setMarkers(newMarkers);

      // Center map on current location
      if (mapInstance) {
        mapInstance.setCenter(location);
        mapInstance.setZoom(15);
      }
    } catch (error: any) {
      console.error('Error getting current location:', error);
      if (error.code) {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setError('Location permission denied');
            break;
          case error.TIMEOUT:
            setError('Location request timed out');
            break;
          default:
            setError('Location service error');
        }
      } else setError('Could not get your current location');
    }
  };

  const handleSelectPlace = (place: any, isOrigin: boolean) => {
    const location = {
      lat: place.location.lat,
      lng: place.location.lng
    };

    if (isOrigin) {
      setOrigin(place.name);
      setOriginCoords(location);
      // Update markers to include both origin and destination
      const currentMarkers = useNavigationStore.getState().markers;
      const newMarkers = currentMarkers.filter((marker: Marker) => marker.id !== 'origin');
      newMarkers.push({
        id: 'origin',
        position: location,
        title: 'Origin: ' + place.name,
        color: '#4285F4', // Google Blue
        label: 'A'
      });
      setMarkers(newMarkers);
    } else {
      setDestination(place.name);
      setDestinationCoords(location);
      // Update markers to include both origin and destination
      const currentMarkers = useNavigationStore.getState().markers;
      const newMarkers = currentMarkers.filter((marker: Marker) => marker.id !== 'destination');
      newMarkers.push({
        id: 'destination',
        position: location,
        title: 'Destination: ' + place.name,
        color: '#EA4335', // Google Red
        label: 'B'
      });
      setMarkers(newMarkers);
    }

    // Center map on selected location
    if (mapInstance) {
      mapInstance.setCenter(location);
      mapInstance.setZoom(15);
    }
  };

  const handleGetDirections = async () => {
    if (!origin || !destination || !originCoords || !destinationCoords) {
      setError('Please enter both origin and destination');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const route = await getDirections({
        origin: `${originCoords.lat},${originCoords.lng}`,
        destination: `${destinationCoords.lat},${destinationCoords.lng}`
      });

      if (!route) {
        setError('Could not find a route between these locations');
      } else {
        drawRoute(route);
      }
    } catch (error) {
      console.error('Error getting directions:', error);
      setError('Could not get directions. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartNavigation = () => {
    if (!currentRoute) {
      setError('Please get directions first');
      return;
    }

    startNavigation(currentRoute);
    
    // After starting navigation, direct the app to focus mode
    // Give time for the navigation mode to render
    setTimeout(() => {
      // Look for the focus mode button by class name from module.scss
      const focusModeBtn = document.querySelector('[class*="focusModeButton"]') as HTMLButtonElement;
      if (focusModeBtn) {
        focusModeBtn.click();
      }
    }, 300);
  };

  return (
    <div className={classes.panel}>
      <div className={classes.form}>
        <SearchInput
          value={origin}
          onChange={setOrigin}
          placeholder="Starting point"
          onSelectPlace={(place) => handleSelectPlace(place, true)}
          showCurrentLocation={true}
          onCurrentLocationClick={handleGetCurrentLocation}
        />

        <SearchInput
          value={destination}
          onChange={setDestination}
          placeholder="Enter destination"
          onSelectPlace={(place) => handleSelectPlace(place, false)}
        />

        <div className={classes.travelModes}>
          <button
            className={`${classes.travelModeBtn} ${travelMode === 'driving' ? classes.active : ''}`}
            onClick={() => setTravelMode('driving')}
          >
            <IconCar size={20} />
            <span>Driving</span>
          </button>
          <button
            className={`${classes.travelModeBtn} ${travelMode === 'walking' ? classes.active : ''}`}
            onClick={() => setTravelMode('walking')}
          >
            <IconWalk size={20} />
            <span>Walking</span>
          </button>
          <button
            className={`${classes.travelModeBtn} ${travelMode === 'bicycling' ? classes.active : ''}`}
            onClick={() => setTravelMode('bicycling')}
          >
            <IconBike size={20} />
            <span>Cycling</span>
          </button>
        </div>

        {error && (
          <div className={classes.error}>
            {error}
          </div>
        )}

        {currentRoute && (
          <div className={classes.routeSummary}>
            <div className={classes.summaryItem}>
              <span>Distance:</span>
              <strong>{formatDistance(currentRoute.legs[0].distance)}</strong>
            </div>
            <div className={classes.summaryItem}>
              <span>Duration:</span>
              <strong>{formatDuration(currentRoute.legs[0].duration)}</strong>
            </div>
          </div>
        )}

        <div className={classes.directionsList}>
          {currentRoute && currentRoute.legs && currentRoute.legs[0]?.steps.map((step: RouteStep, index: number) => (
            <div 
              key={index} 
              className={`${classes.directionStep} ${isNavigating && index === currentStep ? classes.active : ''}`}
            >
              <div className={classes.stepNumber}>{index + 1}</div>
              <div 
                className={classes.stepInstruction}
                dangerouslySetInnerHTML={{ __html: step.html_instructions }}
              />
              {step.distance.value > 0 && (
                <div className={classes.stepDistance}>{formatDistance(step.distance)}</div>
              )}
            </div>
          ))}
        </div>

        {!currentRoute ? (
          <button 
            className={classes.actionButton} 
            onClick={handleGetDirections}
            disabled={isLoading || !origin || !destination}
          >
            {isLoading ? 'Loading...' : 'Get Directions'}
          </button>
        ) : (
          <button 
            className={classes.startNavigationBtn} 
            onClick={handleStartNavigation}
            disabled={isNavigating}
          >
            <IconPlayerPlay size={20} />
            {isNavigating ? 'Navigating...' : 'Start Navigation'}
          </button>
        )}
      </div>
    </div>
  );
} 