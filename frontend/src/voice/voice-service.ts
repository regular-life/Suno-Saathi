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
  status?: string;
  destinationChange?: string;
}

// Voice service state
interface VoiceServiceState {
  isListening: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
  isWakeWordListening: boolean;
  isProcessing: boolean;
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
    isWakeWordListening: false,
    isProcessing: false
  };

  private onWakeWordCallback: (() => void) | null = null;
  private statusUpdateCallback: ((status: string) => void) | null = null;

  // Whether assistant mode is active
  private assistantActive: boolean = false;

  // Callback when LLM instructs a destination change
  private changeDestinationCallback: ((destination: string) => void) | null = null;

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
    
    // Load voices and select preferred voice (in priority order)
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      
      // Define preferred voice models in priority order
      const preferredVoices = [
        'Hindi+anika',
        'Hindi+Annie',
        'Hindi+female1',
        'en-IN+female',
        'hi-IN',
        'en-IN'
      ];
      
      // Try to find voices in order of preference
      for (const preferredVoice of preferredVoices) {
        const voice = voices.find(voice => 
          voice.name.includes(preferredVoice) || 
          voice.lang.includes(preferredVoice)
        );
        
        if (voice) {
          this.synthesisVoice = voice;
          console.log(`Selected voice: ${voice.name} (${voice.lang})`);
          break;
        }
      }
      
      // If no preferred voice found, fall back to any female voice
      if (!this.synthesisVoice) {
        this.synthesisVoice = voices.find(voice => 
          voice.name.toLowerCase().includes('female')
        ) || null;
        
        if (this.synthesisVoice) {
          console.log(`Fallback voice: ${this.synthesisVoice.name} (${this.synthesisVoice.lang})`);
        } else {
          console.log('No preferred voice found, using system default');
        }
      }
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
    this.wakeWordRecognition.onresult = async (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.trim().toLowerCase();
        console.log('[Wake Word Debug] Heard:', transcript);
        this.updateStatus(`Heard: ${transcript}`);

        // Attempt backend detection
        let detected = false;
        try {
          detected = await this.detectWakeWordWithBackend(transcript);
          console.log('[Wake Word Debug] Backend detected:', detected);
        } catch (error) {
          console.warn('Error with backend wake word detection, will use local fallback', error);
        }

        // Local fallback if backend did not detect
        if (!detected) {
          const similarity = this.stringSimilarity(WAKE_WORD, transcript);
          console.log(`[Wake Word Debug] Local similarity: ${similarity}`);
          if (similarity >= WAKE_WORD_THRESHOLD) {
            detected = true;
            console.log('Wake word detected locally with similarity:', similarity);
          }
        }

        if (detected) {
          // Wake word detected
          this.stopWakeWordDetection();
          this.playSound(WAKE_SOUND_PATH);
          if (this.onWakeWordCallback) {
            this.onWakeWordCallback();
          }
          return;
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
        if (this.onWakeWordCallback) {
          this.startWakeWordDetection(this.onWakeWordCallback);
        }
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
   * Detect wake word using backend API
   */
  private async detectWakeWordWithBackend(text: string): Promise<boolean> {
    try {
      // Build full backend URL using environment variable
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const url = apiBase.endsWith('/')
        ? `${apiBase}api/wake/detect`
        : `${apiBase}/api/wake/detect`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });
      
      if (!response.ok) {
        throw new Error(`Backend API error: ${response.status}`);
      }
      
      const data = await response.json();
      return data.detected === true;
    } catch (error) {
      console.error('Error detecting wake word with backend:', error);
      return false;
    }
  }

  /**
   * Set status update callback
   */
  public setStatusUpdateCallback(callback: (status: string) => void): void {
    this.statusUpdateCallback = callback;
  }

  /**
   * Update status if callback is set
   */
  private updateStatus(status: string): void {
    if (this.statusUpdateCallback) {
      this.statusUpdateCallback(status);
    }
  }

  /**
   * Start listening for the wake word
   */
  public startWakeWordDetection(onWakeWord: () => void): boolean {
    if (!this.isSpeechRecognitionSupported() || !this.wakeWordRecognition) {
      console.error('Speech recognition not available');
      this.updateStatus('Speech recognition not supported');
      return false;
    }

    if (this.state.isWakeWordListening) return true;

    try {
      this.onWakeWordCallback = onWakeWord;
      this.wakeWordRecognition.start();
      this.state.isWakeWordListening = true;
      this.updateStatus('Listening for wake word...');
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
   * Start the continuous assistant mode: listen for wake word, process commands
   */
  public startAssistant(): boolean {
    if (!this.isSpeechRecognitionSupported()) {
      this.updateStatus('Speech recognition not supported');
      return false;
    }
    if (this.assistantActive) return true;
    this.assistantActive = true;
    // Request mic permission
    navigator.mediaDevices.getUserMedia({ audio: true }).catch(err => {
      console.error('Microphone permission denied', err);
      this.updateStatus('Microphone permission required');
      this.assistantActive = false;
    });
    this.updateStatus('Listening for wake word...');
    this.startWakeWordMode();
    return true;
  }

  /**
   * Stop the assistant mode
   */
  public stopAssistant(): void {
    this.assistantActive = false;
    this.stopWakeWordDetection();
    this.stopListening();
    this.updateStatus('Idle');
  }

  /**
   * Internal: start wake word detection with assistant callback
   */
  private startWakeWordMode(): void {
    this.startWakeWordDetection(async () => {
      // On wake word detected
      await this.handleCommandCycle();
    });
  }

  /**
   * Internal: after wake word, listen for command, send to LLM, speak, then restart wake word
   */
  private async handleCommandCycle(): Promise<void> {
    if (!this.assistantActive) return;
    
    // Listen for user command after wake word
    this.updateStatus('Listening for command...');
    const command = await this.listenWithSilenceTimeout(3000); // Increased timeout for better detection
    
    // Validate command
    if (!command || command.trim().length < 2) {
      this.updateStatus('No clear command detected.');
      this.speak("I didn't catch that. Please try again.", () => {
        if (this.assistantActive) this.startWakeWordMode();
      });
      return;
    }
    
    // Process with LLM
    this.updateStatus('Processing your request...');
    
    try {
      const llmResponse = await this.processWithLLM(command, {});
      
      // Check for destination change before speaking
      if (llmResponse && llmResponse.destinationChange) {
        this.updateStatus(`Changing destination to ${llmResponse.destinationChange}...`);
        
        // Play a special confirmation sound for destination changes
        this.playSound('/sounds/navigation-update.mp3', 0.5);
        
        // Add a small delay to let the map update before speaking
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Speak the response
      if (llmResponse && llmResponse.response) {
        this.updateStatus('Speaking response...');
        await new Promise<void>(resolve => this.speak(llmResponse.response, resolve));
      }
    } catch (error) {
      console.error('Error in command cycle:', error);
      this.speak("Sorry, I encountered an error processing your request. Please try again.", () => {});
    } finally {
      // Restart wake word listening
      if (this.assistantActive) {
        this.updateStatus('Listening for wake word...');
        this.startWakeWordMode();
      }
    }
  }

  /**
   * Process full voice interaction - from activation to response
   * This is the main entry point for the voice interaction flow
   */
  public async processVoiceInteraction(): Promise<boolean> {
    try {
      // Initialize recognition systems
      if (!this.recognition) {
        this.initSpeechRecognition();
      }
      if (!this.wakeWordRecognition) {
        this.initWakeWordRecognition();
      }

      // Request microphone access permission first (to prompt browser)
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (err) {
          console.error('Microphone permission denied', err);
          this.updateStatus('Microphone permission is required');
          return false;
        }
      }

      // Check if speech recognition is supported
      if (!this.isSpeechRecognitionSupported() || !this.wakeWordRecognition) {
        this.updateStatus('Speech recognition not supported in this browser');
        return false;
      }

      // Step 1: Start listening for wake word
      this.updateStatus('Listening for wake word...');
      
      // Create a promise that resolves when wake word is detected
      const wakeWordPromise = new Promise<void>((resolve) => {
        this.startWakeWordDetection(() => {
          resolve();
        });
      });
      
      // Wait until wake word is detected (no timeout)
      await wakeWordPromise;
      // Stop wake word detection once detected
      this.stopWakeWordDetection();
      
      // Step 2: Wake word detected, now listen for command (5s silence timeout)
      this.updateStatus('Listening for command...');
      const command = await this.listenWithSilenceTimeout(5000);
      
      // Validate command
      if (!command || command.trim().length < 2) {
        this.updateStatus('No clear command detected');
        await new Promise<void>((resolve) => {
          this.speak("I didn't catch that. Please try again.", resolve);
        });
        this.updateStatus('Idle');
        return false;
      }
      
      // Step 3: Process command with LLM
      this.updateStatus('Processing your request...');
      this.state.isProcessing = true;
      
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
      
      // Process with LLM including context
      const llmResponse = await this.processWithLLM(command, {
        current_location: currentLocation,
        current_time: new Date().toLocaleTimeString(),
        current_date: new Date().toLocaleDateString()
      });
      
      this.state.isProcessing = false;
      
      // Check for destination change
      if (llmResponse && llmResponse.destinationChange) {
        this.updateStatus(`Changing destination to ${llmResponse.destinationChange}...`);
        
        // Play a special confirmation sound for destination changes
        this.playSound('/sounds/navigation-update.mp3', 0.5);
        
        // Add a small delay to let the map update before speaking
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Step 4: Speak the response
      if (llmResponse && llmResponse.response) {
        this.updateStatus('Speaking response...');
        await new Promise<void>((resolve) => {
          this.speak(llmResponse.response, resolve);
        });
        this.updateStatus('Idle');
        return true;
      } else {
        this.updateStatus('Error processing request');
        return false;
      }
      
    } catch (error) {
      console.error('Error in voice interaction flow:', error);
      this.state.isProcessing = false;
      this.updateStatus('Error processing voice interaction');
      return false;
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
        // Debug output - show command heard
        console.log('[Command Debug] Heard:', transcript);
        this.updateStatus(`Command: ${transcript}`);
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
      // Safety check for empty command
      if (!command || command.trim() === '') {
        console.warn('Empty command received in processWithLLM');
        return {
          response: 'I didn\'t catch that. Could you please repeat?',
          status: 'error'
        };
      }

      // Create context object with conversation state and additional context
      const contextData = {
        ...additionalContext,
        session_id: this.state.currentSessionId,
        context: "navigation"
      };

      console.log('Processing command:', command);
      console.log('With context:', JSON.stringify(contextData, null, 2));

      // Attempt direct FastAPI LLM endpoint
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const llmUrl = apiBase.endsWith('/')
        ? `${apiBase}api/llm/query`
        : `${apiBase}/api/llm/query`;

      let response: Response;
      let usedBackend = true;
      let errorDetails = '';

      try {
        console.log('Requesting backend API:', llmUrl);
        const postData = { query: command, context: contextData };
        console.log('Request data:', JSON.stringify(postData, null, 2));
        
        response = await fetch(llmUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(postData),
        });
        
        if (!response.ok) {
          try {
            errorDetails = await response.text();
            console.error('Backend API error response:', errorDetails);
          } catch (e) {
            console.error('Could not read error response text', e);
          }
        }
      } catch (err) {
        console.warn('Direct backend LLM fetch error, falling back to Next.js API:', err);
        usedBackend = false;
        response = await fetch('/api/llm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: command, sessionId: this.state.currentSessionId }),
        });
      }

      if (!response.ok) {
        if (usedBackend) {
          console.warn('Direct backend LLM returned status', response.status, 'falling back to Next.js API');
          console.warn('Error details:', errorDetails);
          usedBackend = false;
          
          // Simplify the request for fallback
          const fallbackData = { 
            query: command.substring(0, 200), // Limit query length for fallback
            sessionId: this.state.currentSessionId 
          };
          console.log('Fallback request:', JSON.stringify(fallbackData, null, 2));
          
          response = await fetch('/api/llm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fallbackData),
          });
        }
      }

      if (!response.ok) {
        // Try to get error details
        let finalErrorDetails = '';
        try {
          finalErrorDetails = await response.text();
        } catch (e) {
          console.error('Could not read final error response', e);
        }

        throw new Error(`Failed to get LLM response after fallback: ${response.status} - ${finalErrorDetails}`);
      }

      const data = await response.json();
      console.log('LLM API response:', JSON.stringify(data, null, 2));
      
      // If used Next.js API, newSessionId is in data.sessionId
      if (!usedBackend && data.sessionId) {
        this.state.currentSessionId = data.sessionId;
      }

      // Check for destination change instruction
      let destChange: string | undefined = data.metadata?.destination_change;
      
      // If no destination_change in metadata, check response text for the trigger phrase
      if (!destChange && data.response) {
        const lowerResponse = data.response.toLowerCase();
        // Check for both formats of the trigger phrase
        const triggers = ["okay, changing destination to", "okay changing destination to"];
        for (const trigger of triggers) {
          if (lowerResponse.includes(trigger)) {
            // Extract destination from the response text
            const startIndex = lowerResponse.indexOf(trigger) + trigger.length;
            destChange = data.response.substring(startIndex).trim();
            break;
          }
        }
      }
      
      if (destChange && this.changeDestinationCallback) {
        console.log("Detected destination change to:", destChange);
        this.changeDestinationCallback(destChange);
      }
      
      return {
        response: data.response || 'Sorry, I could not process your request.',
        action: data.action,
        params: data.params,
        sessionId: data.metadata?.session_id,
        status: data.status,
        destinationChange: destChange
      };
    } catch (error) {
      console.error('Error processing with LLM:', error);
      return {
        response: 'Sorry, there was an error connecting to the AI assistant. Please check your internet connection and try again.',
        status: 'error'
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

  /**
   * Listen for a voice command until silence timeout then return transcript
   */
  private listenWithSilenceTimeout(timeoutMs: number = 5000): Promise<string> {
    return new Promise((resolve) => {
      if (!this.recognition) {
        this.initSpeechRecognition();
      }
      const recognition = this.recognition!;
      recognition.continuous = false;
      recognition.interimResults = false;

      let transcript = '';
      let silenceTimer: number;

      const clearHandlers = () => {
        clearTimeout(silenceTimer);
        recognition.onresult = null!;
        recognition.onerror = null!;
        recognition.onend = null!;
      };

      recognition.onresult = (event: any) => {
        transcript = event.results[0][0].transcript.trim();
        clearHandlers();
        resolve(transcript);
      };

      recognition.onerror = (_event: any) => {
        clearHandlers();
        resolve(transcript);
      };

      recognition.onend = () => {
        clearHandlers();
        resolve(transcript);
      };

      // Stop listening after timeoutMs of silence
      silenceTimer = window.setTimeout(() => {
        recognition.stop();
      }, timeoutMs);

      recognition.start();
      this.state.isListening = true;
    });
  }

  /** Register a callback to handle destination changes signaled by the LLM */
  public setChangeDestinationCallback(callback: (destination: string) => void): void {
    this.changeDestinationCallback = callback;
  }
}

// Create and export a singleton instance
export const voiceService = new VoiceService(); 