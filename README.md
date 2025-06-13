# LinkRAG/Graph-Chunking
⚠️ This project is under development

LinkRAG is a knowledge graph-based RAG (Retrieval Augmented Generation) system that improves text generation accuracy by leveraging structured knowledge from a knowledge graph.

![alt text](./docs/img/image.png)

## Features
- **Progressive knowledge graph construction**: 
    - Build up optimal and task-oriented knowledge base step by step
    - Self learning & managment powered by LLM agents
- **SurrealDB Integration** : Full-featured graph database for knowledge storage:
  - Nodes for entities and properties
  - Edges for relationships
  - Automatic schema-less document storage
  - Graph traversal queries
  - Built-in authentication and permissions
- Semantic chunking and embedding


## Concept:
### Agent-based knowledge managment

```mermaid
flowchart TD
    A(EP pairs)
    A --> B1[[Locate Entity]]
    
    B1 -->|entity found| B2[[Direct Property Lookup]]
    B1 -->|no entity| C1(Investigation Phase) --> EntityDefinitionAgent
    B1 -->|multiple entities| B3(Entity Disambiguation)
    
    subgraph EntityDefinitionAgent["Entity Definition Agent"]
        D1[HyDE Hypothesis] --> D2[RAG Retrieve Definition] --> D3[Rerank & Filter]
        D2 -->|failure| D4[Fallback: Local Cache]
    end
    
    subgraph PropertyProcessing["Property Processing"]
        B2 -->|property found| Z([Return Property Docs])
        B2 -->|property not found| E1[[Generate Property Outline]] --> E2[[Check Similar Properties]]
        E2 -->|similar exists | Z
        E2 -->|no similar| PropertyGenerationAgent
        E1 -->|timeout| E3[Use Partial Results]
    end
    
    subgraph PropertyGenerationAgent["Property Generation Agent"]
        F1[RAG Retrieve Related] --> F2[LLM Generate Summary] --> F3[Store Property]
        F2 -->|validation failed| F4[Regenerate]
    end
    
    subgraph EntityExtraction["Subset Entity Extraction"]
        G1[Extract Sub-Entities] --> G2[Filter Non-Subset] --> G3[Create New Entities] --> G4[Establish Links]
        G1 -->|parallel| G1a[Extract Type A] & G1b[Extract Type B]
    end
    
    
    classDef hotPath fill:#f9f2d9,stroke:#e6c229
    class B1,B2,E1,F2 hotPath
    
    
    H1>Metrics: Entity Lookup Time]:::metrics -.-> B1
    H2>Metrics: Property Gen Success]:::metrics -.-> F3
    classDef metrics fill:#e6f3ff,stroke:#0066cc
    
    EntityDefinitionAgent --> B2
    PropertyGenerationAgent --> EntityExtraction
    EntityExtraction --> Z
    B3 --> B1

```

### Graph-based denoise
Unlike typical "Entity-->relation-->Entity" graph structure, I adopt "Entity-->Property-->Entity" to better storing knowledge information and providing more comprehensive information. When the construction of the relationship-based knowledge graph is completed, the system will further summarize all entity-relationships and generate property nodes.

This dual-layer knowledge graph system reintegrates fragmented information points from text chunks, transforming them into independent and complete knowledge units. From this perspective, the entire system can be viewed as a novel form of 'conceptual chunking' - one that segments documents based on comprehensive understanding rather than simple sentence patterns (recurrent chunking) or semantic similarity (semantic chunking).


```mermaid
graph TD
    subgraph Chunk Layer
        A[Text Chunk 1] -->|Extract| B[Fragmented Entity A]
        A -->|Extract| C[Fragmented Entity B]
        D[Text Chunk 2] -->|Extract| C
        D -->|Extract| E[Fragmented Entity C]
    end

    subgraph Knowledge Graph Layer
        B -->|Reintegrate| F[Complete Entity A]
        C -->|Reintegrate| G[Complete Entity B] 
        E -->|Reintegrate| H[Complete Entity C]
        
        F -->|Property| I[Property X]
        G -->|Property| J[Property Y]
        H -->|Property| K[Property Z]
        

    end

    style Chunk Layer fill:#f9f9f9,stroke:#ccc
    style Knowledge Graph Layer fill:#e6f7ff,stroke:#1890ff
```


## Installation

```bash
# Using pnpm (recommended)
pnpm install

# Start SurrealDB (optional - if using local instance)
docker run --rm -p 8000:8000 surrealdb/surrealdb:latest start --log trace --user root --pass fl5ox03
```

## Configuration

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

### Required environment variables:

#### SurrealDB Configuration
- `SURREALDB_URL` - Connection URL (default: `http://127.0.0.1:8000/rpc`)
- `SURREALDB_NAMESPACE` - Database namespace (default: `test`)
- `SURREALDB_DATABASE` - Database name (default: `test`)
- `SURREALDB_USER` - Database username (default: `root`)
- `SURREALDB_PASS` - Database password (default: `fl5ox03`)

#### LLM Configuration
- `OPENAI_API_KEY` - For LLM operations

