#!/usr/bin/env ts-node
import 'tsconfig-paths/register';
import KnowledgeGraphWeaver from '../core/KnowledgeGraphWeaver';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import dotenv from 'dotenv';
import { surrealDBClient } from '@/database/surrealdbClient';

// Load environment variables
dotenv.config();

// Define configuration
const config = {
    chunkTableName: 'chunk',
    embeddingConcurrencyLimit: 5,
    entity_table_name: 'entity',
    relation_table_name: 'relation',
    reference_table_name: 'reference_document'
};

async function processFile(filePath: string) {
    // await surrealDBClient.connect()
    try {
        const weaver = new KnowledgeGraphWeaver(config);
        console.log(`Processing file: ${filePath}`);
        await weaver.weave(filePath);
        console.log('Successfully processed file');
    } catch (error) {
        console.error('Error processing file:', error);
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
    .help()
    .alias('h', 'help')
    .version('0.1.0')
    .alias('v', 'version')
    .strict()
    .parse();