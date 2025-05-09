import { chunkit, ChunkitOptions } from 'semantic-chunking';

export async function semantic_chunking(
    text: string,
    options?: ChunkitOptions
): Promise<string[]> {
    const documents = [
        { document_name: "input_document", document_text: text }
    ];

    const chunks = await chunkit(documents, options);

    return chunks.map(chunk => chunk.text);
}