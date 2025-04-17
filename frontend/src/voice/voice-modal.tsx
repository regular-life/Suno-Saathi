import { useState, useEffect } from 'react';
import { Modal, Text, Button } from '@mantine/core';
import { IconMicrophone, IconPlayerStop, IconSend } from '@tabler/icons-react';
import classes from './voice-modal.module.scss';
import { voiceService } from './voice-service';
import { useNavigationStore } from '@/navigation/navigation-store';
import { useNavigationPlaces } from '@/navigation/navigation.query';

interface VoiceModalProps {
  opened: boolean;
  onClose: () => void;
}

export function VoiceModal({ opened, onClose }: VoiceModalProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState('Tap the microphone to start speaking');
  
  const { 
    setOrigin,
    setDestination,
    getDirections,
    startNavigation
  } = useNavigationStore();

  // Start/stop listening when modal opens/closes
  useEffect(() => {
    if (opened) {
      setTranscript('');
      setMessage('Tap the microphone to start speaking');
    } else {
      if (isListening) {
        stopListening();
      }
    }
  }, [opened]);

  // Start listening
  const startListening = () => {
    setIsListening(true);
    setMessage('Listening...');
    
    const success = voiceService.startListening(
      (text) => {
        setTranscript(text);
        setIsListening(false);
        setMessage('Processing your request...');
        processVoiceCommand(text);
      },
      () => {
        setIsListening(false);
        if (!transcript) {
          setMessage('Tap the microphone to start speaking');
        }
      }
    );
    
    if (!success) {
      setIsListening(false);
      setMessage('Could not access microphone. Please check permissions.');
    }
  };

  // Stop listening
  const stopListening = () => {
    voiceService.stopListening();
    setIsListening(false);
    
    if (!transcript) {
      setMessage('Tap the microphone to start speaking');
    }
  };

  // Process voice command
  const processVoiceCommand = async (text: string) => {
    setIsProcessing(true);
    
    try {
      // Extract navigation intent
      if (text.toLowerCase().includes('navigate to') || text.toLowerCase().includes('directions to')) {
        const destination = text.replace(/navigate to|directions to/i, '').trim();
        
        if (destination) {
          // Set destination and get current location for origin
          setDestination(destination);
          
          // Try to get user's current location for origin
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              async (position) => {
                const { latitude, longitude } = position.coords;
                setOrigin(`${latitude},${longitude}`);
                
                // Get directions
                const route = await getDirections();
                if (route !== null) {
                  setMessage(`Got directions to ${destination}. Ready to start navigation.`);
                  voiceService.speak(`Got directions to ${destination}. Ready to start navigation.`);
                  startNavigation(route);
                } else {
                  setMessage(`Could not find a route to ${destination}`);
                  voiceService.speak(`Could not find a route to ${destination}`);
                }
              },
              (error) => {
                console.error('Geolocation error:', error);
                setMessage('Could not get your current location. Please enter an origin manually.');
                voiceService.speak('Could not get your current location. Please enter an origin manually.');
              }
            );
          }
        } else {
          setMessage('Please specify a destination');
          voiceService.speak('Please specify a destination');
        }
      } 
      // Search for a place
      else if (text.toLowerCase().includes('find') || text.toLowerCase().includes('search for')) {
        const placeQuery = text.replace(/find|search for/i, '').trim();
        
        if (placeQuery) {
          const results = await useNavigationPlaces.apiCall({
            query: placeQuery,
            location: null
          });
          if (results.data && results.data.places && results.data.places.length > 0) {
            const place = results.data.places[0];
            setMessage(`Found ${place.name}`);
            voiceService.speak(`Found ${place.name}`);
            
            // Close modal after speaking
            setTimeout(() => {
              onClose();
            }, 3000);
          } else {
            setMessage(`Could not find ${placeQuery}`);
            voiceService.speak(`Could not find ${placeQuery}`);
          }
        } else {
          setMessage('Please specify what to search for');
          voiceService.speak('Please specify what to search for');
        }
      }
      // Generic response for other commands
      else {
        setMessage('I heard you say: ' + text);
        voiceService.speak('I heard you say: ' + text);
      }
    } catch (error) {
      console.error('Error processing voice command:', error);
      setMessage('Sorry, there was an error processing your request');
      voiceService.speak('Sorry, there was an error processing your request');
    } finally {
      setIsProcessing(false);
    }
  };

  // Manually submit the transcript
  const handleSubmit = () => {
    if (transcript) {
      setMessage('Processing your request...');
      processVoiceCommand(transcript);
    }
  };

  return (
    <Modal 
      opened={opened} 
      onClose={onClose} 
      title="Voice Assistant" 
      centered
      classNames={{ content: classes.modalContent }}
    >
      <div className={classes.modalBody}>
        <Text className={classes.message}>{message}</Text>
        
        {transcript && (
          <div className={classes.transcriptContainer}>
            <Text className={classes.transcript}>{transcript}</Text>
          </div>
        )}
        
        <div className={classes.controls}>
          {isListening ? (
            <Button 
              className={classes.stopButton} 
              onClick={stopListening}
              size="lg"
              variant="filled"
              color="red"
            >
              <IconPlayerStop size={24} />
            </Button>
          ) : (
            <Button 
              className={classes.micButton} 
              onClick={startListening}
              size="lg"
              variant="filled"
              color="blue"
              disabled={isProcessing}
            >
              <IconMicrophone size={24} />
            </Button>
          )}
          
          {transcript && !isListening && (
            <Button 
              className={classes.sendButton} 
              onClick={handleSubmit}
              size="lg"
              variant="filled"
              color="green"
              disabled={isProcessing}
            >
              <IconSend size={24} />
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
} 