// Suno Saarthi Service Worker
const CACHE_NAME = 'suno-saarthi-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/css/style.css',
  '/css/navigation-mode.css',
  '/css/voice-modal.css',
  '/css/voice.css',
  '/js/main.js',
  '/js/navigation.js',
  '/js/voice-recognition.js',
  '/js/map.js',
  '/js/api.js',
  '/js/secrets.js',
  '/js/config.js',
  '/img/icon-192x192.png',
  '/img/icon-512x512.png',
  '/img/microphone.png',
  '/img/loader.gif'
];

// Absolute path to the root of the application
const APP_PREFIX = location.pathname.substring(0, location.pathname.lastIndexOf('/') + 1);

// Correct the paths based on the app prefix
const CORRECTED_CACHE_ASSETS = ASSETS_TO_CACHE.map(asset => {
  // Only prepend for paths that start with / and aren't the root path
  if (asset.startsWith('/') && asset !== '/') {
    // Remove the leading / and prepend the app prefix
    return APP_PREFIX + asset.substring(1);
  }
  // For the root path or relative paths, use as is
  return asset;
});

// Install event - cache assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching app shell');
        return cache.addAll(CORRECTED_CACHE_ASSETS);
      })
      .then(() => {
        console.log('[Service Worker] Install completed');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[Service Worker] Install failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating');
  
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          console.log('[Service Worker] Removing old cache', key);
          return caches.delete(key);
        }
      }));
    }).then(() => {
      console.log('[Service Worker] Claiming clients');
      return self.clients.claim();
    }).catch(error => {
      console.error('[Service Worker] Activation failed:', error);
    })
  );
});

// Helper function to determine if a request should be cached
function shouldCache(url) {
  // Don't cache API requests
  if (url.includes('/api/')) {
    return false;
  }
  
  // Don't cache URLs from external domains
  if (!url.startsWith(self.location.origin)) {
    return false;
  }
  
  // Cache static assets
  const fileExtensions = ['.html', '.css', '.js', '.json', '.png', '.jpg', '.jpeg', '.svg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.otf'];
  const hasExtension = fileExtensions.some(ext => url.endsWith(ext));
  if (hasExtension) {
    return true;
  }
  
  // Cache specific routes
  const routesToCache = ['/', '/index.html', '/offline.html'];
  if (routesToCache.includes(new URL(url).pathname)) {
    return true;
  }
  
  return false;
}

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }
  
  // Skip API requests - let them go directly to network
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          console.log('[Service Worker] Serving from cache:', event.request.url);
          return response;
        }
        
        console.log('[Service Worker] Fetching from network:', event.request.url);
        return fetch(event.request)
          .then((networkResponse) => {
            // Cache the fetched response if it should be cached
            if (networkResponse && networkResponse.status === 200 && shouldCache(event.request.url)) {
              return caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse.clone());
                return networkResponse;
              });
            }
            return networkResponse;
          })
          .catch((error) => {
            console.error('[Service Worker] Fetch failed:', error);
            
            // Return the offline page for navigation requests
            if (event.request.mode === 'navigate') {
              return caches.match('/offline.html')
                .then(offlineResponse => {
                  if (offlineResponse) {
                    return offlineResponse;
                  }
                  // If offline page not in cache, try to return any html page
                  return caches.match('/index.html');
                });
            }
            
            // Otherwise, rethrow error
            throw error;
          });
      })
  );
});

// Handle push notifications
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    
    const options = {
      body: data.body || 'New notification from Suno Saarthi',
      icon: '/img/icon-192x192.png',
      vibrate: [100, 50, 100],
      data: {
        url: data.url || '/'
      }
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'Suno Saarthi', options)
    );
  }
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.notification.data && event.notification.data.url) {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  }
});

// Handle messages from clients
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Background sync for pending API requests when offline
self.addEventListener('sync', event => {
  if (event.tag === 'apiSync') {
    console.log('[Service Worker] Attempting to sync pending requests');
    // Logic for syncing stored requests would go here
  }
}); 