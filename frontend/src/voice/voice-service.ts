/**
 * Voice service for speech recognition and synthesis
 */

// Define SpeechRecognition interface
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: (event: any) => void;
  onerror: (event: any) => void;
  onend: () => void;
}

// Type declarations for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: {
      new(): SpeechRecognition;
    };
    webkitSpeechRecognition: {
      new(): SpeechRecognition;
    };
  }
}

// Callback type
type SpeechRecognitionCallback = (text: string) => void;

interface VoiceServiceState {
  isListening: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
}

class VoiceService {
  private recognition: any = null;
  private readonly state: VoiceServiceState = {
    isListening: false,
    isSpeaking: false,
    isMuted: false
  };

  private onResultCallback: SpeechRecognitionCallback | null = null;
  private onEndCallback: () => void = () => {};

  constructor() {
    this.initSpeechRecognition();
  }

  /**
   * Initialize speech recognition
   */
  private initSpeechRecognition(): void {
    if (typeof window === 'undefined') {
      return;
    }
    
    if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      console.warn('Speech recognition is not supported in this browser');
      return;
    }

    // Use the appropriate speech recognition API
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    
    // Configure recognition
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';

    // Set up event handlers
    this.recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript.trim();
      console.log('Voice recognition result:', transcript);
      
      if (this.onResultCallback) {
        this.onResultCallback(transcript);
      }
    };

    this.recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
    };

    this.recognition.onend = () => {
      this.state.isListening = false;
      this.onEndCallback();
    };
  }

  /**
   * Start listening for voice input
   * @param onResult Callback function to handle the recognized text
   * @param onEnd Callback function to handle when listening ends
   */
  public startListening(onResult: SpeechRecognitionCallback, onEnd: () => void = () => {}): boolean {
    if (!this.recognition) {
      console.error('Speech recognition not available');
      return false;
    }

    if (this.state.isListening) {
      return true; // Already listening
    }

    try {
      this.onResultCallback = onResult;
      this.onEndCallback = onEnd;
      this.recognition.start();
      this.state.isListening = true;
      return true;
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      return false;
    }
  }

  /**
   * Stop listening for voice input
   */
  public stopListening(): void {
    if (!this.recognition || !this.state.isListening) {
      return;
    }

    try {
      this.recognition.stop();
      this.state.isListening = false;
    } catch (error) {
      console.error('Error stopping speech recognition:', error);
    }
  }

  /**
   * Check if the service is currently listening
   */
  public isListening(): boolean {
    return this.state.isListening;
  }

  /**
   * Speak text using speech synthesis
   * @param text Text to speak
   * @param onEnd Callback function to call when speech ends
   */
  public speak(text: string, onEnd: () => void = () => {}): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    if (!('speechSynthesis' in window)) {
      console.error('Speech synthesis not supported');
      return false;
    }

    if (this.state.isMuted) {
      onEnd(); // Call the end callback even if muted
      return false;
    }

    // Cancel any ongoing speech
    this.stopSpeaking();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Try to get a female voice
    const voices = window.speechSynthesis.getVoices();
    const femaleVoice = voices.find(voice => 
      voice.name.includes('female') || voice.name.includes('Samantha') || voice.name.includes('Google UK English Female')
    );

    if (femaleVoice) {
      utterance.voice = femaleVoice;
    }

    utterance.onstart = () => {
      this.state.isSpeaking = true;
    };

    utterance.onend = () => {
      this.state.isSpeaking = false;
      onEnd();
    };

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      this.state.isSpeaking = false;
      onEnd();
    };

    window.speechSynthesis.speak(utterance);
    return true;
  }

  /**
   * Stop any ongoing speech
   */
  public stopSpeaking(): void {
    if (typeof window === 'undefined') {
      return;
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      this.state.isSpeaking = false;
    }
  }

  /**
   * Check if the service is currently speaking
   */
  public isSpeaking(): boolean {
    return this.state.isSpeaking;
  }

  /**
   * Toggle mute/unmute state
   */
  public toggleMute(): boolean {
    this.state.isMuted = !this.state.isMuted;
    
    if (this.state.isMuted && this.state.isSpeaking) {
      this.stopSpeaking();
    }
    
    return this.state.isMuted;
  }

  /**
   * Check if the service is muted
   */
  public isMuted(): boolean {
    return this.state.isMuted;
  }
}

// Create singleton instance
export const voiceService = new VoiceService(); 