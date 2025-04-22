import { useState, useEffect } from 'react';
import { Modal, Text, Button } from '@mantine/core';
import { IconMicrophone, IconPlayerStop } from '@tabler/icons-react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import classes from './voice-modal.module.scss';
import { voiceService } from './voice-service';
import { useNavigationStore } from '@/navigation/navigation-store';

interface VoiceModalProps {
  opened: boolean;
  onClose: () => void;
}

export function VoiceModal({ opened, onClose }: VoiceModalProps) {
  const {
    origin,
    destination,
    isNavigating,
    currentRoute,
    currentStep,
    distanceRemaining,
    timeRemaining,
  } = useNavigationStore();

  // ---- speech‑to‑text ---------------------------------------------------
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
  } = useSpeechRecognition();

  // ---- UI / assistant state --------------------------------------------
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState('Tap the microphone to start speaking');
  const [llmResponse, setLlmResponse] = useState('');
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);

  // Reset modal each time it opens ---------------------------------------
  useEffect(() => {
    if (opened) {
      resetTranscript();
      setMessage('Tap the microphone to start speaking');
      setLlmResponse('');
    } else {
      SpeechRecognition.abortListening();
    }
  }, [opened]);

  // When recording stops & we have text → ship to LLM --------------------
  useEffect(() => {
    if (!listening && transcript && !isProcessing) {
      processWithLLM(transcript);
    }
  }, [listening, transcript]);

  // ---------------- microphone controls ---------------------------------
  const startListening = () => {
    if (!browserSupportsSpeechRecognition) {
      setMessage('Speech recognition not supported in this browser.');
      return;
    }

    setMessage('Listening...');
    resetTranscript();
    SpeechRecognition.startListening({ continuous: false, language: 'en-US' });
  };

  const stopListening = () => {
    SpeechRecognition.stopListening();
    if (!transcript) {
      setMessage('Tap the microphone to start speaking');
    }
  };

  // ---------------- LLM plumbing ---------------------------------------
  const buildContext = async () => {
    const loc = await new Promise<string | null>((resolve) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (p) => resolve(`${p.coords.latitude},${p.coords.longitude}`),
          () => resolve(null)
        );
      } else resolve(null);
    });

    return {
      session_id: sessionId,
      navigation_status: isNavigating ? 'active' : 'inactive',
      current_step: currentStep,
      origin: origin || 'not set',
      destination: destination || 'not set',
      distance_remaining: distanceRemaining,
      time_remaining: timeRemaining,
      current_time: new Date().toLocaleTimeString(),
      current_date: new Date().toLocaleDateString(),
      current_location: loc,
      route_info: currentRoute,
    };
  };

  const processWithLLM = async (text: string) => {
    setIsProcessing(true);
    setMessage('Processing with AI assistant...');

    try {
      const context = await buildContext();
      const res = await fetch('/api/llm/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text, context }),
      });

      if (!res.ok) throw new Error('LLM request failed');

      const data = await res.json();
      const responseText = data.response || 'Sorry, I could not process that.';
      if (data.metadata?.session_id) setSessionId(data.metadata.session_id);

      setLlmResponse(responseText);
      setMessage('AI assistant responded');
      voiceService.speak(responseText);
    } catch (err) {
      console.error(err);
      setMessage('Error talking to AI assistant');
      voiceService.speak('Sorry, there was an error talking to the AI assistant.');
    } finally {
      setIsProcessing(false);
    }
  };

  // ----------------------- UI -------------------------------------------
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

        {llmResponse && (
          <div className={classes.llmResponseContainer}>
            <Text className={classes.llmResponse}>{llmResponse}</Text>
          </div>
        )}

        <div className={classes.controls}>
          {listening ? (
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
        </div>
      </div>
    </Modal>
  );
}
