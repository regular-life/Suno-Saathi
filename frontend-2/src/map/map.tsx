import { useEffect, useRef, useState } from 'react';
import { APIProvider, Map, Marker, useMap, AdvancedMarker, useAdvancedMarkerRef } from '@vis.gl/react-google-maps';
import classes from './map.module.scss';
import { IconSearch } from '@tabler/icons-react';
import { DEFAULT_CENTER, DEFAULT_ZOOM } from '@/utils/constants';
import { useNavigationStore } from '@/navigation/navigation-store';
import { useNavigationPlaces } from '@/navigation/navigation.query';

// Map component that handles the actual map instance
function MapComponent() {
  const map = useMap();
  const { setMapInstance, markers } = useNavigationStore();

  useEffect(() => {
    if (map) {
      setMapInstance(map);
    }
  }, [map, setMapInstance]);

  return (
    <>
      {markers.map((marker) => (
        <AdvancedMarker
          key={marker.id}
          position={marker.position}
          title={marker.title}
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
              fontSize: '12px'
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
export function MapContainer() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [markerRef, marker] = useAdvancedMarkerRef();
  const { setMarkers, mapInstance } = useNavigationStore();

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

  return (
    <div className={classes.map}>
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

      <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
        <Map
          defaultCenter={DEFAULT_CENTER}
          defaultZoom={DEFAULT_ZOOM}
          gestureHandling={'greedy'}
          disableDefaultUI={false}
          mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_ID}
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