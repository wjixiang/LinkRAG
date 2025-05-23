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
pnpm install

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