"use client"

import { useState, useRef, useCallback } from "react";
import { ChatMessage } from "@/components/chat_components/MessageItem";
import { toast } from 'sonner';
import { ControlMessageStatus, MessageType } from "@/lib/agent/Agent";

export interface ChatReq {
  mode: 'simple' | 'agent';
  messages: ChatMessage[];
  analysisLLMId?: string;
  workerLLMId?: string;
  selectedSource?: string;
}

interface BaseMessage {
  type: MessageType;
  timestamp: Date;
  node?: string;
}

interface ControlMessage extends BaseMessage {
  type: "step" | "notice" | "error"
  status?: ControlMessageStatus;
  error?: string;
  content?: string; // Optional for status messages
  id: string;
}

interface ContentMessage extends BaseMessage {
  type: 'stream' | 'push'
  content: string;
  isFinal?: boolean;
  references?: any[]; // For backward compatibility
  sources?: any[]; // Alternative name for references
}

interface MetadataMessage extends BaseMessage {
  type: "step"
  data: any[];
}

export type ChatResponseChunk = ControlMessage | ContentMessage | MetadataMessage;

export interface NodeStatus {
  node: string;
  status: 'start' | 'end' | 'error' 
  error?: string;
}

export interface UseChatRuntime {
  mode: 'simple' | 'agent';
  setMode: (mode: 'simple' | 'agent') => void;
  messages: ChatMessage[];
  statusMessages: string[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  currentAiMessage: ChatMessage;
  loading: boolean;
  graphState: any;
  nodeStatus: NodeStatus | null;
  sendMessage: (
    input: string,
    selectedSource?: string,
    analysisLLMId?: string,
    workerLLMId?: string
  ) => Promise<void>;
  cancelRequest: () => void;
  regenerateLastMessage: (
    selectedSource?: string,
    analysisLLMId?: string,
    workerLLMId?: string
  ) => Promise<void>;
  clearChat: () => void;
  currentTask: string;
}

export const useChatRuntime = (initialMode: 'simple' | 'agent' = 'simple'): UseChatRuntime => {
  const [mode, setMode] = useState<'simple' | 'agent'>(initialMode);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [statusMessages, setStatusMessages] = useState<string[]>([]);
  const [currentAiMessage, setCurrentAiMessage] = useState<ChatMessage>({
    content: "",
    sender: "ai",
    timestamp: new Date(),
    isVisible: true,
    messageType: "content"
  });
  const [loading, setLoading] = useState(false);
  const [graphState, setGraphState] = useState<any>(null);
  const [nodeStatus, setNodeStatus] = useState<NodeStatus | null>(null);
  const [references, setReferences] = useState<any[]>([]);
  const [currentTask, setCurrentTask] = useState<string>("");

  const abortControllerRef = useRef<AbortController | null>(null);
  const accumulatedContentRef = useRef<string>("");
  const currentAiMessageRef = useRef<ChatMessage>({
    content: "",
    sender: "ai",
    timestamp: new Date(),
    isVisible: true,
    messageType: "content"
  });

  
  
  const processChunk = useCallback((parsedChunk: ChatResponseChunk) => {
    
    // Message router
    switch(parsedChunk.type) {
      case 'error':
      case 'notice': // Handle notice messages from Agent
        handleControlMessage(parsedChunk);
        break;
      case "push":
      case 'stream':
        handleContentMessage(parsedChunk);
        break; 
    }
  }, []);

  const handleControlMessage = useCallback((message: ControlMessage) => {
    if (message.type === 'error') {
      toast.error(message.error || 'An error occurred');
    }
    
    if (message.node && message.status) {
      setNodeStatus({
        node: message.node,
        status: message.status,
        error: message.error,
      });
    }
    if (message.type === 'notice') {
      if(message.status === "start") {
        setCurrentTask(message.content ?? "")
      }else{
        setMessages(prev => [...prev, {
        messageType: "status",
        sender: "ai",
        timestamp: new Date(),
        isVisible: true,
        content: message.content || ''
      }]);
      }
    }

  }, []);

  const handleContentMessage = useCallback((message: ContentMessage) => {
    const content = message.content || '';
    if (message.type === 'stream') {
      // Reset accumulated content if this is the first chunk of a new stream
      if (!accumulatedContentRef.current) {
        accumulatedContentRef.current = "";
      }
      
      accumulatedContentRef.current += content;
      
      setCurrentAiMessage(prev => {
        const newMessage: ChatMessage = {
          content: accumulatedContentRef.current,
          timestamp: new Date(),
          sources: message.references || message.sources,
          sender: "ai" as const,
          isVisible: true,
          messageType: "content" as const
        };
        currentAiMessageRef.current = newMessage;
        return newMessage;
      });

      // Add to messages when stream is complete
      if (message.isFinal) {
        console.log("final", currentAiMessageRef.current)
        setMessages(prev => [...prev, {
          ...currentAiMessageRef.current,
          timestamp: new Date(),
          sources: message.references || message.sources
        }]);
        // Reset accumulated content after final message
        accumulatedContentRef.current = "";
      }
    } else {
      setMessages(prev => [...prev, {
        messageType: "content",
        sender: "ai",
        timestamp: new Date(),
        isVisible: true,
        content,
        sources: message.references || message.sources
      }]);
    }
  }, []);

  // const handleMetadataMessage = useCallback((message: MetadataMessage) => {
  //   if (message.type === 'references') {
  //     setReferences(message.data || []);
  //   }
  // }, []);
  const sendMessage = useCallback(async (
    input: string,
    selectedSource: string = 'vault',
    analysisLLMId: string = '',
    workerLLMId: string = ''
  ) => {
    if (loading) return;

    setLoading(true);
    accumulatedContentRef.current = ""; // Initialize accumulated content
    setCurrentAiMessage({
      content: "",
      sender: "ai",
      timestamp: new Date(),
      isVisible: true,
      messageType: "content"
    });
    setNodeStatus(null);
    setReferences([]);

    const userMessage: ChatMessage = {
      content: input,
      sender: "user",
      timestamp: new Date(),
      isVisible: true,
      messageType: "content"
    };

    setMessages((prevMessages) => [...prevMessages, userMessage]);

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      const historyMessages = messages.map(msg => ({
        content: msg.content,
        sender: msg.sender,
        timestamp: msg.timestamp,
        isVisible: msg.isVisible,
        sources: msg.sources,
        messageType: msg.messageType || "content"
      }));

      const requestBody: ChatReq = {
        mode,
        messages: [...historyMessages, userMessage],
        analysisLLMId,
        workerLLMId,
        selectedSource,
      };

      const response = await fetch("/api/chatbot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal,
      });

      if (!response.ok || !response.body) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch from API');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = "";

      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        const messages = buffer.split('\n');
        buffer = messages.pop() || ""; // Keep the last incomplete message in the buffer

        for (const message of messages) {
          try {
            const parsedChunk: ChatResponseChunk = JSON.parse(message);
            // console.log('Received chunk:', parsedChunk); // Debug logging
            processChunk(parsedChunk);

          } catch (parseError) {
            console.error('Failed to parse JSON chunk:', parseError, 'Chunk:', message); // Log the problematic chunk
          }
        }
      }
      // Process any remaining content in the buffer after the stream is done
      if (buffer.trim() !== '') {
        try {
          const parsedChunk: ChatResponseChunk = JSON.parse(buffer);
          console.log('Received final chunk:', parsedChunk);
          processChunk(parsedChunk);

        } catch (parseError) {
          console.error('Failed to parse final JSON chunk:', parseError, 'Chunk:', buffer);
        }
      }

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Fetch aborted');
        toast.info('请求已取消');
        setCurrentAiMessage({
          content: "请求已取消。",
          sender: "ai",
          timestamp: new Date(),
          isVisible: true,
          messageType: "content"
        });
      } else {
        console.error("Error during chat:", error);
        toast.error(`发送消息失败: ${error.message}`);
        setCurrentAiMessage({
          content: `发送消息失败: ${error.message}`,
          sender: "ai",
          timestamp: new Date(),
          isVisible: true,
          messageType: "content",
          isErrorMessage: true
        });
      }

