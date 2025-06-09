'use client';

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface MessageSourcesProps {
  sources: Array<{
    title: string;
    score: number;
    content: string;
  }>;
}

export function MessageSources({ sources }: MessageSourcesProps) {
  return (
    <div className="ml-11 mr-4 space-y-2 max-w-[calc(100%-3rem)]">
      {sources.map((source, idx) => (
        <Card key={idx} className="p-3 text-sm bg-background overflow-hidden">
          <div className="flex flex-wrap justify-between items-start gap-2 mb-1">
            <Badge variant="outline" className="mb-1">来源 {idx + 1}</Badge>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="secondary">
                    相关度: {(source.score * 100).toFixed(1)}%
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>文档与查询的相关性分数</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-muted-foreground text-xs mb-1 break-words truncate hover:text-clip hover:whitespace-normal">
            {source.title}
          </p>
          <div className="mt-2 p-2 bg-muted rounded text-xs">
            {source.content}
          </div>
        </Card>
      ))}
    </div>
  );
}