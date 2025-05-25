import { onLogEvent } from '../../baml_client/tracing'; // Import onLogEvent directly
import { BamlLogEvent } from '@boundaryml/baml';
import createLoggerWithPrefix from './console/logger';

const logger = createLoggerWithPrefix('BamlCollector');

// This map will store aggregated token usage per function or overall
const tokenUsage: { [key: string]: { input: number; output: number } } = {};

onLogEvent((event: BamlLogEvent) => { // Use onLogEvent directly
    // Process the log event
    // Assuming event details are in event.data
    const eventData = (event as any).data; // Use 'any' for now to avoid type errors

    logger.info(`BAML Log Event: ${eventData?.function_name} - ${eventData?.log_type}`);

    // Example: Track token usage
    if (eventData?.usage) {
        const functionName = eventData.function_name || 'unknown';
        if (!tokenUsage[functionName]) {
            tokenUsage[functionName] = { input: 0, output: 0 };
        }
        tokenUsage[functionName].input += eventData.usage.input_tokens || 0;
        tokenUsage[functionName].output += eventData.usage.output_tokens || 0;
        logger.info(`Token Usage for ${functionName}: Input - ${tokenUsage[functionName].input}, Output - ${tokenUsage[functionName].output}`);
    }

    // TODO: Implement logic to raise output level to warn based on event content
    // This might involve checking for errors or specific conditions in the event
});

// Optional: Function to get the current token usage
export const getTokenUsage = () => tokenUsage;

// Optional: Function to clear the token usage
export const clearTokenUsage = () => { // Exported function
    for (const key in tokenUsage) {
        delete tokenUsage[key]; // Corrected variable name
    }
};

// Inform the user about setting BAML_LOG environment variable for 'warn' level
logger.warn("To raise BAML's terminal output level to 'warn', please set the BAML_LOG environment variable to 'warn'.");