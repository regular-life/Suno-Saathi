/**
 * Configuration settings for Suno Saarthi application
 */

const CONFIG = {
    // Mapbox API access token - retrieved from secrets.js
    mapboxToken: getAPIKey('MAPBOX_TOKEN'),
    
    // Default map settings
    map: {
        style: 'mapbox://styles/mapbox/streets-v12', // Map style
        center: [77.2090, 28.6139], // Default center (Delhi)
        zoom: 12, // Default zoom level
        minZoom: 2, // Minimum zoom allowed
        maxZoom: 19, // Maximum zoom allowed
        pitch: 0, // Default pitch
        bearing: 0, // Default bearing
        interactive: true // Allow user interaction with the map
    },
    
    // Backend API configuration
    api: {
        baseUrl: 'http://localhost:8000/api', // Base URL for backend API
        endpoints: {
            directions: '/navigation/directions',
            traffic: '/navigation/traffic',
            places: '/navigation/places',
            query: '/navigation/query',
            llmGenerate: '/llm/generate',
            llmNavigation: '/llm/navigation',
            wakeDetect: '/wake/detect'
        }
    },
    
    // Voice recognition settings
    voice: {
        lang: 'en-IN', // Language for speech recognition
        continuous: false, // Whether to continuously record
        interimResults: true, // Whether to return interim results
        maxAlternatives: 1 // Maximum number of alternatives to return
    },
    
    // Navigation settings
    navigation: {
        defaultMode: 'driving', // Default transportation mode
        alternatives: true, // Whether to show alternative routes
        defaultLanguage: 'en', // Default language for directions
        routeSteps: {
            maxDisplay: 10 // Maximum number of steps to display at once
        }
    },
    
    // UI settings
    ui: {
        animationDuration: 500, // Duration for UI animations in milliseconds
        toastDuration: 3000, // How long toast notifications stay visible
        mobileBreakpoint: 768, // Mobile breakpoint width in pixels
        mapControlPosition: 'top-right', // Position of map controls
        mapControlMargin: 10 // Margin for map controls in pixels
    }
};

// Prevent modification of the configuration object
Object.freeze(CONFIG); 