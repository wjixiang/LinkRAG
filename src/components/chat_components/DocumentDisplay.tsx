import React, { useEffect, useState, useCallback, useRef } from 'react';

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeHighlight from 'rehype-highlight';
import rehypeStringify from 'rehype-stringify';
import remarkWikiLink from 'remark-wiki-link';
import { visit } from 'unist-util-visit';
import type { Node, Parent } from 'unist';
import { useRouter } from 'next/navigation';
import rehypeKatex from 'rehype-katex';
import rehypeCallouts from 'rehype-callouts';

export type Reference = { title: string; score: number; content: string }

interface MarkdownRendererProps {
  content: string;
  className?: string;
  basePath?: string;
  embedDepth?: number;
  references?: Reference[];
}

const contentCache = new Map<string, string>();
const htmlCache = new Map<string, string>();

function remarkReferences(references: Reference[]) {
  return () => (tree: any) => {
    visit(tree, 'text', (node: { type: 'text'; value: string }, index: number | undefined, parent: Parent | undefined) => {
      if (!parent || !Array.isArray(parent.children)) {
        return;
      }
      
      const parts = node.value.split(/(\[ref:\d+\])/g);
      if (parts.length <= 1) return;
      
      const newNodes = [];
      
      for (let i = 0; i < parts.length; i++) {
        if (!parts[i]) continue;
        
        const refMatch = parts[i].match(/^\[ref:(\d+)\]$/);
        
        if (refMatch) {
          const refId = refMatch[1];
          newNodes.push({
            type: 'element',
            tagName: 'span',
            properties: {
              className: ['reference'],
              'data-ref-id': Number(refId) - 1 
            },
            children: [
              { type: 'text', value: `[${refId}]` }
            ]
          });
        } else {
          newNodes.push({ type: 'text', value: parts[i] });
        }
      }
      
      if (newNodes.length > 0) {
        parent.children.splice(index as number, 1, ...newNodes);
        return index as number + newNodes.length - 1;
      }
    });
  };
}

function remarkEmbeds() {
  return () => (tree: any) => {
    visit(tree, 'text', (node: any, index: any, parent: any) => {
      if (typeof node.value !== 'string' || !parent || !Array.isArray(parent.children)) {
        return;
      }
      
      const parts = node.value.split(/(!\[\[.*?\]\])/g);
      if (parts.length <= 1) return;
      
      const newNodes = [];
      
      for (let i = 0; i < parts.length; i++) {
        if (!parts[i]) continue;
        
        const embedMatch = parts[i].match(/^!\[\[(.*?)\]\]$/);
        
        if (embedMatch) {
          const embedTarget = embedMatch[1].trim();
          newNodes.push({
            type: 'html',
            value: `<div class="embed" data-embed-target="${embedTarget}">
              
              <div class="embed-content">
                <div class="embed-loading">加载中...</div>
              </div>
            </div>`
          });
        } else {
          newNodes.push({ type: 'text', value: parts[i] });
        }
      }
      
      if (newNodes.length > 0) {
        if (typeof index === 'number' && parent) {
          parent.children.splice(index, 1, ...newNodes);
          return index + newNodes.length - 1;
        }
        return;
      }
    });
  };
}

function remarkObsidianCallouts() {
  return (tree: any) => {
    visit(tree, 'blockquote', (node: any, index: any, parent: any) => {
      if (!node.children || node.children.length === 0) return;
      
      const firstParagraph = node.children[0];
      if (firstParagraph.type !== 'paragraph' || !firstParagraph.children || firstParagraph.children.length === 0) return;
      
      const firstChild = firstParagraph.children[0];
      if (firstChild.type !== 'text') return;
      
      const calloutMatch = firstChild.value.match(/^\[!([a-zA-Z0-9_-]+)(?:\|([a-zA-Z0-9_-]+))?\]\s*(.*)/);
      if (!calloutMatch) return;
      
      const calloutType = calloutMatch[1];
      const calloutStyle = calloutMatch[2] || calloutType.toLowerCase();
      const restOfLine = calloutMatch[3];
      
      firstChild.value = restOfLine;
      
      const admonitionDiv = {
        type: 'element',
        tagName: 'div',
        properties: {
          className: [`admonition-${calloutType.toLowerCase()}`, `admonition`, calloutStyle]
        },
        children: [
          {
            type: 'element',
            tagName: 'div',
            className: ['admonition-title'],
            children: [{ type: 'text', value: calloutType }]
          },
          {
            type: 'element',
            tagName: 'div',
            properties: { className: ['admonition-content'] },
            children: node.children
          }
        ]
      };
      
      parent.children.splice(index, 1, admonitionDiv);
      console.log(`Converted callout: ${calloutType} with style ${calloutStyle}`);
    });
  };
}

