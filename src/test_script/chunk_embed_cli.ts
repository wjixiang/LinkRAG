#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import path from 'path';
import fs from 'fs';
import { RecordId } from 'surrealdb';
import KnowledgeBaseEditor from '../core/KnowledgeBaseEditor';
import { KnowledgeGraphWeaverConfig } from '../core/KnowledgeBaseEditor';
import { SemanticChunkingConfig } from '../lib/chunking/semantic_chunking';

async function main() {
    const argv = await yargs(hideBin(process.argv))
        .option('file', {
            alias: 'f',
            type: 'string',
            description: 'Path to the file to process',
            demandOption: true
        })
        .option('chunkTable', {
            alias: 't',
            type: 'string',
            description: 'Name of the chunk table in database',
            default: 'chunks'
        })
        .option('concurrency', {
            alias: 'c',
            type: 'number',
            description: 'Embedding concurrency limit',
            default: 5
        })
        .help()
        .alias('help', 'h')
        .argv;

    try {
        // Validate file exists
        const filePath = path.resolve(argv.file);
        if (!fs.existsSync(filePath)) {
            console.error(`File not found: ${filePath}`);
            process.exit(1);
        }

        // Minimal config for chunking and embedding
        const config: KnowledgeGraphWeaverConfig = {
            chunkTableName: argv.chunkTable,
            embeddingConcurrencyLimit: argv.concurrency,
            entity_table_name: 'entities', // Required but not used
            relation_table_name: 'relations', // Required but not used 
            reference_table_name: 'reference_documents', // Required but not used
            property_table_name: 'properties', // Required but not used
            semantic_search_threshold: 0.8, // Required but not used
            SemanticChunkingConfig: {
                maxChunkSize: 512,
                minChunkSize: 100,
                windowSize: 3,
                threshold: 0.85
            } as SemanticChunkingConfig
        };

        const weaver = new KnowledgeBaseEditor(config);
        
        // Connect to DB and process only chunking and embedding
        await weaver.save_to_reference_document_storage(filePath)
            .then(async (referenceId: RecordId | null) => {
                if (!referenceId) {
                    throw new Error('Failed to save reference document');
                }
                await weaver.chunking_and_embedding(referenceId);
                console.log('Successfully processed file through chunking and embedding');
            });

    } catch (error) {
        console.error('Error processing file:', error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

main();