import { useState, useEffect, useRef } from 'react';
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

// Helper to get the right icon based on the maneuver type
const getManeuverIcon = (type: string | null | undefined, shouldPulsate: boolean = false) => {
  const baseSize = 80;
  const iconStyle = shouldPulsate ? { animation: 'pulsate 1.5s infinite' } : {};
  
  if (!type) return <IconArrowUp size={baseSize} color="black" style={iconStyle} />;
  
  switch (type) {
    case 'turn-right':
    case 'turn-slight-right':
    case 'turn-sharp-right':
      return <IconArrowRight size={baseSize} color="black" style={iconStyle} />;
    case 'turn-left':
    case 'turn-slight-left':
    case 'turn-sharp-left':
      return <IconArrowLeft size={baseSize} color="black" style={iconStyle} />;
    default:
      return <IconArrowUp size={baseSize} color="black" style={iconStyle} />;
  }
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

interface FocusModeProps {
  onExit: () => void;
  onBack: () => void;
  onSwitchToMap: () => void;
}

export function FocusMode({ onExit, onBack, onSwitchToMap }: FocusModeProps) {
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const statusTimeoutRef = useRef<number | null>(null);
  
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
    // Start wake word detection
    voiceService.startWakeWordDetection(() => {
      showTemporaryStatus("I'm listening...");
      handleVoiceCommand();
    });
    
    // Cleanup on unmount
    return () => {
      voiceService.stopWakeWordDetection();
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
  
  // Check if we're near the next maneuver (< 50m) to highlight it
  const shouldPulsateIcon = currentManeuver && isNearNextManeuver(currentManeuver.distance);
  
  // Estimated time left based on the route data
  const estimatedTimeLeft = currentRoute.legs[0]?.duration.text || '';
  const compactTimeLeft = formatCompactTime(estimatedTimeLeft);
  
  // Toggle volume
  const toggleVolume = () => {
    const muted = voiceService.toggleMute();
    setIsMuted(muted);
    showTemporaryStatus(muted ? "Voice muted" : "Voice unmuted");
  };
  
  // Process voice command using the streamlined voice service
  const handleVoiceCommand = async () => {
    setIsListening(true);
    
    try {
      // Get current location and navigation context
      let currentLocation = null;
      try {
        if (navigator.geolocation) {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject);
          });
          currentLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };
        }
      } catch (error) {
        console.warn('Could not get geolocation:', error);
      }

      // Create context object with navigation state
      const contextData = {
        is_navigating: isNavigating,
        origin: currentRoute?.legs[0]?.start_address || 'unknown',
        destination: currentRoute?.legs[0]?.end_address || 'unknown',
        current_step: currentStep,
        total_steps: currentRoute?.legs[0]?.steps.length || 0,
        current_instruction: currentRoute?.legs[0]?.steps[currentStep]?.html_instructions || '',
        distance_remaining: distanceRemaining,
        time_remaining: timeRemaining,
        current_location: currentLocation,
        current_time: new Date().toLocaleTimeString(),
        current_date: new Date().toLocaleDateString()
      };

      // Listen for command
      const transcript = await voiceService.startListening();

      // Process with backend LLM
      const response = await fetch('/api/llm/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: transcript,
          context: contextData
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get LLM response');
      }

      const data = await response.json();

      // Speak the response
      voiceService.speak(data.response);
      showTemporaryStatus(data.response, 5000);

      // Handle navigation actions from LLM response
      if (data.action === 'exit-navigation') {
        showTemporaryStatus("Exiting navigation...");
        setTimeout(() => {
          onExit();
        }, 1000);
      } else if (data.action === 'next-step') {
        showTemporaryStatus("Going to next step");
        incrementStep();
      }
    } catch (error) {
      console.error('Error processing voice command:', error);
      showTemporaryStatus("Sorry, I couldn't process that request");
      voiceService.speak("Sorry, I couldn't process that request");
    } finally {
      setIsListening(false);
    }
  };
  
  // Handle manual microphone button click
  const handleVoiceButtonClick = () => {
    if (isListening) {
      voiceService.stopListening();
      setIsListening(false);
      showTemporaryStatus("Listening cancelled");
    } else {
      handleVoiceCommand();
    }
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
        {currentManeuver && (
          <>
            <Text style={{ fontSize: '24px', marginBottom: '20px', color: 'black' }}>
              {currentManeuver.html_instructions.includes("Stay") ? 
                "Stay on the same road" : 
                getInstructionText(currentManeuver.html_instructions)
              }
            </Text>
            
            <Box
              style={{
                margin: '30px 0'
              }}
            >
              {getManeuverIcon(currentManeuver.maneuver, shouldPulsateIcon)}
            </Box>
            
            <Text 
              style={{ 
                fontSize: '72px', 
                fontWeight: 'bold', 
                marginTop: '20px', 
                color: shouldPulsateIcon ? '#FF3B30' : 'black'
              }}
            >
              {formatDistance(currentManeuver.distance)}
            </Text>
          </>
        )}
      </Box>
      
      {/* Footer with next direction and controls */}
      <Box
        style={{
          borderTop: '1px solid rgba(0, 0, 0, 0.1)',
          padding: '15px',
          backgroundColor: 'rgba(0, 0, 0, 0.05)'
        }}
      >
        {/* Next maneuver info */}
        {nextManeuver ? (
          <Box
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '15px'
            }}
          >
            <Box style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Text style={{ fontSize: '14px', color: 'rgba(0, 0, 0, 0.6)' }}>Next:</Text>
              {getNextManeuverIcon(nextManeuver.maneuver)}
            </Box>
            
            <Text style={{ fontSize: '14px', fontWeight: 'normal', color: 'black', flex: 1, marginLeft: '10px' }}>
              {getInstructionText(nextManeuver.html_instructions)}
            </Text>
            
            <Text style={{ fontSize: '14px', color: 'black', fontWeight: 'bold' }}>
              {formatDistance(nextManeuver.distance)}
            </Text>
          </Box>
        ) : (
          <Box
            style={{
              textAlign: 'center',
              marginBottom: '15px',
              color: 'rgba(0, 0, 0, 0.6)',
              fontSize: '14px'
            }}
          >
            Arriving at destination
          </Box>
        )}
        
        {/* Control buttons */}
        <Box
          style={{
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center'
          }}
        >
          <Box
            style={{
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              background: 'rgba(0, 0, 0, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
            onClick={onSwitchToMap}
          >
            <IconMap size={24} color="black" />
          </Box>
          
          <Box
            style={{
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              background: isListening ? 'rgba(255, 80, 80, 0.5)' : 'rgba(0, 0, 0, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              border: isListening ? '2px solid rgba(255, 80, 80, 0.8)' : 'none',
              animation: isListening ? 'pulse 1.5s infinite' : 'none',
              transition: 'all 0.2s ease'
            }}
            onClick={handleVoiceButtonClick}
          >
            <IconMicrophone size={24} color="black" />
          </Box>
        </Box>
        
        {/* Hint text */}
        <Text
          style={{
            width: '100%',
            padding: '10px 0 0',
            fontSize: '12px',
            textAlign: 'center',
            color: 'rgba(0, 0, 0, 0.5)'
          }}
        >
          Say "Hey Saarthi" to activate voice assistant
        </Text>
      </Box>
      
      {/* Status message overlay (when active) */}
      <Transition
        mounted={!!statusMessage}
        transition="fade"
        duration={200}
      >
        {(styles) => (
          <Box
            style={{
              ...styles,
              position: 'absolute',
              left: '50%',
              bottom: '90px',
              transform: 'translateX(-50%)',
              padding: '10px 20px',
              background: 'rgba(255, 255, 255, 0.9)',
              borderRadius: '20px',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
              zIndex: 1001
            }}
          >
            <Text style={{ fontSize: '14px', textAlign: 'center', color: 'black' }}>
              {statusMessage}
            </Text>
          </Box>
        )}
      </Transition>
    </Box>
  );
}