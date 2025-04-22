import { useState, useEffect, useRef, TouchEvent } from 'react';
import { 
  IconVolume, 
  IconVolumeOff, 
  IconArrowUp, 
  IconArrowRight,
  IconArrowLeft,
  IconChevronUp,
  IconChevronDown,
  IconX,
  IconMapPin,
  IconMicrophone,
  IconArrowBack,
  IconMap
} from '@tabler/icons-react';
import { Box, Text, Stack, Transition } from '@mantine/core';
import { useNavigationStore } from '@/navigation/navigation-store';
import { voiceService } from '@/voice/voice-service';
import classes from './navigation-mode.module.scss';

// Get the appropriate pulsation rate based on distance
const getIconPulsationRate = (distance: { text: string; value: number }) => {
  if (distance.value <= 0) {
    return null; // No pulsation when at destination (0 meters)
  } else if (distance.value < 50) {
    return '0.8s'; // Very fast pulse when extremely close (under 50m)
  } else if (distance.value < 100) {
    return '1.0s'; // Fast pulse when close (50-100m)
  } else if (distance.value < 200) {
    return '1.5s'; // Medium pulse when approaching (100-200m)
  } else {
    return '2.5s'; // Slow, steady pulse for regular navigation
  }
};

// Helper to get the right icon based on the maneuver type
const getManeuverIcon = (type: string | null | undefined, shouldPulsate: boolean = false, distance?: { text: string; value: number }) => {
  // Use useState to create pulsating effect with size changes
  const [iconSize, setIconSize] = useState(80);
  
  // Debug logs to understand what's coming in 
  console.log('getManeuverIcon called with:', { type, distance: distance?.value });
  
  // Set up pulsation effect using useEffect
  useEffect(() => {
    if (!shouldPulsate && (!distance || distance.value === 0)) return;
    
    // Determine pulse speed based on distance
    let interval = 2000; // default slow pulse
    if (distance) {
      if (distance.value < 50) interval = 1500; // very fast when close
      else if (distance.value < 100) interval = 500; // fast when approaching
      else if (distance.value < 200) interval = 100; // medium when nearing
    }
    
    // Create pulse effect by changing size
    let growing = false;
    const pulseTimer = setInterval(() => {
      setIconSize(current => {
        // Switch between growing and shrinking
        if (current >= 92) growing = false;
        if (current <= 68) growing = true;
        
        return growing ? current + 4 : current - 4;
      });
    }, 100);
    
    return () => clearInterval(pulseTimer);
  }, [shouldPulsate, distance]);

  // Check if near a turn (less than 400m)
  const isNearTurn = distance && distance.value <= 400;
  
  // Log debug info about turn decision
  console.log('Turn decision:', { isNearTurn, type, distanceValue: distance?.value });
  
  // If we have a turn coming up AND we're close to it
  if (isNearTurn && type) {
    // Check directly for turn type patterns
    if (type.includes('left') || type === 'turn-left' || type === 'turn-slight-left' || type === 'turn-sharp-left') {
      console.log('Showing LEFT arrow');
      return <IconArrowLeft size={iconSize} color="black" />;
    }
    
    if (type.includes('right') || type === 'turn-right' || type === 'turn-slight-right' || type === 'turn-sharp-right') {
      console.log('Showing RIGHT arrow');
      return <IconArrowRight size={iconSize} color="black" />;
    }
  }
  
  console.log('Showing default UP arrow');
  // Default to straight arrow
      return <IconArrowUp size={iconSize} color="black" />;
};

// Get smaller icon for next maneuver
const getNextManeuverIcon = (type: string | null | undefined) => {
  if (!type) return <IconArrowUp size={24} color="black" />;
  
  switch (type) {
    case 'turn-right':
    case 'turn-slight-right':
    case 'turn-sharp-right':
      return <IconArrowRight size={24} color="black" />;
    case 'turn-left':
    case 'turn-slight-left':
    case 'turn-sharp-left':
      return <IconArrowLeft size={24} color="black" />;
    default:
      return <IconArrowUp size={24} color="black" />;
  }
};

// Format distance for display
const formatDistance = (distance: { text: string; value: number }) => distance.text;