      const errorMessage: ChatMessage = {
        content: `Error: ${error.message}`,
        sender: "ai",
        timestamp: new Date(),
        isVisible: true,
        messageType: "content",
        isErrorMessage: true
      };
      setMessages((prevMessages) => [...prevMessages, errorMessage]);

    } finally {
      setLoading(false);
      abortControllerRef.current = null;
      setCurrentAiMessage({
        content: "",
        sender: "ai",
        timestamp: new Date(),
        isVisible: true,
        messageType: "content"
      });
      setNodeStatus(null);
    }
  }, [loading, messages, mode, processChunk, references, accumulatedContentRef, setCurrentAiMessage, setMessages, setLoading, setNodeStatus, setReferences]);

  // ... rest of the hook implementation remains the same ...
  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, []);

  const regenerateLastMessage = useCallback(async (
    selectedSource: string = 'vault',
    analysisLLMId: string = '',
    workerLLMId: string = ''
  ) => {
    if (loading || messages.length === 0) return;

    const lastUserMessageIndex = messages.slice().reverse().findIndex(msg => msg.sender === 'user');
    if (lastUserMessageIndex === -1) {
      toast.info('没有找到上一条用户消息');
      return;
    }

    const originalIndex = messages.length - 1 - lastUserMessageIndex;
    const lastUserMessage = messages[originalIndex];

    setMessages(prevMessages => prevMessages.slice(0, originalIndex + 1));
    await sendMessage(lastUserMessage.content, selectedSource, analysisLLMId, workerLLMId);

  }, [loading, messages, sendMessage]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setStatusMessages([]);
    setCurrentAiMessage({
      content: "",
      sender: "ai",
      timestamp: new Date(),
      isVisible: true,
      messageType: "content"
    });
    setLoading(false);
    setGraphState(null);
    setNodeStatus(null);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  return {
    mode,
    setMode,
    messages,
    statusMessages,
    setMessages,
    currentAiMessage,
    loading,
    graphState,
    nodeStatus,
    sendMessage,
    cancelRequest,
    regenerateLastMessage,
    clearChat,
    currentTask,
  };
};