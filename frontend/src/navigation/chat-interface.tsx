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
  
  const { 
    isNavigating, 
    currentRoute, 
    currentStep,
    distanceRemaining,
    timeRemaining
  } = useNavigationStore();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = () => {
    if (!input.trim()) return;

    // Add user message
    const userMessage: Message = {
      sender: 'user',
      text: input,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');

    // Simulate thinking
    const thinkingMessage: Message = {
      sender: 'assistant',
      text: '...',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, thinkingMessage]);

    // Generate response
    setTimeout(() => {
      setMessages(prev => prev.filter(msg => msg !== thinkingMessage));
      
      let response = "I'm here to help with your navigation!";
      
      if (input.toLowerCase().includes('how far')) {
        response = `You're about ${distanceRemaining} away from your destination.`;
      } else if (input.toLowerCase().includes('how long')) {
        response = `You'll arrive in approximately ${timeRemaining}.`;
      } else if (input.toLowerCase().includes('next')) {
        const nextStep = currentRoute?.legs[0]?.steps[currentStep + 1];
        if (nextStep) {
          response = `Next: ${nextStep.maneuver.instruction} in ${nextStep.distance} meters`;
        } else {
          response = "You're at the end of your route!";
        }
      }

      const assistantMessage: Message = {
        sender: 'assistant',
        text: response,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
    }, 1000);
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