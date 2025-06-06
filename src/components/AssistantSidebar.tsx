'use client';

import { useState, useRef, useEffect } from "react";
import debounce from 'lodash.debounce';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageItem } from "./MessageItem";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, Bot, User, Info, Database, Copy, Menu } from "lucide-react";
import { toast } from 'sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useChatRuntime } from "@/hooks/ChatRuntime";

interface AssistantSidebarProps {
  children?: React.ReactNode;
  onSendQuiz: () => string|null;
  hasSelectedQuiz: boolean;
}

export default function AssistantSidebar({ children, onSendQuiz, hasSelectedQuiz }: AssistantSidebarProps) {
 
  const [input, setInput] = useState("");
  const [showSources, setShowSources] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null); // Add this line
  const [isMobile, setIsMobile] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  
  // Debounced mobile detection
  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const handleChange = () => {
      // Only update if the state actually changed
      if (mediaQuery.matches !== isMobile) {
        setIsMobile(mediaQuery.matches);
      }
    };
    
    // Initial check
    handleChange();
    
    // Add debounced listener
    const debouncedHandleChange = debounce(handleChange, 200);
    mediaQuery.addEventListener('change', debouncedHandleChange);
    
    return () => mediaQuery.removeEventListener('change', debouncedHandleChange);
  }, [isMobile]);
  
  const {
    mode,
    setMode,
    messages,
    statusMessages,
    setMessages,
    currentAiMessage,
    loading,
    graphState,
    nodeStatus, // 新增节点状态
    sendMessage: handleSendMessage,
    cancelRequest,
    regenerateLastMessage,
    clearChat
  } = useChatRuntime();

  // // 滚动到最新消息
  // useEffect(() => {
  //   messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  // }, [messages, currentAiMessage]);

  // 滚动到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentAiMessage]);

  // 自动调整输入框高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [input]);

  // 当前处理状态
  const [currentStatus, setCurrentStatus] = useState<{
    node: string;
    status: 'processing' | 'completed' | 'failed';
    error?: string;
  } | null>(null);

  // 更新节点状态
  useEffect(() => {
    if (nodeStatus) {
      const statusMap = {
        'start': 'processing',
        'end': 'completed',
        'error': 'failed'
      } as const;
      
      setCurrentStatus({
        node: nodeStatus.node,
        status: statusMap[nodeStatus.status],
        error: nodeStatus.error
      });
    }
  }, [nodeStatus]);

  // 发送消息
  const sendMessage = async () => {
    if (input.trim() === "" || loading) return;
    // setMessages((current)=>{
    //   return [...current, {
    //     content: input.trim(),
    //     sender: "user",
    //     timestamp: new Date(),
    //     isVisible: true

    //   }]
    // })
    try {
      await handleSendMessage(
        input.trim()
      );
      setInput("");
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('发送消息失败');
    }
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // 切换显示/隐藏来源
  const toggleSources = (timestamp: string) => {
    setShowSources(prev => ({
      ...prev,
      [timestamp]: !prev[timestamp]
    }));
  };

 
  const [sidebarWidth, setSidebarWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);
  const [initialWidth, setInitialWidth] = useState(0);
  const [startX, setStartX] = useState(0);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Stop propagation only for the sidebar itself when open on mobile
  const stopPropagation = (e: React.MouseEvent) => {
    if (isMobile && isMobileOpen) {
      e.stopPropagation();
    }
  };

  const startResizing = (e: React.MouseEvent) => {
    setIsResizing(true);
    setInitialWidth(sidebarWidth);
    setStartX(e.clientX);
  };

  const stopResizing = () => {
    setIsResizing(false);
  };

  const resize = (e: MouseEvent) => {
    if (isResizing && sidebarRef.current) {
      const newWidth = initialWidth + (startX - e.clientX);
      if (newWidth > 300 && newWidth < 800) {
        setSidebarWidth(newWidth);
      }
    }
  };

  const sendQuiz = ( ) => {
    const quiz_content = onSendQuiz()
    if(quiz_content) {
      handleSendMessage(quiz_content)
    }
  }

  useEffect(() => {
    if (!isMobile) { // Only add resize listeners for desktop
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
    }
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing, isMobile]); // Add isMobile to dependency array

  return (
    <div className="flex h-full relative z-100">
      {/* Overlay for mobile */}
      {isMobile && isMobileOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Main content area and mobile toggle */}
      <div className={`flex-grow relative ${isMobile ? '' : 'px-4'}`}>
        {children}
        {isMobile && (
          <Button
            variant="default"
            size="icon"
            className="fixed top-1/2 -translate-y-1/2 right-0 z-50 md:hidden rounded-l-full px-3 py-2 shadow-lg"
            onClick={() => setIsMobileOpen(true)}
          >
            <Bot className="h-6 w-6" />
          </Button>
        )}
      </div>

      {/* Resizer for desktop */}
      {!isMobile && (
        <div
          className="w-1 bg-transparent hover:bg-gray-200 cursor-col-resize transition-colors"
          onMouseDown={startResizing}
        />
      )}

      {/* Sidebar */}
      <Card
        ref={sidebarRef}
        className={`flex h-full overflow-hidden relative border-l py-1 p-1 pt-2
          ${isMobile ?
            `fixed top-0 right-0 h-full transition-transform duration-300 ease-in-out z-50
             ${isMobileOpen ? 'translate-x-0' : 'translate-x-full'}`
            : ''
          }`
        }
        style={{ width: isMobile ? '95vw' : `${sidebarWidth}px` }}
        onClick={stopPropagation} // Apply stopPropagation to the Card itself
      >
        {/* 聊天历史区域 */}
        <div className="flex-grow overflow-y-auto ">
          <ScrollArea className="h-full">
            <div className="">
              {messages.length === 0 && statusMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <Bot size={40} className="mb-2" />
                  {/* <p>检索增强生成对话</p> */}
                  <div className="flex items-center mt-2 text-xs">
                    {/* <Database size={12} className="mr-1" /> */}
                  </div>
                </div>
              ) : (
                <>
                  {[...messages]
                  // .filter(msg => msg.isVisible)
                  // .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
                  .map((message, index) => {
                    const timestampKey = message.timestamp.toISOString();
                    const isAi = message.sender === "ai";
                    
                    return (
                      <div key={index} className="space-y-2">
                        <MessageItem
                          message={message}
                          onRegenerate={isAi ? () => regenerateLastMessage(
                            
                          ) : undefined}
                          onToggleSources={isAi && message.sources ? () => toggleSources(timestampKey) : undefined}
                          showSources={showSources}
                          loading={loading}
                        />
                        
                        {message.sender === "user" && statusMessages.length > 0 && index === messages.length - 1 && (
                          <div className="ml-11 mt-2">
                            <div className="flex items-start gap-2 text-sm p-3 rounded-lg bg-muted">
                              <Info className="h-4 w-4 mt-0.5 text-blue-500 flex-shrink-0" />
                              <div className="flex-1">
                                <p className="font-medium text-blue-600">处理进度</p>
                                {statusMessages.map((msg, i) => (
                                  <p key={i} className="text-muted-foreground">{msg}</p>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* {isAi && message.sources && message.sources.length > 0 && showSources[timestampKey] && (
                          <MessageSources sources={message.sources} />
                        )} */}
                      </div>
                    );
                  })}
                </>
              )}
              
             {/* 当前生成的AI消息 */}
             {currentAiMessage.content && (
             <MessageItem message={{
               ...currentAiMessage,
               timestamp: new Date()
             }} />)}
              
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        </div>

        {/* 输入区域容器 */}
        <div className="relative bg-transparent z-10">


          {/* 工具栏 - 现在位于输入区域上方 */}
          <div id="toolBar" className="w-full bg-transparent mb-2">
                       {/* 发送试题按钮 */}
        {hasSelectedQuiz && (
          <div className="p-2 flex">
            <Button
              variant="outline"
              size="sm"
              onClick={sendQuiz}
              className="rounded-xl"
            >
              发送当前试题
            </Button>
          </div>
        )}

            <div className="flex justify-between items-center px-2 bg-transparent">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={mode === 'agent' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-8 p-2"
                    onClick={() => setMode(mode === 'agent' ? 'simple' : 'agent')}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/>
                      <path d="M9 13a4.5 4.5 0 0 0 3-4"/>
                      <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/>
                      <path d="M3.477 10.896a4 4 0 0 1 .585-.396"/>
                      <path d="M6 18a4 4 0 0 1-1.967-.516"/>
                      <path d="M12 13h4"/>
                      <path d="M12 18h6a2 2 0 0 1 2 2v1"/>
                      <path d="M12 8h8"/>
                      <path d="M16 8V5a2 2 0 0 1 2-2"/>
                      <circle cx="16" cy="13" r=".5"/>
                      <circle cx="18" cy="3" r=".5"/>
                      <circle cx="20" cy="21" r=".5"/>
                      <circle cx="20" cy="8" r=".5"/>
                    </svg>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{mode === 'agent' ? 'Agent模式' : '简单模式'}</p>
                  <p className="text-xs text-muted-foreground">点击切换模式</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
             <Button
                    size="icon"
                    className="h-8 w-8 bg-transparent p-4 text-destructive"
                    onClick={clearChat}
                    disabled={messages.length === 0 || loading}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 6h18" />
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
             </Button>
           </div>
            
          </div>
        <div className="p-0 shrink-0 bg-background">
      
        <div className="flex">
        <div className="relative w-full px-0">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`向知识库提问...`}
            className="resize-none pr-10 bg-background max-h-[200px]"
            rows={2}
            disabled={loading}
          />
            <div className="absolute right-2 bottom-2 flex gap-1">
              {loading ? (
                <Button
                  variant="destructive"
                  onClick={cancelRequest}
                  size="sm"
                  className="h-8"
                >
                  取消
                </Button>
              ) : (
                <Button
                  onClick={sendMessage}
                  disabled={input.trim() === ""}
                  size="sm"
                  className="h-8 w-8 p-0"
                >
                  <Send size={16} />
                </Button>
              )}
            </div>
          </div>

            
          </div>
         
          {loading && (
            <div className="flex items-center justify-center mt-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              正在从检索相关内容...
            </div>
          )}
        </div>
      </div>
    </Card>
  </div>
);
}
