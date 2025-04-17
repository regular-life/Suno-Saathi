// Navigation Mode & Gemini Chat Interface
document.addEventListener('DOMContentLoaded', function() {
    // Buttons and elements
    const exitNavBtn = document.getElementById('exitNavBtn');
    const recenterBtn = document.getElementById('recenterBtn');
    const geminiFab = document.getElementById('geminiFab');
    const geminiInterface = document.getElementById('geminiInterface');
    const geminiCloseBtn = document.getElementById('geminiCloseBtn');
    const geminiInput = document.getElementById('geminiInput');
    const geminiSendBtn = document.getElementById('geminiSendBtn');
    const geminiChat = document.getElementById('geminiChat');
    const maneuverCard = document.getElementById('maneuverCard');
    const distanceRemaining = document.getElementById('distanceRemaining');
    const timeRemaining = document.getElementById('timeRemaining');
    
    // Sample navigation data (to be replaced with actual API response)
    const navigationData = {
        destination: "Coffee Shop",
        distance: "3.2 km",
        time: "12 min",
        maneuvers: [
            { instruction: "Turn right onto Main Street", distance: "0.5 km" },
            { instruction: "Continue straight for 1 km", distance: "1.0 km" },
            { instruction: "Turn left at the traffic light", distance: "0.3 km" },
            { instruction: "Your destination is on the right", distance: "0 m" }
        ]
    };
    
    // Current maneuver index
    let currentManeuverIndex = 0;
    
    // Map instance (will be initialized when navigation starts)
    let map = null;

    // Event listeners
    if (exitNavBtn) exitNavBtn.addEventListener('click', exitNavigationMode);
    if (recenterBtn) recenterBtn.addEventListener('click', recenterMap);
    if (geminiFab) geminiFab.addEventListener('click', toggleGeminiInterface);
    if (geminiCloseBtn) geminiCloseBtn.addEventListener('click', toggleGeminiInterface);
    if (geminiSendBtn) geminiSendBtn.addEventListener('click', sendGeminiMessage);
    
    // Initialize navigation mode
    function initNavigationMode(destination) {
        // Show navigation UI
        document.getElementById('navigationMode').classList.remove('hidden');
        document.getElementById('standardMode').classList.add('hidden');
        
        // Update UI with destination info
        document.getElementById('destinationName').textContent = navigationData.destination;
        distanceRemaining.textContent = navigationData.distance;
        timeRemaining.textContent = navigationData.time;
        
        // Initialize map for navigation
        initNavigationMap();
        
        // Update maneuver card with first instruction
        updateManeuverCard(0);
        
        // Set up voice recognition specifically for navigation
        // setupNavigationVoiceCommands(); // Uncomment when implemented
    }
    
    // Update the maneuver card
    function updateManeuverCard(index) {
        if (index >= 0 && index < navigationData.maneuvers.length) {
            const maneuver = navigationData.maneuvers[index];
            
            // Update the maneuver card with the current instruction
            const instructionElement = document.querySelector('#maneuverCard .instruction');
            const distanceElement = document.querySelector('#maneuverCard .distance');
            
            if (instructionElement) instructionElement.textContent = maneuver.instruction;
            if (distanceElement) distanceElement.textContent = maneuver.distance;
            
            currentManeuverIndex = index;
        }
    }
    
    // Initialize the map for navigation
    function initNavigationMap() {
        // Sample coordinates (to be replaced with actual route)
        const routeCoordinates = [
            [-73.985130, 40.748817], // Start point
            [-73.983130, 40.748417],
            [-73.981130, 40.747417],
            [-73.981130, 40.746417],
            [-73.982130, 40.744817], // End point
        ];
        
        // Create map if it doesn't exist
        if (!map && mapboxgl) {
            map = new mapboxgl.Map({
                container: 'navigationMap',
                style: 'mapbox://styles/mapbox/dark-v10', // Dark theme for navigation
                center: routeCoordinates[0],
                zoom: 15
            });
            
            // Add route to map when loaded
            map.on('load', function() {
                // Add route line
                map.addSource('route', {
                    'type': 'geojson',
                    'data': {
                        'type': 'Feature',
                        'properties': {},
                        'geometry': {
                            'type': 'LineString',
                            'coordinates': routeCoordinates
                        }
                    }
                });
                
                map.addLayer({
                    'id': 'route',
                    'type': 'line',
                    'source': 'route',
                    'layout': {
                        'line-join': 'round',
                        'line-cap': 'round'
                    },
                    'paint': {
                        'line-color': '#4285F4',
                        'line-width': 6
                    }
                });
                
                // Add start and end markers
                new mapboxgl.Marker({ color: '#4285F4' })
                    .setLngLat(routeCoordinates[0])
                    .addTo(map);
                    
                new mapboxgl.Marker({ color: '#EA4335' })
                    .setLngLat(routeCoordinates[routeCoordinates.length - 1])
                    .addTo(map);
            });
        }
    }
    
    // Recenter the map to current location/route
    function recenterMap() {
        if (map) {
            // In real implementation, this would get current user location
            // For now, just center on the first coordinate of our route
            map.flyTo({
                center: [-73.985130, 40.748817],
                zoom: 15,
                essential: true
            });
        }
    }
    
    // Exit navigation mode
    function exitNavigationMode() {
        // Show confirmation dialog
        if (confirm('Are you sure you want to exit navigation?')) {
            document.getElementById('navigationMode').classList.add('hidden');
            document.getElementById('standardMode').classList.remove('hidden');
            
            // Clean up
            currentManeuverIndex = 0;
            // Additional cleanup as needed
        }
    }
    
    // Toggle Gemini chat interface
    function toggleGeminiInterface() {
        geminiInterface.classList.toggle('hidden');
        if (!geminiInterface.classList.contains('hidden')) {
            geminiInput.focus();
        }
    }
    
    // Send message to Gemini
    function sendGeminiMessage() {
        const message = geminiInput.value.trim();
        if (!message) return;
        
        // Add user message to chat
        addChatMessage('user', message);
        geminiInput.value = '';
        
        // Simulate thinking
        const thinkingMessage = addChatMessage('assistant', '...');
        
        // Process message and generate response
        setTimeout(() => {
            // Remove thinking message
            thinkingMessage.remove();
            
            // Generate response based on input
            let response = "I'm here to help with your navigation!";
            
            if (message.toLowerCase().includes('how far')) {
                response = `You're about ${distanceRemaining.textContent} away from your destination.`;
            } else if (message.toLowerCase().includes('how long')) {
                response = `You'll arrive in approximately ${timeRemaining.textContent}.`;
            } else if (message.toLowerCase().includes('next')) {
                const nextIndex = currentManeuverIndex + 1;
                if (nextIndex < navigationData.maneuvers.length) {
                    updateManeuverCard(nextIndex);
                    response = `Updated to next direction: ${navigationData.maneuvers[nextIndex].instruction}`;
                } else {
                    response = "You've reached your destination!";
                }
            } else if (message.toLowerCase().includes('previous')) {
                const prevIndex = currentManeuverIndex - 1;
                if (prevIndex >= 0) {
                    updateManeuverCard(prevIndex);
                    response = `Updated to previous direction: ${navigationData.maneuvers[prevIndex].instruction}`;
                } else {
                    response = "This is the first direction.";
                }
            } else if (message.toLowerCase().includes('stop') || message.toLowerCase().includes('exit')) {
                response = "To exit navigation, tap the exit button in the top left corner.";
            } else if (message.toLowerCase().includes('nearby') || message.toLowerCase().includes('find')) {
                if (message.toLowerCase().includes('gas') || message.toLowerCase().includes('petrol')) {
                    response = "I found 3 gas stations nearby. The closest is Shell, 0.5 km ahead on your right.";
                } else if (message.toLowerCase().includes('food') || message.toLowerCase().includes('restaurant')) {
                    response = "There are several restaurants nearby. The closest is Cafe Milano, 0.3 km ahead.";
                } else if (message.toLowerCase().includes('park')) {
                    response = "There's a parking garage 0.2 km ahead on your left.";
                } else {
                    response = "What kind of place are you looking for nearby?";
                }
            }
            
            // Add assistant response
            addChatMessage('assistant', response);
            
            // Auto-scroll to bottom
            geminiChat.scrollTop = geminiChat.scrollHeight;
        }, 1000);
    }
    
    // Add a message to the chat
    function addChatMessage(sender, text) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${sender}-message`;
        messageDiv.textContent = text;
        geminiChat.appendChild(messageDiv);
        
        // Auto-scroll to bottom
        geminiChat.scrollTop = geminiChat.scrollHeight;
        
        return messageDiv;
    }
    
    // Enter key to send message
    if (geminiInput) {
        geminiInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendGeminiMessage();
            }
        });
    }
    
    // For testing: Initialize navigation mode (in real app, this would be called from route selection)
    // Uncomment the following line to test
    // initNavigationMode("Coffee Shop");
}); 