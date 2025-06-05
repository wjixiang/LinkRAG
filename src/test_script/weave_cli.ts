#!/usr/bin/env ts-node
import 'tsconfig-paths/register';
import KnowledgeBaseEditor from '../core/KnowledgeBaseEditor';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import dotenv from 'dotenv';
import { KnowledgeGraphWeaver_config } from '@/settings';

// Load environment variables
dotenv.config();

async function processFile(filePath: string) {
    // await surrealDBClient.connect()
    try {
        const weaver = new KnowledgeBaseEditor(KnowledgeGraphWeaver_config);
        
        console.log(`Processing file: ${filePath}`);
        await weaver.weave(filePath);
        console.log('Successfully processed file');
    } catch (error) {
        console.error('Error processing file:', error);
        process.exit(1);
    }
}

async function chunkAndEmbedFile(filePath: string, chunkTable: string, concurrency: number) {
    try {
        const config = {
            ...KnowledgeGraphWeaver_config,
            chunkTableName: chunkTable,
            embeddingConcurrencyLimit: concurrency
        };
        const weaver = new KnowledgeBaseEditor(config);
        
        console.log(`Chunking and embedding file: ${filePath}`);
        await weaver.chunking_and_embedding_from_path(filePath);
        console.log('Successfully chunked and embedded file');
    } catch (error) {
        console.error('Error chunking and embedding file:', error);
        process.exit(1);
    }
}

async function chunkAndEmbedFolder(folderPath: string, chunkTable: string, concurrency: number) {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    try {
        const files = await fs.readdir(folderPath);
        const config = {
            ...KnowledgeGraphWeaver_config,
            chunkTableName: chunkTable,
            embeddingConcurrencyLimit: concurrency
        };
        const weaver = new KnowledgeBaseEditor(config);

        for (const file of files) {
            const filePath = path.join(folderPath, file);
            try {
                console.log(`Processing file: ${filePath}`);
                await weaver.chunking_and_embedding_from_path(filePath);
                console.log('Successfully processed file');
            } catch (error) {
                console.error(`Error processing file ${filePath}:`, error);
                // Continue with next file
            }
        }
    } catch (error) {
        console.error('Error reading directory:', error);
        process.exit(1);
    }
}

yargs(hideBin(process.argv))
    .scriptName('weave-cli')
    .usage('$0 <command> [args]')
    .command(
        'process [file]',
        'Process a document file into knowledge graph',
        (yargs) => {
            return yargs.positional('file', {
                describe: 'Path to the document file to process',
                type: 'string',
                demandOption: true
            });
        },
        async (argv) => {
            await processFile(argv.file as string);
        }
    )
    .command(
        'chunk-embed [file]',
        'Chunk and embed a document file using the file path directly',
        (yargs) => {
            return yargs
                .positional('file', {
                    describe: 'Path to the document file to process',
                    type: 'string',
                    demandOption: true
                })
                .option('chunkTable', {
                    alias: 't',
                    type: 'string',
                    description: 'Name of the chunk table in database',
                    default: KnowledgeGraphWeaver_config.chunkTableName
                })
                .option('concurrency', {
                    alias: 'c',
                    type: 'number',
                    description: 'Embedding concurrency limit',
                    default: KnowledgeGraphWeaver_config.embeddingConcurrencyLimit
                });
        },
        async (argv) => {
            await chunkAndEmbedFile(argv.file as string, argv.chunkTable as string, argv.concurrency as number);
        }
    )
    .command(
        'chunk-embed-folder [folder]',
        'Chunk and embed all files in a folder',
        (yargs) => {
            return yargs
                .positional('folder', {
                    describe: 'Path to the folder containing files to process',
                    type: 'string',
                    demandOption: true
                })
                .option('chunkTable', {
                    alias: 't',
                    type: 'string',
                    description: 'Name of the chunk table in database',
                    default: KnowledgeGraphWeaver_config.chunkTableName
                })
                .option('concurrency', {
                    alias: 'c',
                    type: 'number',
                    description: 'Embedding concurrency limit',
                    default: KnowledgeGraphWeaver_config.embeddingConcurrencyLimit
                });
        },
        async (argv) => {
            await chunkAndEmbedFolder(argv.folder as string, argv.chunkTable as string, argv.concurrency as number);
        }
    )
    .help()
    .alias('h', 'help')
    .version('0.1.0')
    .alias('v', 'version')
    .strict()
    .parse();