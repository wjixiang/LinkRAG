import { BamlStream } from "@boundaryml/baml"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

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