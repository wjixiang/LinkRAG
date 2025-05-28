import axios from 'axios';
import createLoggerWithPrefix from '../console/logger';
import * as fs from 'fs/promises';
import * as path from 'path';
import FormData from 'form-data'; // Import FormData from form-data library

const logger = createLoggerWithPrefix('AlibabaBatchEmbedder');

const ALIBABA_API_KEY = process.env.ALIBABA_API_KEY;
const ALIBABA_BATCH_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'; // Base URL for batch API

interface BatchRequestItem {
    custom_id: string;
    method: string;
    url: string;
    body: {
        model: string;
        input: string; // Assuming input is a single string for each item in the batch file
        dimension?: string;
        encoding_format?: string;
    };
}

interface UploadFileResponse {
    id: string;
    bytes: number;
    created_at: number;
    filename: string;
    object: string;
    purpose: string;
    status: string;
    status_details: any;
}

interface CreateBatchJobResponse {
    id: string;
    object: string;
    endpoint: string;
    errors: any;
    input_file_id: string;
    completion_window: string;
    status: string;
    output_file_id: string | null;
    error_file_id: string | null;
    created_at: number;
    in_progress_at: number | null;
    expires_at: number | null;
    finalizing_at: number | null;
    completed_at: number | null;
    failed_at: number | null;
    expired_at: number | null;
    cancelling_at: number | null;
    cancelled_at: number | null;
    request_counts: {
        total: number;
        completed: number;
        failed: number;
    };
    metadata: any;
}


/**
 * Formats a list of texts into the JSONL format required for Alibaba Batch Embedding.
 * Each line is a JSON object with custom_id, method, url, and body.
 * @param texts - Array of text strings to embed.
 * @returns A string in JSONL format.
 */
function formatTextsToJsonl(texts: string[]): string {
    const model = 'text-embedding-v3'; // Specify the embedding model
    const endpoint_url = '/v1/embeddings'; // Endpoint for embedding batch jobs

    return texts.map((text, index) => {
        const requestItem: BatchRequestItem = {
            custom_id: `chunk_${index}`, // Unique ID for each request item
            method: 'POST',
            url: endpoint_url,
            body: {
                model: model,
                input: text,
                dimension: "1024", // Assuming these are required for the model
                encoding_format: "float"
            }
        };
        return JSON.stringify(requestItem);
    }).join('\n');
}

/**
 * Uploads a file to Alibaba Cloud Batch service.
 * @param filePath - The path to the file to upload.
 * @returns The uploaded file ID.
 */
async function uploadFile(filePath: string): Promise<string> {
    if (!ALIBABA_API_KEY) {
        throw new Error('Alibaba API key not configured');
    }

    const formData = new FormData();
    const fileContent = await fs.readFile(filePath);
    formData.append('file', fileContent, path.basename(filePath)); // Append file content directly
    formData.append('purpose', 'batch');

    try {
        const response = await axios.post(`${ALIBABA_BATCH_BASE_URL}/files`, formData, {
            headers: {
                'Authorization': `Bearer ${ALIBABA_API_KEY}`,
                ...formData.getHeaders() // Use getHeaders from form-data instance
            },
        });

        const responseData: UploadFileResponse = response.data;
        if (responseData.id) {
            logger.info(`File uploaded successfully. File ID: ${responseData.id}`);
            return responseData.id;
        } else {
            throw new Error('File upload failed: No file ID returned.');
        }
    } catch (error) {
        logger.error('Error uploading file to Alibaba Cloud:', error);
        throw error;
    }
}

/**
 * Creates a batch job on Alibaba Cloud using an uploaded file ID.
 * @param inputFileId - The ID of the uploaded file.
 * @returns The batch job ID.
 */
async function createBatchJob(inputFileId: string): Promise<string> {
     if (!ALIBABA_API_KEY) {
        throw new Error('Alibaba API key not configured');
    }

    const endpoint_url = '/v1/embeddings'; // Endpoint for embedding batch jobs

    try {
        const response = await axios.post(`${ALIBABA_BATCH_BASE_URL}/batches`, {
            input_file_id: inputFileId,
            endpoint: endpoint_url,
            completion_window: '24h', // Or another appropriate window
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ALIBABA_API_KEY}`,
            },
        });

        const responseData: CreateBatchJobResponse = response.data;
         if (responseData.id) {
            logger.info(`Batch job created successfully. Job ID: ${responseData.id}`);
            return responseData.id;
        } else {
            throw new Error('Batch job creation failed: No job ID returned.');
        }
    } catch (error) {
        logger.error('Error creating batch job on Alibaba Cloud:', error);
        throw error;
    }
}

/**
 * Initiates an asynchronous batch embedding job for a list of texts.
 * @param texts - Array of text strings to embed.
 * @returns The batch job ID.
 */
export async function createAlibabaBatchEmbeddingJob(texts: string[]): Promise<string> {
    if (!ALIBABA_API_KEY) {
        logger.error('Alibaba API key not configured. Cannot create batch embedding job.');
        throw new Error('Alibaba API key not configured.');
    }

    if (!texts || texts.length === 0) {
        logger.warn('No texts provided for batch embedding job.');
        throw new Error('No texts provided for batch embedding job.');
    }

    // 1. Format texts into JSONL
    const jsonlContent = formatTextsToJsonl(texts);

    // 2. Write JSONL content to a temporary file
    const tempFileName = `batch_embedding_input_${Date.now()}.jsonl`;
    const tempFilePath = path.join(__dirname, tempFileName); // Save in the same directory as the script

    try {
        await fs.writeFile(tempFilePath, jsonlContent, 'utf-8');
        logger.debug(`Temporary JSONL file created at: ${tempFilePath}`);

        // 3. Upload the temporary file
        const uploadedFileId = await uploadFile(tempFilePath);

        // 4. Create a batch job using the uploaded file ID
        const batchJobId = await createBatchJob(uploadedFileId);

        // Clean up the temporary file (optional, but good practice)
        await fs.unlink(tempFilePath);
        logger.debug(`Temporary JSONL file deleted: ${tempFilePath}`);

        return batchJobId;

    } catch (error) {
        logger.error('Error initiating Alibaba batch embedding job:', error);
        // Clean up temporary file if it exists
        try {
            await fs.unlink(tempFilePath);
             logger.debug(`Temporary JSONL file deleted after error: ${tempFilePath}`);
        } catch (cleanupError) {
            // Ignore cleanup errors
        }
        throw error;
    }
}

// Note: Functions for checking job status and downloading results would need to be added separately
// and would be used in a different part of the application workflow, not directly in the ChunkProcessor.