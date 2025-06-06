'use client';

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CheckIcon, Copy, Info } from "lucide-react";
import { toast } from 'sonner';
import { format } from "date-fns";
import MarkdownRenderer, { Reference } from "./DocumentDisplay";
import { MessageSources } from "./MessageSources";

export interface ChatMessage {
    originalMessage?: string;
    sender: "user" | "ai" | "system";
    timestamp: Date;
    isVisible: boolean;
    messageType: "content" | "status";
    status?: 'processing' | 'completed' | 'failed';
    sources?: Reference[];
    content: string;
    isErrorMessage?: boolean;
    metadata?: {
        node?: string;
        progress?: number;
    };
}

interface MessageItemProps {
  message: ChatMessage;
  onRegenerate?: () => void;
  onToggleSources?: () => void;
  showSources?: Record<string, boolean>;
  loading?: boolean;
}

export function MessageItem({ 
  message, 
  onRegenerate, 
  onToggleSources, 
  showSources,
  loading
}: MessageItemProps) {
  const isAi = message.sender === "ai";
  const isUser = message.sender === "user";
  const timestampKey = message.timestamp.toISOString();

  const handleCopy = async () => {
    try {
      const textContent = Array.isArray(message.content)
        ? message.content.filter((part: any) => part.type === 'text').map((part: any) => part.text).join(' ')
        : '';
      await navigator.clipboard.writeText(textContent);
      toast.success("复制成功", {
        style: {
          backgroundColor: '#4caf50',
          color: 'white',
        },
        description: "消息内容已复制到剪贴板",
        duration: 2000
      });
    } catch (err) {
      try {
        const textarea = document.createElement('textarea');
        const textContent = Array.isArray(message.content)
          ? message.content.filter((part: any) => part.type === 'text').map((part: any) => part.text).join(' ')
          : '';
        textarea.value = textContent;
        textarea.style.position = 'fixed';
        document.body.appendChild(textarea);
        textarea.select();
        
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        
        if (success) {
          toast.success("复制成功", {
            style: {
              backgroundColor: '#4caf50',
              color: 'white',
            },
            description: "消息内容已复制到剪贴板",
            duration: 2000
          });
        } else {
          throw new Error('execCommand failed');
        }
      } catch (fallbackErr) {
        toast.error("复制失败", {
          style: {
            backgroundColor: '#f44336',
            color: 'white',
          },
          description: "无法访问剪贴板",
          duration: 2000
        });
      }
    }
  };

  if (message.messageType === "status") {
    return (
      <div className="flex justify-center my-2">
        <div className="flex items-center text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
          <CheckIcon/>
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`flex gap-3 max-w-[100%] ${isUser ? "flex-row-reverse" : ""}`}>
        {isUser && (
          <Avatar className="h-8 w-8 mt-1 flex-shrink-0 justify-center">
            {(
              <AvatarFallback className="w-full">
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
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </AvatarFallback>
            )}
          </Avatar>
        )}
        <div className="max-w-full overflow-hidden">
          <div
            className={`rounded-lg p-3 ${
              isUser
                ? "bg-muted text-destructive-foreground"
                : message.isErrorMessage
                ? "bg-destructive text-destructive-foreground"
                : ""
            } markdown-content`}
          >
            <MarkdownRenderer
              content={message.content}
              references={message.sources}
              basePath="/wiki"
            />
          </div>
          
          <div className="text-xs text-muted-foreground mt-1">
            <div className="flex items-center">
              <span>{format(message.timestamp, 'HH:mm')}</span>
              
              <Button
                variant="ghost"
                size="sm"
                className="h-5 text-xs ml-2 px-1"
                onClick={handleCopy}
              >
                <Copy size={12} className="mr-1" />
                复制
              </Button>
              {isAi && onRegenerate && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 text-xs ml-2 px-1"
                  onClick={onRegenerate}
                  disabled={loading}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mr-1"
                  >
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                    <path d="M21 3v5h-5" />
                    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                    <path d="M8 16H3v5" />
                  </svg>
                  重新生成
                </Button>
              )}
              {isAi && message.sources && message.sources.length > 0 && onToggleSources && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 text-xs ml-2 px-1"
                  onClick={onToggleSources}
                >
                  <Info size={12} className="mr-1" />
                  {showSources?.[timestampKey] ? "隐藏来源" : `${message.sources.length} 个来源`}
                </Button>
              )}
            </div>
            {isAi && message.messageType === "content" && message.sources && showSources?.[timestampKey] && (
              <div className="">
                <MessageSources sources={message.sources} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}