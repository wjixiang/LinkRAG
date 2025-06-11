import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger} from '../ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import MarkdownRenderer from '@/components/chat_components/DocumentDisplay';


interface TabData {
  id: string;
  title: string;
  content: string;
}

const MarkdownEditorTabs: React.FC = () => {
  const [tabs, setTabs] = useState<TabData[]>([
    { id: '1', title: '文档1', content: '# 欢迎使用Markdown编辑器\n\n输入你的内容...' }
  ]);
  const [activeTab, setActiveTab] = useState('1');

  const handleAddTab = () => {
    const newId = Date.now().toString();
    setTabs([...tabs, { 
      id: newId, 
      title: `文档${tabs.length + 1}`, 
      content: '# 新文档\n\n开始编辑...' 
    }]);
    setActiveTab(newId);
  };

  const handleContentChange = (id: string, value: string) => {
    setTabs(tabs.map(tab => 
      tab.id === id ? { ...tab, content: value } : tab
    ));
    // Force immediate state update for real-time preview
    setActiveTab(activeTab); 
  };

  const handleTabRename = (id: string, title: string) => {
    setTabs(tabs.map(tab => 
      tab.id === id ? { ...tab, title } : tab
    ));
  };

  const handleCloseTab = (id: string) => {
    if (tabs.length <= 1) return;
    
    const newTabs = tabs.filter(tab => tab.id !== id);
    setTabs(newTabs);
    
    if (activeTab === id) {
      setActiveTab(newTabs[newTabs.length - 1].id);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <Tabs 
        value={activeTab} 
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col"
      >
        <div className="flex items-center gap-1 px-2 py-1 border-b border-gray-200 dark:border-gray-700">
          <TabsList className="flex-1 bg-transparent">
            {tabs.map(tab => (
              <TabsTrigger 
                key={tab.id} 
                value={tab.id}
                className="relative group px-3 py-1.5 text-sm rounded-t-lg transition-all
                  data-[state=active]:bg-gray-200 data-[state=active]:dark:bg-gray-700
                  hover:bg-gray-100 hover:dark:bg-gray-800"
              >
                <input
                  type="text"
                  value={tab.title}
                  onChange={(e) => handleTabRename(tab.id, e.target.value)}
                  className="bg-transparent border-none outline-none w-24 text-gray-800 dark:text-gray-200"
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCloseTab(tab.id);
                  }}
                  className="ml-1 opacity-0 group-hover:opacity-100 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  ×
                </button>
              </TabsTrigger>
            ))}
          </TabsList>
          <button 
            onClick={handleAddTab}
            className="p-1.5 rounded-md text-gray-500 hover:bg-gray-200 hover:dark:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </div>

        {tabs.map(tab => (
          <TabsContent 
            key={tab.id} 
            value={tab.id}
            className="flex-1 flex flex-col"
          >
            <div className="flex-1 grid grid-cols-2 gap-0 bg-white dark:bg-gray-800 rounded-b-lg overflow-hidden">
              <div className="h-full border-r border-gray-200 dark:border-gray-700">
                <Textarea
                  value={tab.content}
                  onChange={(e) => handleContentChange(tab.id, e.target.value)}
                  className="h-full w-full font-mono text-sm p-4 resize-none focus-visible:ring-0 border-none
                    bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                  placeholder="输入Markdown内容..."
                />
              </div>
              <div className="h-full overflow-auto p-4 prose max-w-none bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200">
                <MarkdownRenderer 
                  content={tab.content} 
                  className="h-full"
                  key={tab.id + tab.content} // Force re-render on content change
                />
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default MarkdownEditorTabs;
