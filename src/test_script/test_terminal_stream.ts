import * as dotenv from 'dotenv';
import { b } from 'baml_client/async_client';
dotenv.config()

const test_stream = async () => {
    const stream =  b.stream.HyDE_rewrite("Therapy of hypertension", "en")
    let preContent = ""
    
    for await (const chunk of stream) {
        if (chunk?.HyDE_answer) {
            
            process.stdout.write(chunk.HyDE_answer.substring(preContent.length))
            preContent = chunk.HyDE_answer
        }
    }
    
    process.stdout.write('\n') // Add newline at end
}

test_stream().catch(err => {
    console.error('Stream error:', err)
    process.exit(1)
})