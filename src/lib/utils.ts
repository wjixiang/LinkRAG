import { BamlStream } from "@boundaryml/baml"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { AgentStep } from "./agent/Agent"
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

export async function *_handleStream<T>(
  stream: AsyncIterable<T>,
  processor: (item: T) => string
): AsyncGenerator<AgentStep> {
  let preContent = ""
  for await (const item of stream) {
      let currentContent = processor(item)
      yield {
          type: 'stream',
          content: currentContent.startsWith(preContent) ? currentContent.substring(preContent.length) : ""
      }
      preContent = currentContent
  }
  yield {
      type: 'stream',
      content: "",
      isFinal: true
  }
  
}

 export function generateShortHash(input: string): string {
    return crypto
      .createHash('sha256')
      .update(input)
      .digest('hex')
      .substring(0, 8)
  }