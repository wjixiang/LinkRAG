import { BamlStream } from "@boundaryml/baml"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { AgentStep } from "./agent/BaseNode"
import crypto from "crypto"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function console_streaming( stream: BamlStream<any, any> ) {
  let preContent = ""
    
    for await (const chunk of stream) {
        if (chunk?.HyDE_answer) {
            
            process.stdout.write(chunk.HyDE_answer.substring(preContent.length))
            preContent = chunk.HyDE_answer
        }
    }
    
    process.stdout.write('\n') // Add newline at end
}

/**
 * Processes an async stream of items and yields AgentStep objects with streaming content.
 *
 * @template T - The type of items in the input stream
 * @param stream - Async iterable stream of items to process
 * @param processor - Function that converts each item to a string representation
 * @yields {AgentStep} - Agent steps with streaming content:
 *   - For each item, yields content that's new since the last item
 *   - At end of stream, yields a final empty step with isFinal: true
 * @example
 * const stream = getSomeAsyncStream();
 * for await (const step of _handleStream(stream, item => item.toString())) {
 *   // Handle streaming updates
 * }
 */
export async function *_handleStream<T>(
  stream: AsyncIterable<T>,
  processor: (item: T) => string
): AsyncGenerator<AgentStep> {
  let preContent = ""
  for await (const item of stream) {
        let currentContent = processor(item)
        yield {
          type: 'stream',
          content: currentContent.startsWith(preContent) ? currentContent.substring(preContent.length) : "",
          task: ""
        }
        preContent = currentContent
  }
  yield {
    type: 'stream',
    content: "",
    isFinal: true,
    task: ""
  }
  
}

 export function generateShortHash(input: string): string {
    return crypto
      .createHash('sha256')
      .update(input)
      .digest('hex')
      .substring(0, 8)
  }