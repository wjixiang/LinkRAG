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
        // Send initialization message
        const initMessage = {
          type: 'init',
          timestamp: new Date(),
          status: 'start'
        };
        controller.enqueue(encoder.encode(JSON.stringify(initMessage) + '\n'));

        // Process and send stream chunks
        for await (const step of transformedStream) {
          const chunk = JSON.stringify({
            ...step,
            timestamp: new Date() // Add timestamp to each message
          }) + '\n';
          controller.enqueue(encoder.encode(chunk));
        }

        // Send completion message
        const doneMessage = {
          type: 'init',
          timestamp: new Date(),
          status: 'end'
        };
        controller.enqueue(encoder.encode(JSON.stringify(doneMessage) + '\n'));
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