"use server"

import { NextRequest } from 'next/server';
import { ChatReq } from '@/hooks/ChatRuntime';
import { AgentService } from './agentService';

// Remove edge runtime since we need Node.js APIs
// export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const requestData: ChatReq = await req.json();
    const agentService = await AgentService.getInstance('session-id');
    const agentStream = agentService.processRequest(requestData);
    const transformedStream = agentService.transformAgentStream(agentStream);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        for await (const step of transformedStream) {
          const chunk = JSON.stringify(step) + '\n';
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    });
  } catch (error) {
    console.error('Error in chatbot API:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}