function remarkPDFCallouts() {
  return (tree: any) => {
    visit(tree, 'text', (node: any) => {
      if (typeof node.value === 'string') {
        node.value = node.value.replace(/\[!PDF(\|[^\]]*)?\]/g, '[!note]');
      }
    });
  };
}

async function renderMarkdown(content: string, basePath: string, references: Reference[]): Promise<string> {
  const cacheKey = `${content}:${basePath}`;
  if (htmlCache.has(cacheKey)) {
    return htmlCache.get(cacheKey)!;
  }
  
  try {
    const result = await unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkMath)
      .use(remarkPDFCallouts)
      .use(remarkWikiLink, {
        pageResolver: (name: string) => [encodeURIComponent(name.split('|')[0].trim())],
        hrefTemplate: (permalink: string) => `${basePath}/${permalink}`,
        aliasDivider: '|'
      })
      .use(remarkEmbeds())
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeCallouts, {
        callouts: {
          PDF: {
            title: 'Note',
            indicator: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>'
          }
        }
      })
      .use(rehypeRaw)
      .use(rehypeKatex)
      .use(rehypeHighlight)
      .use(rehypeStringify)
      .use(remarkReferences(references))
      .process(content);

    const html = String(result);
    htmlCache.set(cacheKey, html);
    return html;
  } catch (error) {
    console.error('渲染Markdown失败:', error);
    return `<div class="markdown-error">渲染失败: ${error instanceof Error ? error.message : String(error)}</div>`;
  }
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className,
  basePath = '/wiki',
  embedDepth = 0,
  references
}) => {
  const [html, setHtml] = useState<string>('');
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const renderedRef = useRef<HTMLDivElement>(null);
  const embedsLoadedRef = useRef<boolean>(false);
  const maxEmbedDepth = 2;

  const extractLinks = useCallback((text: string): string[] => {
    const linkRegex = /(?:!?\[\[(.*?)(?:\|.*?)?\]\])/g;
    const links: string[] = [];
    let match;
    
    while ((match = linkRegex.exec(text)) !== null) {
      const linkText = match[1].trim();
      if (!links.includes(linkText)) {
        links.push(linkText);
      }
    }
    return links;
  }, []);

  const fetchAndRenderEmbeddedContent = useCallback(async (title: string): Promise<string> => {
    if (embedDepth >= maxEmbedDepth) {
      return `<div class="embed-max-depth">已达到最大嵌入深度 (${maxEmbedDepth})</div>`;
    }
    
    if (contentCache.has(title)) {
      return contentCache.get(title)!;
    }
    
    try {
      const response = await fetch(`/api/note/fetch?title=${encodeURIComponent(title)}`);
      if (!response.ok) throw new Error(`获取内容失败: ${response.status}`);
      
      const data = await response.json();
      if (!data?.content) return `<div class="embed-error">内容不存在或无法加载</div>`;
      
      const docContent = data.content[data.content.length-1].fileContent;
      const truncatedContent = docContent.length > 2000 
        ? docContent.slice(0, 2000) + '...'
        : docContent;
      
      const embeddedHtml = await renderMarkdown(truncatedContent, basePath, []);
      const wrappedHtml = `
        <div class="embedded-markdown">
          ${embeddedHtml}
          ${docContent.length > 2000 ? 
            `<div class="embed-more-link"><a href="${basePath}/${encodeURIComponent(title)}" class="embed-more">查看完整内容</a></div>` : 
            ''}
        </div>
      `;
      
      contentCache.set(title, wrappedHtml);
      return wrappedHtml;
    } catch (error) {
      console.error('获取嵌入内容失败:', error);
      return `<div class="embed-error">加载失败: ${error instanceof Error ? error.message : String(error)}</div>`;
    }
  }, [basePath, embedDepth, maxEmbedDepth]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const katexLink = document.createElement('link');
    katexLink.rel = 'stylesheet';
    katexLink.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css';
    
    const highlightLink = document.createElement('link');
    highlightLink.rel = 'stylesheet';
    highlightLink.href = 'https://cdn.jsdelivr.net/npm/highlight.js@11.11.1/styles/github-dark.css';
    
    const calloutsLink = document.createElement('link');
    calloutsLink.rel = 'stylesheet';
    calloutsLink.href = 'https://cdn.jsdelivr.net/npm/rehype-callouts@2.0.2/dist/themes/obsidian/index.css';
    
    document.head.appendChild(katexLink);
    document.head.appendChild(highlightLink);
    document.head.appendChild(calloutsLink);
    
    return () => {
      document.head.removeChild(katexLink);
      document.head.removeChild(highlightLink);
      document.head.removeChild(calloutsLink);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !renderedRef.current) return;

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        // Mermaid support removed
      });
    });

    observer.observe(renderedRef.current, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false
    });

    // Mermaid support removed

    return () => observer.disconnect();
  }, [html]);

  useEffect(() => {
    if (content.length > 1000000) {
      setError("内容过大，无法渲染");
      return;
    }

    let isMounted = true;
    embedsLoadedRef.current = false;
    
    const processMarkdown = async () => {
      try {
        setIsProcessing(true);
        const renderedHtml = await renderMarkdown(content, basePath, references ?? []);
        if (!isMounted) return;
        setHtml(renderedHtml);
      } catch (err) {
        if (!isMounted) return;
        console.error("Markdown处理错误:", err);
        setError(`渲染错误: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        if (isMounted) setIsProcessing(false);
      }
    };

    processMarkdown();
    return () => { isMounted = false; };
  }, [content, basePath]);

  useEffect(() => {
    if (!renderedRef.current || !html) return;
    
    const loadEmbeds = async () => {
      const embeds = renderedRef.current?.querySelectorAll('.embed');
      if (!embeds || embeds.length === 0) return;
      
      const processedEmbeds = new Set();
      const MAX_CONCURRENT = 3;
      const queue = Array.from(embeds).filter(embed => {
        const contentEl = embed.querySelector('.embed-content');
        return contentEl?.querySelector('.embed-loading');
      });
      
      const inProgress = new Set();
      
      const processQueue = async () => {
        while (queue.length > 0 && inProgress.size < MAX_CONCURRENT) {
          const embed = queue.shift() as Element;
          const embedTarget = embed.getAttribute('data-embed-target');
          const contentEl = embed.querySelector('.embed-content');
          
          if (embedTarget && contentEl && !processedEmbeds.has(embedTarget)) {
            processedEmbeds.add(embedTarget);
            inProgress.add(embedTarget);
            
            try {
              const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('加载超时')), 10000);
              });
              
              const renderedContent = await Promise.race([
                fetchAndRenderEmbeddedContent(embedTarget),
                timeoutPromise
              ]);
              
              if (renderedRef.current) {
                contentEl.innerHTML = renderedContent as string;
                const nestedEmbeds = contentEl.querySelectorAll('.embed');
                if (nestedEmbeds.length > 0 && embedDepth < maxEmbedDepth) {
                  nestedEmbeds.forEach(nestedEmbed => {
                    const nestedTarget = nestedEmbed.getAttribute('data-embed-target');
                    if (nestedTarget && !processedEmbeds.has(nestedTarget)) {
                      queue.push(nestedEmbed);
                    }
                  });
                }
              }
            } catch (error) {
              console.error('加载嵌入内容失败:', error);
              if (renderedRef.current && contentEl) {
                contentEl.innerHTML = `<div class="embed-error">加载失败: ${error instanceof Error ? error.message : '未知错误'}</div>`;
              }
            } finally {
              inProgress.delete(embedTarget);
              setTimeout(() => processQueue(), 50);
            }
          }
        }
      };
      
      processQueue();
    };
    
    embedsLoadedRef.current = false;
    loadEmbeds();
    return () => { embedsLoadedRef.current = false; };
  }, [html, fetchAndRenderEmbeddedContent, embedDepth, maxEmbedDepth]);

  const handleMouseOver = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const reference = target.closest('.reference');
    if (reference && references) {
      const refId = reference.getAttribute('data-ref-id');
      if (Number(refId)) {
        const refContent = references[Number(refId)];
        if (refContent) {
          const tooltip = document.createElement('div');
          tooltip.className = 'reference-tooltip';
          tooltip.innerHTML = refContent.content;
          document.body.appendChild(tooltip);
          
          const rect = reference.getBoundingClientRect();
          tooltip.style.position = 'absolute';
          tooltip.style.left = `${rect.left + window.scrollX}px`;
          tooltip.style.top = `${rect.bottom + window.scrollY + 5}px`;
          tooltip.style.maxWidth = '400px';
          
          reference.addEventListener('mouseout', () => {
            tooltip.remove();
          }, { once: true });
        }
      }
    }
  }, [references]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const closestLink = target.closest('a');
    if (closestLink && !closestLink.getAttribute('href')?.startsWith('http')) {
      e.preventDefault();
      const href = closestLink.getAttribute('href') || '';
      router.push(href);
      return;
    }
    
    const embedTitle = target.closest('.embed-title');
    if (embedTitle) {
      const embed = embedTitle.closest('.embed');
      if (embed) {
        const content = embed.querySelector('.embed-content');
        if (content) content.classList.toggle('collapsed');
      }
    }
  }, [router]);

  if (error) return <div className="markdown-error text-red-500">{error}</div>;
  if (isProcessing && !html) return <div className="markdown-loading">正在渲染内容...</div>;

  return (
    <div 
      ref={renderedRef}
      className={`prose prose-lg dark:prose-invert max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={handleClick}
      onMouseOver={handleMouseOver}
    />
  );
};

export default MarkdownRenderer;
