"use client";

import { useState, useEffect, useRef } from 'react';
import { Client, Message } from '@xmtp/xmtp-js';
import { useAccount, useWalletClient } from 'wagmi';
import { X, Send, Link, AlertCircle } from 'lucide-react';

interface XMTPChatProps {
  domainName: string;
  offerId?: string;
  recipientAddress?: string;
  onClose: () => void;
}

export default function XMTPChat({ domainName, offerId, recipientAddress, onClose }: XMTPChatProps) {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [xmtpClient, setXmtpClient] = useState<Client | null>(null);
  const [conversation, setConversation] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    if (walletClient && address) {
      initXMTP();
    }
  }, [walletClient, address]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initXMTP = async () => {
    if (!walletClient) return;
    
    setIsConnecting(true);
    try {
      // Create XMTP client with wallet signer
      const xmtp = await Client.create(walletClient as any, { env: 'production' });
      setXmtpClient(xmtp);

      // Check if recipient can receive messages
      if (recipientAddress) {
        const canMessage = await xmtp.canMessage(recipientAddress);
        if (!canMessage) {
          setError('Recipient has not enabled XMTP messaging');
          setLoading(false);
          return;
        }

        // Create or get existing conversation with on-chain offer ID
        const conversationId = offerId 
          ? `domain-deal-${domainName}-${offerId}` // Use on-chain offer ID
          : `domain-deal-${domainName}-${Date.now()}`; // Fallback for non-offer chats
        
        const conv = await xmtp.conversations.newConversation(recipientAddress, {
          conversationId,
          metadata: {
            domain: domainName,
            offerId: offerId || '',
            initiator: address,
            onChainLinked: offerId ? 'true' : 'false', // Flag to indicate on-chain linkage
          },
        });
        
        setConversation(conv);

        // Load existing messages
        const existingMessages = await conv.messages();
        setMessages(existingMessages);

        // Stream new messages
        const stream = await conv.streamMessages();
        for await (const message of stream) {
          setMessages((prev) => [...prev, message]);
        }
      }
    } catch (err) {
      console.error('XMTP init error:', err);
      setError('Failed to initialize chat. Please ensure XMTP is enabled for your wallet.');
    } finally {
      setLoading(false);
      setIsConnecting(false);
    }
  };

  const sendMessage = async () => {
    if (!conversation || !inputMessage.trim()) return;

    try {
      // Add on-chain reference if this is an offer-related message
      const messageContent = offerId 
        ? `[Offer #${offerId}] ${inputMessage}`
        : inputMessage;

      await conversation.send(messageContent);
      setInputMessage('');
    } catch (err) {
      console.error('Send message error:', err);
      setError('Failed to send message');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatTimestamp = (timestamp: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(timestamp);
  };

  return (
    <div className="fixed bottom-20 right-6 w-96 h-[500px] bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col z-50">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-lg flex justify-between items-center">
        <div>
          <h3 className="font-semibold">Domain Deal Chat</h3>
          <p className="text-xs opacity-90">{domainName}</p>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-white/20 rounded transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Offer Info Banner */}
      {offerId && (
        <div className="px-4 py-2 bg-blue-50 border-b flex items-center gap-2 text-sm">
          <Link className="w-4 h-4 text-blue-600" />
          <span>Linked to Offer #{offerId}</span>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            {isConnecting ? (
              <div>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-sm text-gray-500">Connecting to XMTP...</p>
              </div>
            ) : (
              <p className="text-gray-500">Loading messages...</p>
            )}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <AlertCircle className="w-12 h-12 text-yellow-500 mb-3" />
            <p className="text-sm text-gray-600">{error}</p>
            <button
              onClick={initXMTP}
              className="mt-3 text-blue-600 hover:text-blue-700 text-sm underline"
            >
              Retry Connection
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 text-center">
              No messages yet.<br />
              <span className="text-sm">Start the conversation about {domainName}</span>
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isOwn = msg.senderAddress === address;
            return (
              <div
                key={index}
                className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] px-4 py-2 rounded-lg ${
                    isOwn
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  <div className={`text-xs mb-1 ${isOwn ? 'text-blue-100' : 'text-gray-500'}`}>
                    {formatAddress(msg.senderAddress)} • {formatTimestamp(msg.sent)}
                  </div>
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {msg.content}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      {!loading && !error && (
        <div className="px-4 py-3 border-t">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={sendMessage}
              disabled={!inputMessage.trim()}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Messages are end-to-end encrypted via XMTP
          </p>
        </div>
      )}
    </div>
  );
}
