export function semantic_chunking(
    text: string,
    chunkSize: number,
    overlap: number
): { chunk: string; index: number }[] {
    const chunks: { chunk: string; index: number }[] = [];
    const words = text.split(' ');
    let currentChunk = '';
    let currentIndex = 0;

    for (const word of words) {
        if (currentChunk.length + word.length + 1 > chunkSize) {
            chunks.push({ chunk: currentChunk.trim(), index: currentIndex });
            currentIndex += currentChunk.split(' ').length - overlap;
            currentChunk = '';
        }
        currentChunk += word + ' ';
    }

    if (currentChunk) {
        chunks.push({ chunk: currentChunk.trim(), index: currentIndex });
    }

    return chunks;
}