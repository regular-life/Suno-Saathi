// Enhanced Voice Recognition Module with broader browser support and fallbacks
document.addEventListener('DOMContentLoaded', function() {
    // Initialize essential variables
    let recognition = null;
    let isListening = false;
    let recognitionTimeout = null;
    let retryCount = 0;
    const MAX_RETRIES = 3;
    
    // Voice indicators and elements
    const micButton = document.getElementById('mic-button');
    const voiceModal = document.getElementById('voiceModal');
    const closeButton = document.getElementById('closeModal');
    const voiceStatus = document.getElementById('voiceStatus');
    const voiceText = document.getElementById('voiceText');
    const progressBar = document.getElementById('progressBar');
    const commandsList = document.getElementById('commandsList');
    const waitingText = document.getElementById('waitingText');
    
    // Commands configuration
    const COMMANDS = {
        NAVIGATION: [
            "Navigate to [location]",
            "Go to [location]",
            "Take me to [location]",
            "Show me directions to [destination]",
            "Route to [destination]"
        ],
        SEARCH: [
            "Find [place type] nearby",
            "Where is the nearest [place]",
            "Search for [place]"
        ],
        MAP_CONTROL: [
            "Show traffic",
            "Hide traffic",
            "Zoom in",
            "Zoom out",
            "Satellite view",
            "Map view",
            "Recenter map"
        ],
        LOCATION: [
            "Where am I",
            "Show my location",
            "What's my current location"
        ],
        NAVIGATION_CONTROL: [
            "Start navigation",
            "Exit navigation",
            "End navigation",
            "Cancel navigation"
        ]
    };
    
    // Create voice animation dynamically
    initializeVoiceAnimation();
    
    // Populate commands list
    populateCommandsList();
    
    // Initialize speech recognition with best available API
    initializeSpeechRecognition();
    
    // Make recognition available globally for other modules
    window.voiceRecognition = {
        startListening: startVoiceRecognition,
        stopListening: stopVoiceRecognition,
        isListening: () => isListening,
        showVoiceModal: showModal,
        hideVoiceModal: hideModal
    };
    
    // Add event listeners
    setupEventListeners();
    
    // Log success for debugging
    console.log("Voice Recognition module loaded successfully");
    
    /**
     * Initialize the voice animation bars
     */
    function initializeVoiceAnimation() {
        console.log("Initializing voice animation");
        const voiceAnimation = document.createElement('div');
        voiceAnimation.className = 'voice-animation';
        voiceAnimation.id = 'voiceAnimation';
        
        // Create voice bars
        for (let i = 0; i < 5; i++) {
            const voiceBar = document.createElement('div');
            voiceBar.className = 'voice-bar';
            voiceAnimation.appendChild(voiceBar);
        }
        
        // Insert voice animation after progress bar
        const progressContainer = document.querySelector('.progress-container');
        if (progressContainer) {
            progressContainer.parentNode.insertBefore(voiceAnimation, progressContainer.nextSibling);
            console.log("Voice animation added to DOM");
        } else {
            console.error("Progress container not found for voice animation");
        }
    }
    
    /**
     * Populate commands list with all available commands
     */
    function populateCommandsList() {
        // Clear existing commands
        if (!commandsList) return;
        commandsList.innerHTML = '';
        
        // Flatten all command categories
        const allCommands = [].concat(...Object.values(COMMANDS));
        
        // Add each command with appropriate styling
        allCommands.forEach(command => {
            const li = document.createElement('li');
            
            // For commands with placeholders, highlight the placeholder
            if (command.includes('[') && command.includes(']')) {
                const parts = command.split(/(\[[^\]]+\])/);
                
                parts.forEach(part => {
                    if (part.startsWith('[') && part.endsWith(']')) {
                        // This is a placeholder, style it differently
                        const span = document.createElement('span');
                        span.className = 'command-placeholder';
                        span.textContent = part;
                        span.style.fontStyle = 'italic';
                        span.style.color = '#4285f4';
                        li.appendChild(span);
                    } else {
                        // Regular command text
                        li.appendChild(document.createTextNode(part));
                    }
                });
            } else {
                // Simple command without placeholder
                li.textContent = command;
            }
            
            commandsList.appendChild(li);
        });
    }
    
    /**
     * Set up all event listeners
     */
    function setupEventListeners() {
        // Mic button starts voice recognition
        if (micButton) {
            micButton.addEventListener('click', function(e) {
                e.preventDefault();
                console.log("Mic button clicked");
                showModal();
                setTimeout(() => {
                    startVoiceRecognition();
                }, 300);
            });
        } else {
            console.error("Mic button not found in the DOM");
        }
        
        // Close button stops recognition
        if (closeButton) {
            closeButton.addEventListener('click', function(e) {
                e.preventDefault();
                console.log("Close button clicked");
                stopVoiceRecognition();
                hideModal();
            });
        } else {
            console.error("Close button not found in the DOM");
        }
        
        // Listen for page visibility changes to handle background/foreground transitions
        document.addEventListener('visibilitychange', function() {
            if (document.hidden && isListening) {
                // Pause recognition when page is in background
                console.log("Page hidden, stopping voice recognition");
                stopVoiceRecognition();
            }
        });
    }
    
    /**
     * Initialize speech recognition with best available API
     */
    function initializeSpeechRecognition() {
        // Check for browser support - try multiple APIs
        const SpeechRecognition = 
            window.SpeechRecognition || 
            window.webkitSpeechRecognition || 
            window.mozSpeechRecognition || 
            window.msSpeechRecognition;
        
        if (!SpeechRecognition) {
            console.error("Speech Recognition not supported in this browser");
            updateVoiceUIForUnsupportedBrowser();
            return false;
        }
        
        try {
            // Create recognition instance
            recognition = new SpeechRecognition();
            
            // Configure recognition
            recognition.continuous = false;
            recognition.interimResults = true;
            recognition.lang = 'en-US';
            
            // Set up event handlers
            setupRecognitionEvents();
            
            console.log("Speech Recognition initialized successfully");
            return true;
        } catch (error) {
            console.error("Error initializing speech recognition:", error);
            updateVoiceUIForUnsupportedBrowser();
            return false;
        }
    }
    
    /**
     * Update UI to show speech recognition is not supported
     */
    function updateVoiceUIForUnsupportedBrowser() {
        if (micButton) {
            micButton.disabled = true;
            micButton.title = "Voice recognition not supported in your browser";
            micButton.style.opacity = "0.5";
        }
        
        if (voiceStatus) {
            voiceStatus.textContent = "Voice recognition not supported in your browser";
        }
        
        if (waitingText) {
            waitingText.textContent = "Please try using Chrome, Edge, or Safari";
        }
        
        if (commandsList) {
            commandsList.style.display = "none";
        }
        
        if (progressBar && progressBar.parentElement) {
            progressBar.parentElement.style.display = "none";
        }
    }
    
    /**
     * Set up recognition event listeners
     */
    function setupRecognitionEvents() {
        if (!recognition) return;
        
        // On start
        recognition.onstart = function() {
            console.log("Voice recognition started");
            isListening = true;
            updateVoiceUI("Listening...", "Speak now", true);
            
            // Set a timeout to stop recognition if it runs too long
            clearTimeout(recognitionTimeout);
            recognitionTimeout = setTimeout(() => {
                if (isListening) {
                    stopVoiceRecognition();
                    updateVoiceUI("Listening timed out", "Try again with a shorter command", false);
                }
            }, 10000); // 10 seconds timeout
        };
        
        // On result
        recognition.onresult = function(event) {
            clearTimeout(recognitionTimeout);
            
            const last = event.results.length - 1;
            const transcript = event.results[last][0].transcript.trim();
            
            // Display recognized text
            if (voiceText) voiceText.textContent = transcript;
            displayRecognizedSpeech(transcript);
            
            // Update confidence display
            const confidence = event.results[last][0].confidence;
            if (progressBar) progressBar.style.width = Math.round(confidence * 100) + '%';
            
            // Process if final
            if (event.results[last].isFinal) {
                updateVoiceUI("Processing...", transcript, false);
                processCommand(transcript);
            }
        };
        
        // On end
        recognition.onend = function() {
            console.log("Voice recognition ended");
            isListening = false;
            clearTimeout(recognitionTimeout);
            
            // Only update UI if we haven't already processed a command
            if (voiceStatus && voiceStatus.textContent === "Listening...") {
                updateVoiceUI("No speech detected", "Click microphone to try again", false);
            }
            
            // Reset retry counter after successful completion
            retryCount = 0;
        };
        
        // On error
        recognition.onerror = function(event) {
            console.error("Recognition error:", event.error);
            isListening = false;
            clearTimeout(recognitionTimeout);
            
            // Handle different error types
            let errorMessage = "Error: " + event.error;
            let instruction = "Try again";
            
            switch (event.error) {
                case 'no-speech':
                    errorMessage = "No speech detected";
                    instruction = "Please try speaking again";
                    
                    // Auto-restart if no speech was detected (with limits)
                    if (retryCount < MAX_RETRIES) {
                        retryCount++;
                        setTimeout(() => {
                            if (voiceModal.style.display !== 'none') {
                                startVoiceRecognition();
                            }
                        }, 1000);
                    }
                    break;
                case 'audio-capture':
                    errorMessage = "No microphone detected";
                    instruction = "Check your microphone connection";
                    break;
                case 'not-allowed':
                    errorMessage = "Microphone access denied";
                    instruction = "Please enable microphone access in your browser settings";
                    break;
                case 'network':
                    errorMessage = "Network error occurred";
                    instruction = "Check your internet connection";
                    break;
                case 'aborted':
                    errorMessage = "Recognition was aborted";
                    instruction = "Click microphone to try again";
                    break;
            }
            
            updateVoiceUI(errorMessage, instruction, false);
        };
    }
    
    /**
     * Update the voice UI with status and waiting text
     * @param {string} status - Status message to display
     * @param {string} waitText - Instruction or waiting text
     * @param {boolean} isActive - Whether to show active animation
     */
    function updateVoiceUI(status, waitText, isActive) {
        if (voiceStatus) voiceStatus.textContent = status;
        if (waitingText) waitingText.textContent = waitText;
        
        isActive ? animateVoiceBars(true) : animateVoiceBars(false);
    }
    
    /**
     * Start voice recognition
     */
    function startVoiceRecognition() {
        // Check if already initialized
        if (!recognition && !initializeSpeechRecognition()) {
            showNotification("Voice recognition is not supported in your browser", "error");
            return;
        }
        
        // Ensure we're not already listening
        if (isListening) {
            stopVoiceRecognition();
        }
        
        // Reset UI
        resetVoiceUI();
        
        try {
            recognition.start();
            console.log("Started voice recognition");
        } catch (error) {
            console.error("Error starting recognition:", error);
            
            // Handle already started error (can happen with some browsers)
            if (error.name === 'InvalidStateError') {
                try {
                    recognition.stop();
                    setTimeout(() => {
                        recognition.start();
                    }, 200);
                } catch (e) {
                    showNotification("Failed to start voice recognition. Please try again.", "error");
                }
            } else {
                showNotification("Voice recognition error: " + error.message, "error");
            }
        }
    }
    
    /**
     * Stop voice recognition
     */
    function stopVoiceRecognition() {
        if (recognition && isListening) {
            try {
                recognition.stop();
                clearTimeout(recognitionTimeout);
                isListening = false;
                console.log("Stopped voice recognition");
            } catch (error) {
                console.error("Error stopping recognition:", error);
            }
        }
    }
    
    /**
     * Process recognized command
     * @param {string} command - The recognized command
     */
    function processCommand(command) {
        console.log("Processing command:", command);
        const cmdLower = command.toLowerCase();
        
        // Navigation commands
        if (
            cmdLower.includes("navigate to") || 
            cmdLower.includes("go to") || 
            cmdLower.includes("take me to")
        ) {
            const locationRegex = /(?:navigate|go|take me) to (.+)/i;
            const match = command.match(locationRegex);
            if (match && match[1]) {
                const location = match[1].trim();
                navigateToLocation(location);
            }
        } 
        // Find nearby places
        else if (
            cmdLower.includes("find") && cmdLower.includes("nearby") ||
            cmdLower.includes("where is the nearest") ||
            cmdLower.includes("show me nearby")
        ) {
            let placeType = "";
            if (cmdLower.includes("find")) {
                const match = command.match(/find (.+?) nearby/i);
                if (match) placeType = match[1];
            } else if (cmdLower.includes("where is the nearest")) {
                const match = command.match(/where is the nearest (.+)/i);
                if (match) placeType = match[1];
            } else if (cmdLower.includes("show me nearby")) {
                const match = command.match(/show me nearby (.+)/i);
                if (match) placeType = match[1];
            }
            
            if (placeType) {
                findNearbyPlaces(placeType);
            }
        }
        // Traffic
        else if (cmdLower.includes("show traffic")) {
            toggleTraffic(true);
        }
        else if (cmdLower.includes("hide traffic")) {
            toggleTraffic(false);
        }
        // Map controls
        else if (cmdLower.includes("zoom in")) {
            zoomMap(1);
        }
        else if (cmdLower.includes("zoom out")) {
            zoomMap(-1);
        }
        else if (cmdLower.includes("satellite view")) {
            changeMapView("satellite");
        }
        else if (cmdLower.includes("map view")) {
            changeMapView("map");
        }
        else if (cmdLower.includes("recenter") || cmdLower.includes("center map")) {
            recenterMapView();
        }
        // Location
        else if (cmdLower.includes("where am i") || cmdLower.includes("show my location")) {
            showMyLocation();
        }
        // Navigation controls
        else if (cmdLower.includes("start navigation")) {
            startNavigation();
        }
        else if (
            cmdLower.includes("exit navigation") || 
            cmdLower.includes("end navigation") || 
            cmdLower.includes("cancel navigation") || 
            cmdLower.includes("stop navigation")
        ) {
            exitNavigationMode();
        }
        // If no match, send to assistant
        else {
            sendToAssistant(command);
        }
        
        // Hide modal after processing (with delay)
        setTimeout(hideModal, 1500);
    }
    
    // Rest of the functions (navigateToLocation, findNearbyPlaces, etc.) remain similar...
    // ... existing code for command handlers ...
    
    /**
     * Show the voice recognition modal
     */
    function showModal() {
        console.log("Showing voice modal");
        if (!voiceModal) {
            console.error("Voice modal element not found");
            return;
        }
        
        // Reset UI components
        resetVoiceUI();
        
        // Force display block first (important for transition)
        voiceModal.style.display = 'flex';
        
        // Defer opacity change to allow transition
        setTimeout(() => {
            voiceModal.style.opacity = '1';
            
            // Also unhide the content with transform
            const content = voiceModal.querySelector('.voice-modal-content');
            if (content) {
                content.style.transform = 'translateY(0)';
                content.style.opacity = '1';
            }
        }, 10);
        
        console.log("Voice modal displayed");
        
        // Add event listener to close on background click
        voiceModal.addEventListener('click', function(e) {
            if (e.target === voiceModal) {
                stopVoiceRecognition();
                hideModal();
            }
        });
    }
    
    /**
     * Hide the voice recognition modal
     */
    function hideModal() {
        console.log("Hiding voice modal");
        if (!voiceModal) {
            console.error("Voice modal element not found");
            return;
        }
        
        // Start transition
        voiceModal.style.opacity = '0';
        
        // Also hide the content with transform
        const content = voiceModal.querySelector('.voice-modal-content');
        if (content) {
            content.style.transform = 'translateY(20px)';
            content.style.opacity = '0.95';
        }
        
        // Wait for transition before fully hiding
        setTimeout(() => {
            voiceModal.style.display = 'none';
        }, 300);
        
        console.log("Voice modal hidden");
    }
    
    /**
     * Reset the voice UI
     */
    function resetVoiceUI() {
        if (voiceStatus) voiceStatus.textContent = 'Listening...';
        if (voiceText) voiceText.textContent = '';
        if (progressBar) progressBar.style.width = '0%';
        if (waitingText) waitingText.textContent = 'Speak now';
        stopVoiceBarsAnimation();
    }
    
    /**
     * Animate voice bars
     * @param {boolean} isActive - Whether to animate the bars
     */
    function animateVoiceBars(isActive) {
        const voiceAnimation = document.getElementById('voiceAnimation');
        if (!voiceAnimation) return;
        
        const voiceBars = voiceAnimation.querySelectorAll('.voice-bar');
        
        if (isActive) {
            voiceAnimation.style.display = 'flex';
            voiceBars.forEach((bar, index) => {
                setTimeout(() => {
                    startVoiceBarAnimation(bar);
                }, index * 50);
            });
        } else {
            stopVoiceBarsAnimation();
        }
    }
    
    /**
     * Start animation for a single voice bar
     * @param {HTMLElement} bar - The voice bar element
     */
    function startVoiceBarAnimation(bar) {
        const height = Math.floor(Math.random() * 30) + 10;
        bar.style.height = `${height}px`;
        
        if (isListening) {
            setTimeout(() => {
                startVoiceBarAnimation(bar);
            }, Math.random() * 200 + 50);
        }
    }
    
    /**
     * Stop voice bars animation
     */
    function stopVoiceBarsAnimation() {
        const voiceAnimation = document.getElementById('voiceAnimation');
        if (!voiceAnimation) return;
        
        const voiceBars = voiceAnimation.querySelectorAll('.voice-bar');
        voiceBars.forEach(bar => {
            bar.style.height = '10px';
            bar.style.animation = 'none';
        });
    }
    
    /**
     * Display recognized speech in various places
     * @param {string} text - Recognized speech text
     */
    function displayRecognizedSpeech(text) {
        // Update main voice text
        const voiceText = document.getElementById('voice-text');
        if (voiceText) {
            voiceText.textContent = text;
        }
        
        // Update compact view feedback if available
        const voiceFeedbackText = document.getElementById('voice-feedback-text');
        if (voiceFeedbackText) {
            voiceFeedbackText.textContent = text;
        }
    }
    
    /**
     * Show notification
     * @param {string} message - Notification message
     * @param {string} type - Notification type (info, success, error)
     */
    function showNotification(message, type = 'info') {
        // Use global notification function if available
        if (window.showNotification) {
            window.showNotification(message, type);
            return;
        }
        
        // Fallback implementation
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.position = 'fixed';
        notification.style.bottom = '20px';
        notification.style.left = '50%';
        notification.style.transform = 'translateX(-50%)';
        notification.style.padding = '10px 20px';
        notification.style.borderRadius = '5px';
        notification.style.backgroundColor = type === 'error' ? '#f44336' : 
                                            type === 'success' ? '#4CAF50' : '#2196F3';
        notification.style.color = 'white';
        notification.style.zIndex = '9999';
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.5s';
            setTimeout(() => notification.remove(), 500);
        }, 3000);
    }
}); 