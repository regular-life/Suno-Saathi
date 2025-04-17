import { useState } from 'react';
import { 
  IconVolume, 
  IconVolumeOff, 
  IconArrowsMinimize, 
  IconArrowBack, 
  IconMicrophone,
  IconX,
  IconSend
} from '@tabler/icons-react';
import classes from './navigation-mode.module.scss';
import { useNavigationStore } from '@/navigation/navigation-store';
import { voiceService } from '@/voice/voice-service';
import { MapContainer } from '@/map/map';
import { useNavigationQuery } from './navigation.query';
// Format helpers
const formatDistance = (distance: { text: string; value: number }) => distance.text;

export function NavigationMode() {
  const [isMuted, setIsMuted] = useState(false);
  const [isCompactMode, setIsCompactMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState<Array<{ type: 'user' | 'assistant'; text: string }>>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const { 
    isNavigating, 
    currentRoute, 
    currentStep, 
    incrementStep, 
    endNavigation,
    setCurrentStep
  } = useNavigationStore();
  
  // Check if we should render this component
  if (!isNavigating || !currentRoute) {
    return null;
  }
  
  const currentManeuver = currentRoute.legs[0]?.steps[currentStep] || null;
  const nextManeuver = currentRoute.legs[0]?.steps[currentStep + 1] || null;
  
  // Toggle volume
  const toggleVolume = () => {
    const muted = voiceService.toggleMute();
    setIsMuted(muted);
  };
  
  // Toggle compact mode
  const toggleCompactMode = () => {
    setIsCompactMode(!isCompactMode);
  };
  
  // Exit navigation
  const handleExitNavigation = () => {
    endNavigation();
  };

  // Start voice input
  const startVoiceInput = () => {
    if (isListening) {
      voiceService.stopListening();
      setIsListening(false);
      return;
    }

    const success = voiceService.startListening(
      (text) => {
        console.log('Voice input:', text);
        // Process voice commands
        if (text.toLowerCase().includes('exit') || text.toLowerCase().includes('stop')) {
          endNavigation();
        } else if (text.toLowerCase().includes('next')) {
          incrementStep();
        } else if (text.toLowerCase().includes('repeat')) {
          // Repeat current instruction
          if (currentManeuver) {
            voiceService.speak(currentManeuver.html_instructions);
          }
        }
        setIsListening(false);
      },
      () => {
        setIsListening(false);
      }
    );

    if (success) {
      setIsListening(true);
    }
  };

  // Get the appropriate icon class based on maneuver type
  const getManeuverIconClass = (type: string | null | undefined): string => {
    if (!type) return 'fa-arrow-up';
    
    const iconMap: Record<string, string> = {
      'turn-slight-left': 'fa-arrow-left fa-rotate-45',
      'turn-left': 'fa-arrow-left',
      'turn-sharp-left': 'fa-arrow-left fa-rotate-315',
      'uturn-left': 'fa-undo',
      'turn-slight-right': 'fa-arrow-right fa-rotate-315',
      'turn-right': 'fa-arrow-right',
      'turn-sharp-right': 'fa-arrow-right fa-rotate-45',
      'uturn-right': 'fa-redo',
      'straight': 'fa-arrow-up',
      'roundabout': 'fa-sync',
      'rotary': 'fa-sync',
      'roundabout-exit': 'fa-sign-out-alt',
      'rotary-exit': 'fa-sign-out-alt',
      'arrive': 'fa-flag-checkered',
      'depart': 'fa-play',
      'merge': 'fa-compress-alt',
      'fork': 'fa-code-branch',
      'ramp': 'fa-level-up-alt'
    };
    
    return `fas ${iconMap[type] || 'fa-arrow-up'}`;
  };
  
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isProcessing) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setMessages(prev => [...prev, { type: 'user', text: userMessage }]);
    setIsProcessing(true);

    try {
      // Get current location for context
      let currentLocation = null;
      if (navigator.geolocation) {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });
        currentLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
      }

      // Create navigation context
      const navigationContext = {
        current_location: currentLocation,
        destination: currentRoute.legs[0].end_address,
        next_turn: currentManeuver?.html_instructions,
        distance_remaining: currentRoute.legs[0].steps[currentStep].distance
      };

      // Process the navigation query through the API
      const response = await useNavigationQuery.apiCall({
        query: userMessage,
        location: currentLocation
      });
      
      if (response && response.data) {
        setMessages(prev => [...prev, { type: 'assistant', text: response.data.response }]);
        voiceService.speak(response.data.response);

        // Handle specific query types
        if (response.data.query_type === 'traffic' && response.data.traffic_info) {
          // Update UI with traffic information
          console.log('Traffic info:', response.data.traffic_info);
        } else if (response.data.query_type === 'nearby_place' && response.data.places) {
          // Update UI with nearby places
          console.log('Nearby places:', response.data.places);
        } else if (response.data.query_type === 'route_feature') {
          // Handle route feature information
          console.log('Route feature:', response.data.feature);
        }
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Error processing message:', error);
      const errorMessage = "Sorry, I couldn't process your request. Please try again.";
      setMessages(prev => [...prev, { type: 'assistant', text: errorMessage }]);
      voiceService.speak(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Full navigation view
  if (!isCompactMode) {
    return (
      <div className={classes.navigationMode}>
        <div className={classes.header}>
          <button className={classes.exitButton} onClick={handleExitNavigation}>
            <IconArrowBack size={20} />
          </button>
          <div className={classes.title}>
            <h3>Navigating to {currentRoute.legs[0].end_address}</h3>
          </div>
          <div className={classes.controls}>
            <button 
              className={`${classes.controlButton} ${isMuted ? classes.muted : ''}`}
              onClick={toggleVolume}
            >
              {isMuted ? <IconVolumeOff size={20} /> : <IconVolume size={20} />}
            </button>
            <button 
              className={classes.controlButton}
              onClick={toggleCompactMode}
            >
              <IconArrowsMinimize size={20} />
            </button>
          </div>
        </div>
        
        {currentManeuver && (
          <div className={classes.currentManeuver}>
            <div className={classes.maneuverIcon}>
              <i className={getManeuverIconClass(currentManeuver.maneuver)} />
            </div>
            <div className={classes.maneuverDetails}>
              <div 
                className={classes.instruction}
                dangerouslySetInnerHTML={{ __html: currentManeuver.html_instructions }}
              />
              <div className={classes.distance}>
                {formatDistance(currentManeuver.distance)}
              </div>
            </div>
          </div>
        )}
        
        {nextManeuver && (
          <div className={classes.nextManeuver}>
            <div className={classes.nextLabel}>THEN</div>
            <div className={classes.nextInstruction}>
              <div className={classes.nextManeuverIcon}>
                <i className={getManeuverIconClass(nextManeuver.maneuver)} />
              </div>
              <div 
                className={classes.nextText}
                dangerouslySetInnerHTML={{ __html: nextManeuver.html_instructions }}
              />
            </div>
          </div>
        )}
        
        <div className={classes.bottomControls}>
          <button 
            className={`${classes.micButton} ${isListening ? classes.active : ''}`}
            onClick={startVoiceInput}
          >
            <IconMicrophone size={24} />
          </button>
        </div>

        <div className={classes.mapContainer}>
          <MapContainer />
        </div>

        <div className={classes.chatBox}>
          <div className={classes.chatHeader}>
            <span>Navigation Assistant</span>
            <button onClick={handleExitNavigation} className={classes.controlButton}>
              <IconX size={20} />
            </button>
          </div>
          <div className={classes.chatMessages}>
            {messages.map((message, index) => (
              <div 
                key={index} 
                className={`${classes.message} ${message.type === 'user' ? classes.userMessage : classes.assistantMessage}`}
              >
                {message.text}
              </div>
            ))}
          </div>
          <div className={classes.chatInput}>
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              disabled={isProcessing}
            />
            <button 
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isProcessing}
            >
              <IconSend size={20} />
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // Compact navigation view
  return (
    <div className={`${classes.navigationMode} ${classes.compact}`}>
      <div className={classes.compactHeader}>
        <button className={classes.backButton} onClick={handleExitNavigation}>
          <IconArrowBack size={20} />
        </button>
        <div className={classes.compactInfo}>
          <div className={classes.compactDistance}>
            {currentManeuver ? formatDistance(currentManeuver.distance) : ''}
          </div>
        </div>
        <button 
          className={classes.expandButton} 
          onClick={toggleCompactMode}
        >
          <IconArrowsMinimize size={20} />
        </button>
      </div>
      
      {currentManeuver && (
        <div className={classes.compactManeuver}>
          <div className={`${classes.maneuverIcon} ${classes[getManeuverIconClass(currentManeuver.maneuver)]}`} />
        </div>
      )}

      <div className={classes.mapContainer}>
        <MapContainer />
      </div>

      <div className={classes.chatBox}>
        <div className={classes.chatHeader}>
          <span>Navigation Assistant</span>
          <button onClick={handleExitNavigation} className={classes.controlButton}>
            <IconX size={20} />
          </button>
        </div>
        <div className={classes.chatMessages}>
          {messages.map((message, index) => (
            <div 
              key={index} 
              className={`${classes.message} ${message.type === 'user' ? classes.userMessage : classes.assistantMessage}`}
            >
              {message.text}
            </div>
          ))}
        </div>
        <div className={classes.chatInput}>
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            disabled={isProcessing}
          />
          <button 
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isProcessing}
          >
            <IconSend size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}