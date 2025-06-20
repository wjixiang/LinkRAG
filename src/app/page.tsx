"use client"
import AssistantSidebar from "@/components/chat_components/AssistantSidebar";
import GraphPage from "@/components/graph_visualization/GraphPage";
import DocumentDisplay from "@/components/chat_components/DocumentDisplay";
import { useState } from 'react';

export default function Page() {
  const [documentContent, setDocumentContent] = useState<string>('');
  
  return (
    <div className="p-5 h-screen">
      <AssistantSidebar>
        <div className="flex h-full">
          <div className="w-1/2 pr-2">
            <GraphPage
              onDocumentSelect={(content: string) => setDocumentContent(content)}
            />
          </div>
          <div className="w-1/2 pl-2">
            <DocumentDisplay content={documentContent} />
          </div>
        </div>
      </AssistantSidebar>
    </div>
  );
}