import { useState, useEffect, useRef } from 'react';

interface DebugEntry {
  timestamp: string;
  message: string;
  type: 'wake-word' | 'command' | 'backend' | 'error';
}

interface BackendLogEntry {
  timestamp: string;
  message: string;
  type: string;
}

// Console override setup
let originalConsoleLog = console.log;
let originalConsoleWarn = console.warn;
let originalConsoleError = console.error;
const debugEntries: DebugEntry[] = [];
const MAX_ENTRIES = 100;

// Override console methods
export const setupDebugConsoleOverrides = () => {
  if (typeof window === 'undefined') return;
  
  console.log = (...args) => {
    originalConsoleLog(...args);
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    
    let type: DebugEntry['type'] = 'command';
    if (message.includes('[Wake Word Debug]')) {
      type = 'wake-word';
    } else if (message.includes('[ERROR]')) {
      type = 'error';
    } else if (message.includes('[Backend]')) {
      type = 'backend';
    }
    
    addDebugEntry(message, type);
  };
  
  console.warn = (...args) => {
    originalConsoleWarn(...args);
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    addDebugEntry(`[WARN] ${message}`, 'error');
  };
  
  console.error = (...args) => {
    originalConsoleError(...args);
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    addDebugEntry(`[ERROR] ${message}`, 'error');
  };
};

// Restore original console methods
export const restoreConsole = () => {
  if (typeof window === 'undefined') return;
  
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
};

// Add entry to debug list
const addDebugEntry = (message: string, type: DebugEntry['type']) => {
  const now = new Date();
  const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
  
  debugEntries.unshift({
    timestamp,
    message,
    type
  });
  
  // Limit number of entries
  if (debugEntries.length > MAX_ENTRIES) {
    debugEntries.pop();
  }
  
  // Dispatch event to update UI
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('debugEntryAdded'));
  }
};

