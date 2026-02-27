import React, { useState, useEffect, useRef } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export const AIAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [apiKey, setApiKey] = useState(localStorage.getItem('openai_api_key') || '');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSaveKey = () => {
    localStorage.setItem('openai_api_key', apiKey);
    alert('API Key saved to local storage.');
  };

  const handleSend = async () => {
    if (!input.trim() || !apiKey) return;

    const userMsg: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:8000/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: input, api_key: apiKey })
      });

      if (!response.ok) throw new Error('Failed to reach RAG agent');

      const data = await response.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer }]);
    } catch (error: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${error.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`ai-assistant-drawer ${isOpen ? 'open' : ''}`}>
      <div className="drawer-handle" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? '✖ CLOSE AI' : '✨ GENOMIC AI EXPERT'}
      </div>
      
      <div className="drawer-content">
        <div className="api-key-section">
          <input 
            type="password" 
            placeholder="OpenAI API Key..." 
            value={apiKey} 
            onChange={(e) => setApiKey(e.target.value)} 
          />
          <button onClick={handleSaveKey}>SAVE</button>
        </div>

        <div className="chat-history" ref={scrollRef}>
          {messages.length === 0 && (
            <div className="welcome-msg">
              Welcome! I am a RAG-powered expert. Ask me about your database (e.g., "Which species has the highest GC content?")
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`chat-bubble ${m.role}`}>
              <div className="bubble-role">{m.role.toUpperCase()}</div>
              <div className="bubble-text">{m.content}</div>
            </div>
          ))}
          {isLoading && <div className="loading-dots">AI is retrieving and thinking...</div>}
        </div>

        <div className="chat-input-area">
          <textarea 
            placeholder="Type a query..." 
            value={input} 
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          />
          <button onClick={handleSend} disabled={isLoading}>SEND</button>
        </div>
      </div>
    </div>
  );
};
