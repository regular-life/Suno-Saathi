import { useState, useEffect } from 'react';
import { 
  IconArrowBack, 
  IconMicrophone,
  IconFocus,
  IconVolume,
  IconVolumeOff
} from '@tabler/icons-react';
import classes from './navigation-mode.module.scss';
import { useNavigationStore } from '@/navigation/navigation-store';
import { voiceService } from '@/voice/voice-service';
import { MapContainer } from '@/map/map';
import { FocusMode } from './focus-mode';

// Helper functions imported from focus-mode
const formatDistance = (distance: { text: string; value: number }) => distance.text;

const getInstructionText = (instruction: string) => {
  if (!instruction) return "Continue";
  
  const cleanText = instruction.replace(/<[^>]+>/g, '');
  
  if (cleanText.includes("right")) {
    return "Take a right";
  } else if (cleanText.includes("left")) {
    return "Take a left";
  } else if (cleanText.includes("Continue")) {
    return "Continue Straight";
  } else if (cleanText.includes("Merge")) {
    return "Merge";
  } else if (cleanText.includes("Exit")) {
    return "Take exit";
  } else if (cleanText.includes("Stay")) {
    return "Stay on the same road";
  } else {
    return "Continue";
  }
};

const getNextManeuverIcon = (type: string | null | undefined) => {
  if (!type) return <IconArrowBack className={classes.rotateUp} size={24} color="black" />;
  
  switch (type) {
    case 'turn-right':
    case 'turn-slight-right':
    case 'turn-sharp-right':
      return <IconArrowBack className={classes.rotateRight} size={24} color="black" />;
    case 'turn-left':
    case 'turn-slight-left':
    case 'turn-sharp-left':
      return <IconArrowBack className={classes.rotateLeft} size={24} color="black" />;
    default:
      return <IconArrowBack className={classes.rotateUp} size={24} color="black" />;
  }
};

// Format time to compact version
const formatCompactTime = (timeString: string) => {
  const hourMatch = timeString.match(/(\d+)\s+hour/);
  const minMatch = timeString.match(/(\d+)\s+min/);
  
  const hours = hourMatch ? hourMatch[1] : '0';
  const mins = minMatch ? minMatch[1] : '0';
  
  if (parseInt(hours) > 0) {
    return `${hours}h${mins}`;
  } else {
    return `${mins}m`;
  }
};

// Calculate bearing between two coordinates
const calculateBearing = (startLat: number, startLng: number, destLat: number, destLng: number) => {
  startLat = startLat * Math.PI / 180;
  startLng = startLng * Math.PI / 180;
  destLat = destLat * Math.PI / 180;
  destLng = destLng * Math.PI / 180;

  const y = Math.sin(destLng - startLng) * Math.cos(destLat);
  const x = Math.cos(startLat) * Math.sin(destLat) -
            Math.sin(startLat) * Math.cos(destLat) * Math.cos(destLng - startLng);
  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  if (bearing < 0) {
    bearing += 360;
  }
  return bearing;
};

// Get the route-based heading for the current navigation step
const getRouteHeading = (position: GeolocationPosition) => {
  if (!currentRoute || !currentRoute.legs || !currentRoute.legs[0] || !currentRoute.legs[0].steps) {
    return null;
  }

  // Get current step and next step
  const steps = currentRoute.legs[0].steps;
  const currentLeg = steps[currentStep];

  // If we're at the last step, use the endpoint
  if (currentStep >= steps.length - 1) {
    const endLoc = currentRoute.legs[0].end_location;
    return calculateBearing(
      position.coords.latitude,
      position.coords.longitude,
      endLoc.lat,
      endLoc.lng
    );
  }

  // Otherwise use the next step's start location
  const nextLeg = steps[currentStep + 1];
  return calculateBearing(
    position.coords.latitude,
    position.coords.longitude,
    nextLeg.start_location.lat,
    nextLeg.start_location.lng
  );
};

