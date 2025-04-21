import { useState, useRef, useEffect } from 'react';
import { useDisclosure } from '@mantine/hooks';
import { IconMessage, IconMicrophone, IconSend, IconX } from '@tabler/icons-react';
import classes from './chat-interface.module.scss';
import { useNavigationStore } from './navigation-store';

interface Message {
  sender: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [opened, { toggle }] = useDisclosure(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  
  const { 
    isNavigating, 
    currentRoute, 
    currentStep,
    distanceRemaining,
    timeRemaining,
    origin,
    destination
  } = useNavigationStore();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    // Add user message
    const userMessage: Message = {
      sender: 'user',
      text: input,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');

    // Add thinking message
    const thinkingMessage: Message = {
      sender: 'assistant',
      text: '...',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, thinkingMessage]);

    try {
      // Get current location and navigation context
      const contextData = {
        session_id: sessionId,
        navigation_status: isNavigating ? 'active' : 'inactive',
        current_step: currentStep,
        origin: origin || 'not set',
        destination: destination || 'not set',
        distance_remaining: distanceRemaining,
        time_remaining: timeRemaining,
        current_time: new Date().toLocaleTimeString(),
        current_date: new Date().toLocaleDateString()
      };

      // Send request to LLM API
      const response = await fetch('/api/llm/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: input,
          context: contextData
        }),
      });

      // Remove thinking message
      setMessages(prev => prev.filter(msg => msg !== thinkingMessage));
      
      if (response.ok) {
        const data = await response.json();
        
        // Save session ID for conversation continuity
        if (data.metadata?.session_id) {
          setSessionId(data.metadata.session_id);
        }

        // Add assistant response
        const assistantMessage: Message = {
          sender: 'assistant',
          text: data.response || "Sorry, I couldn't process your request",
          timestamp: new Date()
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        // Handle error
        const assistantMessage: Message = {
          sender: 'assistant',
          text: "Sorry, I'm having trouble connecting to the server",
          timestamp: new Date()
        };
        setMessages(prev => [...prev, assistantMessage]);
      }
    } catch (error) {
      // Remove thinking message and add error message
      setMessages(prev => prev.filter(msg => msg !== thinkingMessage));

      const assistantMessage: Message = {
        sender: 'assistant',
        text: "Sorry, there was an error processing your request",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
    }
  };

  if (!isNavigating) return null;

  return (
    <>
      <button className={classes.fab} onClick={toggle}>
        <IconMessage size={24} />
      </button>

      {opened && (
        <div className={classes.chatContainer}>
          <div className={classes.chatHeader}>
            <div className={classes.title}>Navigation Assistant</div>
            <button className={classes.closeButton} onClick={toggle}>
              <IconX size={20} />
            </button>
          </div>

          <div className={classes.messages}>
            {messages.map((message, index) => (
              <div 
                key={index} 
                className={`${classes.message} ${classes[message.sender]}`}
              >
                <div className={classes.messageContent}>
                  {message.text}
                </div>
                <div className={classes.timestamp}>
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className={classes.inputContainer}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your route..."
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            />
            <button className={classes.voiceButton}>
              <IconMicrophone size={20} />
            </button>
            <button className={classes.sendButton} onClick={handleSendMessage}>
              <IconSend size={20} />
            </button>
          </div>
        </div>
      )}
    </>
  );
} 