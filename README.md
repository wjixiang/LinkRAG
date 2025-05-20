# LinkRAG
⚠️ This project is under development

LinkRAG is a knowledge graph-based RAG (Retrieval Augmented Generation) system that improves text generation accuracy by leveraging structured knowledge from a knowledge graph.

## Concept
Unlike typical "Entity-->relation-->Entity" graph structure, I adopt "Entity-->Property-->Entity" to better storing knowledge information and providing more comprehensive information. When the construction of the relationship-based knowledge graph is completed, the system will further summarize all entity-relationships and generate property nodes.

![alt text](./docs/img/image.png)

## Features

- SurrealDB integration for graph/vector/document storage
- Semantic chunking and embedding
- Multiple LLM workflow configurations

## Installation

```bash
# Using pnpm (recommended)
pnpm install linkrag

# Using npm
npm install linkrag
```

## Configuration

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Required environment variables:
- `OPENAI_API_KEY` - For LLM operations
- `SURREALDB_URL` - SurrealDB connection URL
- `SURREALDB_NAMESPACE` - Database namespace
- `SURREALDB_DATABASE` - Database name
- `SURREALDB_USER` - Database username
- `SURREALDB_PASS` - Database password

## Basic Usage

```typescript
import { KnowledgeGraphProcessor } from 'linkrag';

// Initialize the knowledge graph processor
const processor = new KnowledgeGraphProcessor();

// Process documents and build knowledge graph
await processor.processDocuments([
  { content: 'Your document text here...', metadata: {} }
]);

// Retrieve relevant context for a query
const context = await processor.retrieveContext('your query');
```

## Core Components

- **DocumentProcessor**: Handles document ingestion and preprocessing
- **EntityExtractor**: Extracts entities from text
- **RelationExtractor**: Identifies relationships between entities
- **GraphGenerator**: Constructs knowledge graphs
- **KnowledgeGraphRetriever**: Retrieves relevant graph segments for queries

## Testing

Run test scripts:

```bash
# Run all tests
pnpm test

# Or run individual test files
ts-node src/test_script/test_rag_workflow.ts
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -am 'Add some feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

## License

MIT