// Check if distance is less than 50m
const isNearNextManeuver = (distance: { text: string; value: number }) => {
  return distance.value < 50; // 50 meters threshold
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

// Get instruction from step
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

// Extract direction type from instruction text for arrow display
const getDirectionFromInstruction = (instruction: string): string | null => {
  if (!instruction) return null;
  
  const cleanText = instruction.replace(/<[^>]+>/g, '').toLowerCase();
  
  if (cleanText.includes("right")) {
    return "turn-right";
  } else if (cleanText.includes("left")) {
    return "turn-left";
  } else {
    return null;
  }
};

interface FocusModeProps {
  onExit: () => void;
  onBack: () => void;
  onSwitchToMap: () => void;
}

export function FocusMode({ onExit, onBack, onSwitchToMap }: FocusModeProps) {
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showAllDirections, setShowAllDirections] = useState(false);
  const statusTimeoutRef = useRef<number | null>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);
  const [voiceStatus, setVoiceStatus] = useState<string>('');
  
  const { 
    isNavigating, 
    currentRoute, 
    currentStep, 
    incrementStep, 
    endNavigation,
    showDirectionsPanel,
    toggleDirectionsPanel,
    distanceRemaining,
    timeRemaining
  } = useNavigationStore();
  
  // Initialize wake word detection on mount
  useEffect(() => {
    // Set up voice status callback
    voiceService.setStatusUpdateCallback((status) => {
      setVoiceStatus(status);
      if (status === 'Listening for wake word...') {
        setIsListening(true);
      } else if (status === 'Idle' || status.includes('Error') || status.includes('timed out')) {
        setIsListening(false);
      }
    });
    
    return () => {
      // Clear the callback on unmount
      voiceService.setStatusUpdateCallback((_status: string) => {});
      clearStatusTimeout();
    };
  }, []);
  
  // Clear status timeout if exists
  const clearStatusTimeout = () => {
    if (statusTimeoutRef.current) {
      window.clearTimeout(statusTimeoutRef.current);
      statusTimeoutRef.current = null;
    }
  };
  
  // Show temporary status message
  const showTemporaryStatus = (message: string, duration: number = 3000) => {
    setStatusMessage(message);
    clearStatusTimeout();
    
    statusTimeoutRef.current = window.setTimeout(() => {
      setStatusMessage(null);
      statusTimeoutRef.current = null;
    }, duration);
  };
  
  // Check if we should render this component
  if (!isNavigating || !currentRoute) {
    return null;
  }
  
  const currentManeuver = currentRoute.legs[0]?.steps[currentStep] || null;
  const nextManeuver = currentRoute.legs[0]?.steps[currentStep + 1] || null;
  
  // Debug log to check currentManeuver structure
  console.log("Current maneuver:", JSON.stringify(currentManeuver, null, 2));
  
  // Pulsation is controlled by distance (updated)
  const shouldPulsateIcon = currentManeuver && (getIconPulsationRate(currentManeuver.distance) !== null);
  
  // Estimated time left based on the route data
  const estimatedTimeLeft = currentRoute.legs[0]?.duration.text || '';
  const compactTimeLeft = formatCompactTime(estimatedTimeLeft);
  
  // Toggle volume
  const toggleVolume = () => {
    const muted = voiceService.toggleMute();
    setIsMuted(muted);
    showTemporaryStatus(muted ? "Voice muted" : "Voice unmuted");
  };
  
  // Handle voice button click
  const handleVoiceButtonClick = async () => {
    if (isListening) {
      // If already listening, stop
      voiceService.stopListening();
      voiceService.stopWakeWordDetection();
      setIsListening(false);
      showTemporaryStatus("Voice assistant stopped");
      return;
    }

    // Start the complete voice interaction flow
    setIsListening(true);
    showTemporaryStatus('Listening for "Hey Saarthi"...');
    
    try {
      const success = await voiceService.processVoiceInteraction();

      if (!success) {
        showTemporaryStatus('Could not process voice command');
      }
    } catch (error) {
      console.error('Error in voice interaction:', error);
      showTemporaryStatus('Voice interaction error');
    } finally {
      setIsListening(false);
    }
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
  
  return (
    <Box
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'white',
        color: 'black',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        padding: '0'
      }}
    >
      {/* Header with back button and ETA */}
      <Box
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px',
          borderBottom: '1px solid rgba(0, 0, 0, 0.1)'
        }}
      >
        <Box
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'rgba(0, 0, 0, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
          onClick={onBack}
        >
          <IconArrowBack size={20} color="black" />
        </Box>
        
        <Text style={{ fontSize: '16px', fontWeight: 'normal', color: 'black' }}>
          ETA: <strong style={{ fontSize: '18px' }}>{compactTimeLeft}</strong>
        </Text>
        
        <Box
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'rgba(0, 0, 0, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
          onClick={toggleVolume}
        >
          {isMuted ? <IconVolumeOff size={20} color="black" /> : <IconVolume size={20} color="black" />}
        </Box>
      </Box>
      
      {/* Main content with current step - taking most of the screen */}
      <Box
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          flex: 1,
          padding: '20px',
          textAlign: 'center'
        }}
      >
        {currentManeuver && nextManeuver && (
          <>
            <Text style={{ fontSize: '24px', marginBottom: '20px', color: 'black' }}>
              {getInstructionText(nextManeuver.html_instructions)} in {formatDistance(currentManeuver.distance)}
            </Text>
            <div style={{ margin: '30px 0', height: '90px', width: '90px' }}>
            <Box
              style={{
                margin: '30px 0'
              }}
            >
              {getManeuverIcon(nextManeuver.maneuver || getDirectionFromInstruction(nextManeuver.html_instructions), false, currentManeuver.distance)}
            </Box>
            </div>
            
            <Text 
              style={{ 
                fontSize: '72px', 
                fontWeight: 'bold', 
                marginTop: '20px', 
                color: currentManeuver.distance.value < 50 ? '#FF3B30' : 'black'
              }}
            >
              {formatDistance(currentManeuver.distance)}
            </Text>
          </>
        )}
      </Box>
      
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
            {currentRoute && currentRoute.legs && currentRoute.legs[0]?.steps.slice(2).map((step, index) => (
              <div
                key={index + 2}
                className={`${classes.directionStep} ${index + 2 === currentStep ? classes.active : ''}`}
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
            onClick={onSwitchToMap}
            title="Switch to Map Mode"
          >
            <IconMap size={24} />
          </button>
          
          <button 
            className={`${classes.micButton} ${isListening ? classes.active : ''}`}
            onClick={handleVoiceButtonClick}
          >
            <IconMicrophone size={24} />
          </button>
        </div>
        
        {/* Hint text */}
        <div className={classes.hintText}>
          Say "Hey Saarthi" to activate voice assistant
        </div>
      </div>
      
      {/* Status message overlay */}
      {(statusMessage || voiceStatus) && (
        <div className={classes.statusMessage}>
          {statusMessage || voiceStatus}
        </div>
        )}
    </Box>
  );
}