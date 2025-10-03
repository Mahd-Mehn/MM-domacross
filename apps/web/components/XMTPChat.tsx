"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';

interface Message {
  id: string;
  content: string;
  sender: string;
  timestamp: Date;
}

interface XMTPChatProps {
  recipientAddress: string;
  domainName: string;
  offerId?: string; // Optional on-chain offer ID for linking
}

export function XMTPChat({ recipientAddress, domainName, offerId }: XMTPChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [conversation, setConversation] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { address } = useAccount();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const initializeXMTP = async () => {
    try {
      console.log('Initializing XMTP...');
      
      // Mock XMTP functionality for build compatibility
      const mockConversation = {
        send: async (content: string) => {
          const message: Message = {
            id: Date.now().toString(),
            content,
            sender: address || '',
            timestamp: new Date()
          };
          setMessages(prev => [...prev, message]);
          return message;
        }
      };
      
      setConversation(mockConversation);
      setIsConnected(true);

      // Add a welcome message
      const welcomeMessage: Message = {
        id: 'welcome',
        content: `Chat initialized for ${domainName}${offerId ? ` (Offer #${offerId})` : ''}`,
        sender: 'system',
        timestamp: new Date()
      };
      setMessages([welcomeMessage]);
    } catch (error) {
      console.error('Failed to initialize XMTP:', error);
    }
  };

  const sendMessage = async () => {
    if (!conversation || !newMessage.trim()) return;

    try {
      await conversation.send(newMessage);
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  useEffect(() => {
    if (address && recipientAddress) {
      initializeXMTP();
    }
  }, [address, recipientAddress]);

  if (!address) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-6">
        <p className="text-slate-400 text-center">Connect your wallet to start chatting</p>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-6">
        <div className="flex items-center justify-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
          <p className="text-slate-400">Connecting to XMTP...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-slate-700/50 px-4 py-3 border-b border-slate-600">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-white">Domain Deal Chat</h3>
            <p className="text-sm text-slate-400">
              {domainName} {offerId && `• Offer #${offerId}`}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span className="text-xs text-slate-400">Connected</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="h-64 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-slate-400 py-8">
            <p>No messages yet. Start the conversation!</p>
            {offerId && (
              <p className="text-xs mt-2">This chat is linked to on-chain offer #{offerId}</p>
            )}
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${
                message.sender === address ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-3 py-2 rounded-lg ${
                  message.sender === address
                    ? 'bg-blue-600 text-white'
                    : message.sender === 'system'
                    ? 'bg-slate-500 text-white'
                    : 'bg-slate-600 text-white'
                }`}
              >
                <p className="text-sm">{message.content}</p>
                <p className="text-xs opacity-75 mt-1">
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-600 p-4">
        <div className="flex space-x-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-blue-400"
          />
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
          >
            Send
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Press Enter to send • Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
