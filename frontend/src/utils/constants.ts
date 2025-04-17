export const DEFAULT_CENTER = { lat: 28.6139, lng: 77.2090 }; // Delhi coordinates
export const DEFAULT_ZOOM = 12;

export const TRAVEL_MODES = {
  DRIVING: 'driving',
  WALKING: 'walking',
  CYCLING: 'cycling',
} as const;

export const VOICE_COMMANDS = [
  'Navigate to [destination]',
  'Find [place] near me',
  'What\'s the traffic like?',
  'Show alternative routes',
  'Exit navigation',
];

// API Configuration
export const API_CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api',
  endpoints: {
    directions: '/api/navigation/directions',
    traffic: '/api/navigation/traffic',
    places: '/api/navigation/places',
    query: '/api/navigation/query',
    wakeWord: '/api/wake/detect',
  }
}; 