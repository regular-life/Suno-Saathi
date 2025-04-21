import { useState, useEffect, useRef, TouchEvent } from 'react';
import { 
  IconArrowBack, 
  IconMicrophone,
  IconFocus,
  IconVolume,
  IconVolumeOff,
  IconChevronUp,
  IconChevronDown,
  IconArrowNarrowUp,
  IconArrowNarrowLeft,
  IconArrowNarrowRight,
  IconPlayerPlay,
  IconPlayerPause
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
  const [showAllDirections, setShowAllDirections] = useState(false);
  const footerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationSpeed, setSimulationSpeed] = useState(1); // Speed multiplier
  const [isPaused, setIsPaused] = useState(false);
  const simulationInterval = useRef<number | null>(null);
  const simulationStepRef = useRef(0);
  const lastPositionRef = useRef<google.maps.LatLng | null>(null);
  const lastHeadingRef = useRef<number>(0);
  
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
    
    // Setup listener for custom position change events (from marker drag)
    const handlePositionChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { position, newPosition } = customEvent.detail;
      
      // Update user position state with the mock position
      setUserPosition(position);
      
      // Update map view if mapInstance is available
      if (mapInstance) {
        const userLatLng = new google.maps.LatLng(
          newPosition.lat,
          newPosition.lng
        );
        
        // Center on the new position
        mapInstance.setCenter(userLatLng);
        
        // Set navigation view settings
        mapInstance.setZoom(19);
        
        // Try to determine heading based on the route
        if (position) {
          const heading = getRouteHeading(position);
          
          if (heading !== null) {
            setUserHeading(heading);
            mapInstance.setHeading(heading);
            mapInstance.setTilt(60);
          }
        }
        
        // Create a LatLng object for metrics calculations
        const newPosLatLng = new google.maps.LatLng(newPosition.lat, newPosition.lng);
        
        // Recalculate ETA and distances based on new position
        recalculateRouteMetrics(newPosLatLng);
        
        // Check if we need to update the current navigation step
        updateNavigationStep(newPosLatLng);
      }
    };
    
    // Add event listener for custom position change event
    window.addEventListener('userPositionChanged', handlePositionChange);
    
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
      
      // Clean up event listener
      window.removeEventListener('userPositionChanged', handlePositionChange);
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

  // Handle touch start event
  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    touchStartY.current = e.touches[0].clientY;
  };
  
  // Handle touch move event
  const handleTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    if (touchStartY.current === null) return;
    
    const touchY = e.touches[0].clientY;
    const diff = touchStartY.current - touchY;
    
    // Swipe up to show directions
    if (diff > 50 && !showAllDirections) {
      setShowAllDirections(true);
      touchStartY.current = null;
    }
    
    // Swipe down to hide directions
    else if (diff < -50 && showAllDirections) {
      setShowAllDirections(false);
      touchStartY.current = null;
    }
  };
  
  // Handle touch end event
  const handleTouchEnd = () => {
    touchStartY.current = null;
  };

  // Simulation functions
  const moveForward = () => {
    if (!mapInstance) return;
    
    // Get current center and heading
    const center = mapInstance.getCenter();
    const heading = mapInstance.getHeading() || 0;
    
    if (!center) return;
    
    // Convert heading to radians
    const headingRad = (heading * Math.PI) / 180;
    
    // Calculate new position (move ~10 meters in the heading direction)
    // Earth radius in meters
    const earthRadius = 6378137;
    const distance = 10;
    
    const lat1 = center.lat() * Math.PI / 180;
    const lng1 = center.lng() * Math.PI / 180;
    
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(distance / earthRadius) +
      Math.cos(lat1) * Math.sin(distance / earthRadius) * Math.cos(headingRad)
    );
    
    const lng2 = lng1 + Math.atan2(
      Math.sin(headingRad) * Math.sin(distance / earthRadius) * Math.cos(lat1),
      Math.cos(distance / earthRadius) - Math.sin(lat1) * Math.sin(lat2)
    );
    
    // Convert back to degrees
    const newLat = lat2 * 180 / Math.PI;
    const newLng = lng2 * 180 / Math.PI;
    
    // Update map center
    const newCenter = new google.maps.LatLng(newLat, newLng);
    mapInstance.setCenter(newCenter);
    lastPositionRef.current = newCenter;
    
    // Create a mock position object to simulate GPS movement
    const mockPosition = {
      coords: {
        latitude: newLat,
        longitude: newLng,
        accuracy: 5,
        heading: heading,
        speed: 5,
        altitude: null,
        altitudeAccuracy: null
      },
      timestamp: Date.now()
    };
    
    // Update user position state as if this was from GPS
    setUserPosition(mockPosition as GeolocationPosition);
    
    // Update the origin marker position
    const { setMarkers, markers } = useNavigationStore.getState();
    const updatedMarkers = markers.map(marker => {
      if (marker.id === 'origin' || marker.label === 'A') {
        return {
          ...marker,
          position: { 
            lat: newLat, 
            lng: newLng 
          }
        };
      }
      return marker;
    });
    setMarkers(updatedMarkers);
    
    // Check if we need to advance to the next navigation step
    if (currentRoute && currentStep < currentRoute.legs[0].steps.length - 1) {
      // Get the end location of the current step
      const currentStepEnd = new google.maps.LatLng(
        currentRoute.legs[0].steps[currentStep].end_location.lat,
        currentRoute.legs[0].steps[currentStep].end_location.lng
      );
      
      // Calculate distance to the end of the current step
      const distanceToStepEnd = google.maps.geometry.spherical.computeDistanceBetween(
        newCenter,
        currentStepEnd
      );
      
      // If we're close to the end of the step, move to the next one
      if (distanceToStepEnd < 20) { // Within 20 meters
        incrementStep();
      }
      
      // Recalculate ETA and remaining distance
      recalculateRouteMetrics(newCenter);
    }
  };
  
  const turnLeft = () => {
    if (!mapInstance) return;
    
    // Get current heading and adjust by -30 degrees
    const heading = mapInstance.getHeading() || 0;
    const newHeading = (heading - 30) % 360;
    
    mapInstance.setHeading(newHeading);
    lastHeadingRef.current = newHeading;
    
    // If we have a current user position, update its heading
    if (userPosition) {
      const updatedPosition = {
        ...userPosition,
        coords: {
          ...userPosition.coords,
          heading: newHeading
        }
      };
      setUserPosition(updatedPosition);
      setUserHeading(newHeading);
    }
  };
  
  const turnRight = () => {
    if (!mapInstance) return;
    
    // Get current heading and adjust by +30 degrees
    const heading = mapInstance.getHeading() || 0;
    const newHeading = (heading + 30) % 360;
    
    mapInstance.setHeading(newHeading);
    lastHeadingRef.current = newHeading;
    
    // If we have a current user position, update its heading
    if (userPosition) {
      const updatedPosition = {
        ...userPosition,
        coords: {
          ...userPosition.coords,
          heading: newHeading
        }
      };
      setUserPosition(updatedPosition);
      setUserHeading(newHeading);
    }
  };
  
  // Helper function to recalculate ETA and distance based on current position
  const recalculateRouteMetrics = (currentPos: google.maps.LatLng) => {
    if (!currentRoute || !currentRoute.legs[0]) return;
    
    // Calculate remaining leg distance
    let totalRemainingDistance = 0;
    let totalRemainingDuration = 0;
    const steps = currentRoute.legs[0].steps;
    
    // We need to start from the current step and measure distance to each upcoming step
    for (let i = currentStep; i < steps.length; i++) {
      const stepDistance = steps[i].distance.value;
      const stepDuration = steps[i].duration.value;
      
      if (i === currentStep) {
        // For current step, calculate the actual remaining distance
        const stepEndPos = new google.maps.LatLng(
          steps[i].end_location.lat,
          steps[i].end_location.lng
        );
        
        const distanceToStepEnd = google.maps.geometry.spherical.computeDistanceBetween(
          currentPos,
          stepEndPos
        );
        
        // Add the partial remaining distance and time
        const completionRatio = 1 - (distanceToStepEnd / stepDistance);
        totalRemainingDistance += distanceToStepEnd;
        totalRemainingDuration += stepDuration * (1 - completionRatio);
      } else {
        // For future steps, add the full distance and duration
        totalRemainingDistance += stepDistance;
        totalRemainingDuration += stepDuration;
      }
    }
    
    // Update the remaining distance and time in the store
    const remainingDistanceText = formatDistanceValue(totalRemainingDistance);
    const remainingTimeText = formatDurationValue(totalRemainingDuration);
    
    // Update the navigation store
    useNavigationStore.setState({
      distanceRemaining: remainingDistanceText,
      timeRemaining: remainingTimeText
    });
  };
  
  // Helper function to format distance value (in meters) to text
  const formatDistanceValue = (meters: number) => {
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    } else {
      return `${(meters / 1000).toFixed(1)} km`;
    }
  };
  
  // Helper function to format duration value (in seconds) to text
  const formatDurationValue = (seconds: number) => {
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) {
      return `${minutes} min`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours} hr ${remainingMinutes} min`;
    }
  };
  
  const toggleSimulation = () => {
    setIsSimulating(!isSimulating);
    setIsPaused(false);
    
    // If turning simulation off, clear the interval
    if (isSimulating && simulationInterval.current) {
      window.clearInterval(simulationInterval.current);
      simulationInterval.current = null;
    }
  };
  
  const togglePause = () => {
    setIsPaused(!isPaused);
    
    if (!isPaused && simulationInterval.current) {
      // Pause by clearing the interval
      window.clearInterval(simulationInterval.current);
      simulationInterval.current = null;
    } else if (isPaused && isSimulating) {
      // Resume by starting a new interval
      startAutomaticSimulation();
    }
  };
  
  const changeSimulationSpeed = () => {
    // Toggle between 1x, 2x, and 3x speeds
    setSimulationSpeed((prevSpeed) => (prevSpeed % 3) + 1);
  };
  
  // Automatic simulation along the route
  useEffect(() => {
    if (isSimulating && !isPaused && currentRoute) {
      startAutomaticSimulation();
    }
    
    return () => {
      if (simulationInterval.current) {
        window.clearInterval(simulationInterval.current);
        simulationInterval.current = null;
      }
    };
  }, [isSimulating, isPaused, currentRoute, simulationSpeed]);
  
  const startAutomaticSimulation = () => {
    if (!currentRoute || !mapInstance) return;
    
    // Clear any existing interval
    if (simulationInterval.current) {
      window.clearInterval(simulationInterval.current);
    }
    
    // Decode the path from the route's overview polyline
    const decodedPath = decode(currentRoute.overview_polyline.points);
    const totalPoints = decodedPath.length;
    
    // Start from current position or beginning of route
    if (simulationStepRef.current === 0 && currentRoute.legs[0].start_location) {
      const startLoc = currentRoute.legs[0].start_location;
      mapInstance.setCenter({ lat: startLoc.lat, lng: startLoc.lng });
      mapInstance.setZoom(19);
      mapInstance.setTilt(60);
      
      // Also update the origin marker position to the start location
      const { setMarkers, markers } = useNavigationStore.getState();
      const updatedMarkers = markers.map(marker => {
        if (marker.id === 'origin' || marker.label === 'A') {
          return {
            ...marker,
            position: { 
              lat: startLoc.lat, 
              lng: startLoc.lng 
            }
          };
        }
        return marker;
      });
      setMarkers(updatedMarkers);
    }
    
    // Set interval to move along the path
    simulationInterval.current = window.setInterval(() => {
      if (simulationStepRef.current < totalPoints - 1) {
        // Move to the next point in the path
        const nextIndex = Math.min(simulationStepRef.current + 1, totalPoints - 1);
        const point = decodedPath[nextIndex];
        
        if (point) {
          const newPosition = new google.maps.LatLng(point[0], point[1]);
          
          // Calculate heading to next point
          if (lastPositionRef.current) {
            const heading = google.maps.geometry.spherical.computeHeading(
              lastPositionRef.current,
              newPosition
            );
            mapInstance.setHeading(heading);
            lastHeadingRef.current = heading;
          }
          
          mapInstance.setCenter(newPosition);
          lastPositionRef.current = newPosition;
          simulationStepRef.current = nextIndex;
          
          // Create a mock position object to simulate GPS movement
          const mockPosition = {
            coords: {
              latitude: point[0],
              longitude: point[1],
              accuracy: 5,
              heading: lastHeadingRef.current || 0,
              speed: 5 * simulationSpeed,
              altitude: null,
              altitudeAccuracy: null
            },
            timestamp: Date.now()
          };
          
          // Update user position state as if this was from GPS
          setUserPosition(mockPosition as GeolocationPosition);
          
          // Update the origin marker position to the new position
          const { setMarkers, markers } = useNavigationStore.getState();
          const updatedMarkers = markers.map(marker => {
            if (marker.id === 'origin' || marker.label === 'A') {
              return {
                ...marker,
                position: { 
                  lat: point[0], 
                  lng: point[1] 
                }
              };
            }
            return marker;
          });
          setMarkers(updatedMarkers);
          
          // Check if we need to update the current step
          updateNavigationStep(newPosition);
          
          // Recalculate ETA and distances
          recalculateRouteMetrics(newPosition);
        }
      } else {
        // End of route reached
        window.clearInterval(simulationInterval.current!);
        simulationInterval.current = null;
        setIsSimulating(false);
        
        // Show arrival message
        setStatusMessage("You have arrived at your destination");
        setTimeout(() => {
          setStatusMessage(null);
        }, 3000);
      }
    }, 500 / simulationSpeed); // Adjust speed based on multiplier
  };
  
  const updateNavigationStep = (currentPosition: google.maps.LatLng) => {
    if (!currentRoute || !currentRoute.legs || !currentRoute.legs[0]) return;
    
    const steps = currentRoute.legs[0].steps;
    
    // Find the closest step
    let minDistance = Infinity;
    let closestStepIndex = currentStep;
    
    for (let i = currentStep; i < steps.length; i++) {
      const stepEndPos = new google.maps.LatLng(
        steps[i].end_location.lat,
        steps[i].end_location.lng
      );
      
      const distance = google.maps.geometry.spherical.computeDistanceBetween(
        currentPosition,
        stepEndPos
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        closestStepIndex = i;
      }
      
      // If we're very close to the end of a step, move to the next one
      if (distance < 20 && i === currentStep) { // Within 20 meters
        if (i < steps.length - 1) {
          incrementStep();
          break;
        }
      }
    }
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
        
        {/* Simulation controls */}
        {isNavigating && (
          <div className={classes.simulationControls}>
            <button 
              className={`${classes.simulationButton} ${isSimulating ? classes.active : ''}`}
              onClick={toggleSimulation}
              title={isSimulating ? "Exit Simulation Mode" : "Enter Simulation Mode"}
            >
              SIM {isSimulating ? "ON" : "OFF"}
            </button>
            
            {isSimulating && (
              <>
                <button
                  className={classes.simulationButton}
                  onClick={moveForward}
                  title="Move Forward"
                >
                  <IconArrowNarrowUp size={20} />
                </button>
                <button
                  className={classes.simulationButton}
                  onClick={turnLeft}
                  title="Turn Left"
                >
                  <IconArrowNarrowLeft size={20} />
                </button>
                <button
                  className={classes.simulationButton}
                  onClick={turnRight}
                  title="Turn Right"
                >
                  <IconArrowNarrowRight size={20} />
                </button>
                <button
                  className={classes.simulationButton}
                  onClick={togglePause}
                  title={isPaused ? "Resume Simulation" : "Pause Simulation"}
                >
                  {isPaused ? <IconPlayerPlay size={20} /> : <IconPlayerPause size={20} />}
                </button>
                <button
                  className={classes.simulationButton}
                  onClick={changeSimulationSpeed}
                  title="Change Simulation Speed"
                >
                  {simulationSpeed}x
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer with next direction and controls */}
      <div 
        ref={footerRef}
        className={`${classes.footer} ${showAllDirections ? classes.expanded : ''}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Swipe handle */}
        <div 
          className={classes.swipeHandle}
          onClick={() => setShowAllDirections(!showAllDirections)}
        >
          {showAllDirections ? <IconChevronDown size={20} /> : <IconChevronUp size={20} />}
        </div>
        
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
        
        {/* All directions (visible when expanded) */}
        {showAllDirections && (
          <div className={classes.directionsList}>
            {currentRoute && currentRoute.legs && currentRoute.legs[0]?.steps.map((step, index) => (
              <div
                key={index}
                className={`${classes.directionStep} ${index === currentStep ? classes.active : ''}`}
              >
                <div className={classes.stepNumber}>{index + 1}</div>
                <div
                  className={classes.stepInstruction}
                  dangerouslySetInnerHTML={{ __html: step.html_instructions }}
                />
                <div className={classes.stepDistance}>{formatDistance(step.distance)}</div>
              </div>
            ))}
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