export function NavigationMode() {
  const [isListening, setIsListening] = useState(false);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const [userPosition, setUserPosition] = useState<GeolocationPosition | null>(null);
  const [userHeading, setUserHeading] = useState<number | null>(null);
  const [showFocusMode, setShowFocusMode] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  
  const { 
    isNavigating, 
    currentRoute, 
    currentStep, 
    incrementStep, 
    endNavigation,
    setMapInstance: storeSetMapInstance
  } = useNavigationStore();

  // Set up geolocation watching
  useEffect(() => {
    // Only set up geolocation if we're navigating and not in focus mode
    if (!isNavigating || !currentRoute || showFocusMode) {
      return;
    }
    
    let watchId: number | null = null;
    
    // Watch position with high accuracy
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          setUserPosition(position);
          
          // Update map center
          if (mapInstance) {
            const userLatLng = new google.maps.LatLng(
              position.coords.latitude,
              position.coords.longitude
            );
            
            // Always center on user location
            mapInstance.setCenter(userLatLng);
            
            // Set zoom level to high for navigation (closer view)
            mapInstance.setZoom(19);
            
            // Determine heading - first try from route, then from device
            let heading = getRouteHeading(position);
            
            // If route heading isn't available, try device heading as fallback
            if (heading === null && position.coords.heading !== null && position.coords.heading !== undefined) {
              heading = position.coords.heading;
            }
            
            // Apply heading if available
            if (heading !== null) {
              setUserHeading(heading);
              mapInstance.setHeading(heading);
              // Add tilt for 3D-like perspective
              mapInstance.setTilt(60);
            }
          }
        },
        (error) => {
          console.error('Error getting geolocation:', error);
        },
        { 
          enableHighAccuracy: true, 
          maximumAge: 0,
          timeout: 5000 
        }
      );
    }
    
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [mapInstance, isNavigating, currentRoute, currentStep, showFocusMode]);

  // Save map instance to store and local state
  const handleMapLoaded = (map: google.maps.Map) => {
    setMapInstance(map);
    storeSetMapInstance(map);
    
    // Set initial map options for navigation-style view
    map.setOptions({
      zoom: 19,
      mapTypeId: google.maps.MapTypeId.ROADMAP,
      tilt: 60,
      mapTypeControl: false,
      fullscreenControl: false,
      streetViewControl: false,
      rotateControl: false,
      zoomControl: false,
      scaleControl: false
    });
    
    // Enable navigation mode specific settings
    map.setOptions({
      heading: 0, // Will be updated with route or geolocation
      rotateControl: true,
      tilt: 60
    });
    
    // Try to get current position immediately to set up the map
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLatLng = new google.maps.LatLng(
            position.coords.latitude,
            position.coords.longitude
          );
          
          map.setCenter(userLatLng);
          
          // Try to get initial heading from route if available
          if (currentRoute && currentRoute.legs && currentRoute.legs[0]?.steps) {
            const initialHeading = getRouteHeading(position);
            if (initialHeading !== null) {
              map.setHeading(initialHeading);
            }
          }
        },
        (error) => {
          console.error('Error getting initial position:', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        }
      );
    }
  };
  
  // Exit navigation
  const handleExitNavigation = () => {
    endNavigation();
  };
  
  // Toggle volume
  const toggleVolume = () => {
    const muted = voiceService.toggleMute();
    setIsMuted(muted);
    setStatusMessage(muted ? "Voice muted" : "Voice unmuted");
    
    // Clear status message after 3 seconds
    setTimeout(() => {
      setStatusMessage(null);
    }, 3000);
  };
  
  // Switch to focus mode
  const switchToFocusMode = () => {
    setShowFocusMode(true);
  };

  // Start voice input
  const startVoiceInput = () => {
    if (isListening) {
      voiceService.stopListening();
      setIsListening(false);
      return;
    }

    setIsListening(true);
    
    voiceService.startListening().then(transcript => {
      console.log('Voice input:', transcript);
      
      // Process voice commands
      if (transcript.toLowerCase().includes('exit') || transcript.toLowerCase().includes('stop')) {
        endNavigation();
      } else if (transcript.toLowerCase().includes('next')) {
        incrementStep();
      } else if (transcript.toLowerCase().includes('focus mode') || transcript.toLowerCase().includes('focus')) {
        switchToFocusMode();
      }
      setIsListening(false);
    }).catch(error => {
      console.error('Error processing voice input:', error);
      setIsListening(false);
    });
  };

  // Check if we should render this component
  if (!isNavigating || !currentRoute) {
    return null;
  }

  // If focus mode is active, show the focused navigation view
  if (showFocusMode) {
    return <FocusMode onExit={() => setShowFocusMode(false)} onBack={() => endNavigation()} onSwitchToMap={() => setShowFocusMode(false)} />;
  }
  
  // Get current and next maneuver data
  const currentManeuver = currentRoute.legs[0]?.steps[currentStep] || null;
  const nextManeuver = currentRoute.legs[0]?.steps[currentStep + 1] || null;
  
  // Estimated time left based on the route data
  const estimatedTimeLeft = currentRoute.legs[0]?.duration.text || '';
  const compactTimeLeft = formatCompactTime(estimatedTimeLeft);

  return (
    <div className={classes.navigationMode}>
      {/* Header with back button, ETA, and volume control */}
      <div className={classes.header}>
        <button className={classes.headerButton} onClick={handleExitNavigation}>
          <IconArrowBack size={20} />
        </button>
        
        <div className={classes.etaDisplay}>
          ETA: <strong>{compactTimeLeft}</strong>
        </div>
        
        <button 
          className={classes.headerButton}
          onClick={toggleVolume}
        >
          {isMuted ? <IconVolumeOff size={20} /> : <IconVolume size={20} />}
        </button>
      </div>
      
      {/* Main map view */}
      <div className={classes.mapFullscreen}>
        <MapContainer onMapLoaded={handleMapLoaded} hideSearch={true} />
        
        {/* Status message overlay (when active) */}
        {statusMessage && (
          <div className={classes.statusMessage}>
            {statusMessage}
          </div>
        )}
      </div>

      {/* Footer with next direction and controls */}
      <div className={classes.footer}>
        {/* Next maneuver info */}
        {nextManeuver ? (
          <div className={classes.nextManeuver}>
            <div className={classes.nextManeuverIcon}>
              <span className={classes.nextLabel}>Next:</span>
              {getNextManeuverIcon(nextManeuver.maneuver)}
            </div>
            
            <div className={classes.nextManeuverText}>
              {getInstructionText(nextManeuver.html_instructions)}
            </div>
            
            <div className={classes.nextManeuverDistance}>
              {formatDistance(nextManeuver.distance)}
            </div>
          </div>
        ) : (
          <div className={classes.arrivingText}>
            Arriving at destination
          </div>
        )}
        
        {/* Control buttons */}
        <div className={classes.controls}>
          <button 
            className={classes.focusModeButton}
            onClick={switchToFocusMode}
            title="Switch to Focus Mode"
          >
            <IconFocus size={24} />
          </button>
          
          <button 
            className={`${classes.micButton} ${isListening ? classes.active : ''}`}
            onClick={startVoiceInput}
          >
            <IconMicrophone size={24} />
          </button>
        </div>
        
        {/* Hint text */}
        <div className={classes.hintText}>
          Say "Hey Saarthi" to activate voice assistant
        </div>
      </div>
    </div>
  );
}