export default function DebugPanel() {
  const [entries, setEntries] = useState<DebugEntry[]>([]);
  const [backendLogs, setBackendLogs] = useState<BackendLogEntry[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [filter, setFilter] = useState<DebugEntry['type'] | 'all'>('all');
  const [activeTab, setActiveTab] = useState<'frontend' | 'backend'>('frontend');
  const eventSourceRef = useRef<EventSource | null>(null);
  
  useEffect(() => {
    // Setup console overrides when component mounts
    setupDebugConsoleOverrides();
    
    // Handler for debug entry updates
    const handleDebugEntryAdded = () => {
      setEntries([...debugEntries]);
    };
    
    // Setup keyboard shortcut (Ctrl+D) to toggle panel
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        setIsVisible(prev => !prev);
      }
    };
    
    window.addEventListener('debugEntryAdded', handleDebugEntryAdded);
    window.addEventListener('keydown', handleKeyDown);
    
    // Setup connection to backend logs stream
    const connectToBackendLogs = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      
      // Use NEXT_PUBLIC_API_URL to reach the FastAPI backend
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const url = apiBase.endsWith('/')
        ? `${apiBase}api/debug/voice-logs`
        : `${apiBase}/api/debug/voice-logs`;
      
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setBackendLogs(prevLogs => {
            // Add new log to the beginning of the array
            const newLogs = [data, ...prevLogs];
            // Limit to 100 entries
            return newLogs.slice(0, 100);
          });
        } catch (error) {
          console.error('Error parsing backend log:', error);
        }
      };
      
      eventSource.onerror = () => {
        console.error('Error in backend logs EventSource, reconnecting...');
        // Close and try reconnecting
        eventSource.close();
        setTimeout(connectToBackendLogs, 3000);
      };
    };
    
    // Start connection to backend logs
    connectToBackendLogs();
    
    return () => {
      // Cleanup
      restoreConsole();
      window.removeEventListener('debugEntryAdded', handleDebugEntryAdded);
      window.removeEventListener('keydown', handleKeyDown);
      
      // Close EventSource connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);
  
  if (!isVisible) {
    return (
      <div 
        style={{ 
          position: 'fixed', 
          bottom: '10px', 
          right: '10px',
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '8px',
          borderRadius: '4px',
          fontSize: '12px',
          cursor: 'pointer',
          zIndex: 9999
        }}
        onClick={() => setIsVisible(true)}
      >
        Show Debug (Ctrl+D)
      </div>
    );
  }
  
  // Filter entries
  const filteredEntries = filter === 'all' 
    ? entries 
    : entries.filter(entry => entry.type === filter);
  
  return (
    <div style={{
      position: 'fixed',
      bottom: '0',
      left: '0',
      width: '100%',
      height: '50%',
      background: 'rgba(0,0,0,0.85)',
      color: 'white',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      padding: '10px',
      boxSizing: 'border-box',
      fontFamily: 'monospace',
      fontSize: '12px'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '10px'
      }}>
        <h3 style={{ margin: 0 }}>Voice Recognition Debug Panel</h3>
        <div>
          <div style={{ display: 'flex', marginBottom: '10px' }}>
            <button
              onClick={() => setActiveTab('frontend')}
              style={{
                background: activeTab === 'frontend' ? '#555' : 'none',
                border: '1px solid #555',
                color: 'white',
                padding: '4px 12px',
                cursor: 'pointer',
                borderRadius: '4px 0 0 4px'
              }}
            >
              Frontend Logs
            </button>
            <button
              onClick={() => setActiveTab('backend')}
              style={{
                background: activeTab === 'backend' ? '#555' : 'none',
                border: '1px solid #555',
                color: 'white',
                padding: '4px 12px',
                cursor: 'pointer',
                borderRadius: '0 4px 4px 0',
                borderLeft: 'none'
              }}
            >
              Backend Logs
            </button>
          </div>
          
          {activeTab === 'frontend' && (
            <select 
              value={filter}
              onChange={e => setFilter(e.target.value as any)}
              style={{
                marginRight: '10px',
                background: 'black',
                color: 'white',
                border: '1px solid #444'
              }}
            >
              <option value="all">All</option>
              <option value="wake-word">Wake Word</option>
              <option value="command">Command</option>
              <option value="backend">Backend</option>
              <option value="error">Errors</option>
            </select>
          )}
          
          <button 
            onClick={() => setIsVisible(false)}
            style={{
              background: 'none',
              border: '1px solid #555',
              color: 'white',
              padding: '2px 8px',
              cursor: 'pointer'
            }}
          >
            Hide
          </button>
        </div>
      </div>
      
      <div style={{
        flex: 1,
        overflowY: 'auto',
        border: '1px solid #333',
        padding: '5px'
      }}>
        {activeTab === 'frontend' && (
          filteredEntries.length === 0 ? (
            <div style={{ padding: '10px', color: '#888' }}>No debug entries to display</div>
          ) : (
            filteredEntries.map((entry, i) => (
              <div 
                key={i} 
                style={{
                  borderBottom: '1px solid #333',
                  padding: '4px 0',
                  color: entry.type === 'error' ? '#ff6b6b' : 
                         entry.type === 'wake-word' ? '#4ecdc4' : 
                         entry.type === 'backend' ? '#ffdd59' : '#fff'
                }}
              >
                <span style={{ color: '#888', marginRight: '10px' }}>{entry.timestamp}</span>
                {entry.message}
              </div>
            ))
          )
        )}
        
        {activeTab === 'backend' && (
          backendLogs.length === 0 ? (
            <div style={{ padding: '10px', color: '#888' }}>No backend logs available</div>
          ) : (
            backendLogs.map((log, i) => (
              <div 
                key={i} 
                style={{
                  borderBottom: '1px solid #333',
                  padding: '4px 0',
                  color: log.type === 'error' ? '#ff6b6b' : 
                         log.type === 'wake_word' ? '#4ecdc4' :
                         log.type === 'wake_word_result' ? '#ffd166' :
                         log.type === 'command' ? '#06d6a0' :
                         log.type === 'command_context' ? '#118ab2' : '#fff'
                }}
              >
                <span style={{ color: '#888', marginRight: '10px' }}>{log.timestamp}</span>
                <span style={{ color: '#ccc', marginRight: '10px' }}>[{log.type}]</span>
                {log.message}
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
} 