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

// Response from LLM processing
interface LLMResponse {
  response: string;
  action?: string;
  params?: any;
  sessionId?: string;
}

// Voice service state
interface VoiceServiceState {
  isListening: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
  isWakeWordListening: boolean;
  currentSessionId?: string;
}

// Wake word settings
const WAKE_WORD = 'hey saarthi';
const WAKE_WORD_THRESHOLD = 0.8;
const WAKE_SOUND_PATH = '/sounds/wake.mp3';

class VoiceService {
  private recognition: SpeechRecognition | null = null;
  private wakeWordRecognition: SpeechRecognition | null = null;
  private synthesisVoice: SpeechSynthesisVoice | null = null;
  
  private readonly state: VoiceServiceState = {
    isListening: false,
    isSpeaking: false,
    isMuted: false,
    isWakeWordListening: false
  };

  private onWakeWordCallback: (() => void) | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initSpeechRecognition();
      this.initWakeWordRecognition();
      this.loadPreferredVoice();
    }
  }

  /**
   * Initialize the preferred voice for speech synthesis
   */
  private loadPreferredVoice(): void {
    if (!('speechSynthesis' in window)) return;
    
    // Load voices and select preferred voice (female voice if available)
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      this.synthesisVoice = voices.find(voice => 
        voice.name.includes('female') || 
        voice.name.includes('Samantha') || 
        voice.name.includes('Google UK English Female')
      ) || null;
    };
    
    // Chrome loads voices asynchronously
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    
    loadVoices();
  }

  /**
   * Calculate similarity between two strings for wake word detection
   */
  private stringSimilarity(s1: string, s2: string): number {
    const longer = s1.length > s2.length ? s1.toLowerCase() : s2.toLowerCase();
    const shorter = s1.length > s2.length ? s2.toLowerCase() : s1.toLowerCase();
    
    if (longer.length === 0) return 1.0;
    
    // Check if shorter string is contained in longer one
    if (longer.includes(shorter)) return 0.8;
    
    const words1 = longer.split(' ');
    const words2 = shorter.split(' ');
    
    // Count matching words
    const matchingWords = words2.filter(word => words1.includes(word)).length;
    return matchingWords / Math.max(words1.length, words2.length);
  }

  /**
   * Initialize speech recognition for command processing
   */
  private initSpeechRecognition(): void {
    if (!this.isSpeechRecognitionSupported()) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';
  }

  /**
   * Initialize wake word recognition 
   */
  private initWakeWordRecognition(): void {
    if (!this.isSpeechRecognitionSupported()) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.wakeWordRecognition = new SpeechRecognition();
    
    this.wakeWordRecognition.continuous = true;
    this.wakeWordRecognition.interimResults = true;
    this.wakeWordRecognition.lang = 'en-US';

    // Set up wake word detection handler
    this.wakeWordRecognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.trim().toLowerCase();
        
        const similarity = this.stringSimilarity(WAKE_WORD, transcript);
        if (similarity >= WAKE_WORD_THRESHOLD) {
          console.log('Wake word detected with similarity:', similarity);
          
          this.stopWakeWordDetection();
          this.playSound(WAKE_SOUND_PATH);
          
          if (this.onWakeWordCallback) {
            this.onWakeWordCallback();
          }
        }
      }
    };

    this.wakeWordRecognition.onerror = (event: any) => {
      console.error('Wake word recognition error:', event.error);
      this.restartWakeWordIfNeeded(event.error);
    };

    this.wakeWordRecognition.onend = () => {
      this.state.isWakeWordListening = false;
      this.restartWakeWordIfNeeded();
    };
  }

  /**
   * Check if speech recognition is supported
   */
  private isSpeechRecognitionSupported(): boolean {
    if (typeof window === 'undefined') return false;
    
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
  }

  /**
   * Restart wake word detection if needed
   */
  private restartWakeWordIfNeeded(error?: string): void {
    if (!this.onWakeWordCallback) return;
    
    if (error !== 'aborted' && this.state.isWakeWordListening) {
      setTimeout(() => {
        this.startWakeWordDetection(this.onWakeWordCallback);
      }, 1000);
    }
  }

  /**
   * Play a sound effect
   */
  private playSound(soundPath: string, volume: number = 0.3): void {
    try {
      const audio = new Audio(soundPath);
      audio.volume = volume;
      audio.play();
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  }

  /**
   * Start listening for the wake word
   */
  public startWakeWordDetection(onWakeWord: () => void): boolean {
    if (!this.wakeWordRecognition) {
      console.error('Speech recognition not available');
      return false;
    }

    if (this.state.isWakeWordListening) return true;

    try {
      this.onWakeWordCallback = onWakeWord;
      this.wakeWordRecognition.start();
      this.state.isWakeWordListening = true;
      return true;
    } catch (error) {
      console.error('Error starting wake word detection:', error);
      return false;
    }
  }

  /**
   * Stop wake word detection
   */
  public stopWakeWordDetection(): void {
    if (!this.wakeWordRecognition || !this.state.isWakeWordListening) return;

    try {
      this.wakeWordRecognition.stop();
      this.state.isWakeWordListening = false;
    } catch (error) {
      console.error('Error stopping wake word detection:', error);
    }
  }

  /**
   * Listen for a voice command and process it with the LLM
   * Returns a promise that resolves with the LLM response
   */
  public async listenAndProcessCommand(): Promise<LLMResponse> {
    try {
      // First, listen for the command
      const command = await this.startListening();
      
      // Get current location for context if available
      let currentLocation = null;
      try {
        if (navigator.geolocation) {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
          currentLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };
        }
      } catch (error) {
        console.warn('Could not get geolocation:', error);
      }
      
      // Then process with LLM
      return await this.processWithLLM(command, {
        current_location: currentLocation,
        current_time: new Date().toLocaleTimeString(),
        current_date: new Date().toLocaleDateString()
      });
    } catch (error) {
      console.error('Error in listen and process flow:', error);
      return {
        response: 'Sorry, I had trouble processing your request.'
      };
    }
  }

  /**
   * Start listening for voice input
   */
  public startListening(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.recognition) {
        reject('Speech recognition not available');
        return;
      }
  
      if (this.state.isListening) {
        reject('Already listening');
        return;
      }
  
      // Set up temporary event handlers for this recognition session
      this.recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript.trim();
        resolve(transcript);
      };

      this.recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        reject(`Recognition error: ${event.error}`);
      };

      this.recognition.onend = () => {
        this.state.isListening = false;
      };
      
      try {
        this.recognition.start();
        this.state.isListening = true;
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop listening for voice input
   */
  public stopListening(): void {
    if (!this.recognition || !this.state.isListening) return;

    try {
      this.recognition.stop();
      this.state.isListening = false;
    } catch (error) {
      console.error('Error stopping speech recognition:', error);
    }
  }

  /**
   * Process a command with LLM
   */
  public async processWithLLM(command: string, additionalContext: any = {}): Promise<LLMResponse> {
    try {
      // Create context object with conversation state and additional context
      const contextData = {
        ...additionalContext,
        session_id: this.state.currentSessionId,
        context: "navigation"
      };
      
      const response = await fetch('/api/llm/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          query: command,
          context: contextData
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get LLM response: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Update session ID for conversation continuity
      if (data.metadata?.session_id) {
        this.state.currentSessionId = data.metadata.session_id;
      }
      
      return {
        response: data.response || 'Sorry, I could not process your request.',
        action: data.action,
        params: data.params,
        sessionId: data.metadata?.session_id
      };
    } catch (error) {
      console.error('Error processing with LLM:', error);
      return {
        response: 'Sorry, there was an error connecting to the AI assistant.'
      };
    }
  }

  /**
   * Speak text using speech synthesis
   */
  public speak(text: string, onEnd: () => void = () => {}): boolean {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      console.error('Speech synthesis not supported');
      onEnd();
      return false;
    }

    if (this.state.isMuted) {
      onEnd();
      return false;
    }

    // Cancel any ongoing speech
    this.stopSpeaking();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    
    // Use preferred voice if available
    if (this.synthesisVoice) {
      utterance.voice = this.synthesisVoice;
    }

    utterance.onstart = () => {
      this.state.isSpeaking = true;
    };

    utterance.onend = () => {
      this.state.isSpeaking = false;
      onEnd();
    };

    utterance.onerror = () => {
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
    if (typeof window === 'undefined') return;

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      this.state.isSpeaking = false;
    }
  }

  /**
   * Toggle mute/unmute state - returns new mute state
   */
  public toggleMute(): boolean {
    this.state.isMuted = !this.state.isMuted;
    
    if (this.state.isMuted && this.state.isSpeaking) {
      this.stopSpeaking();
    }
    
    return this.state.isMuted;
  }

  /**
   * Get current service state properties
   */
  public getState(): VoiceServiceState {
    return { ...this.state };
  }

  /**
   * Reset the current conversation session
   */
  public resetConversation(): void {
    this.state.currentSessionId = undefined;
  }
}

// Create singleton instance
export const voiceService = new VoiceService(); 