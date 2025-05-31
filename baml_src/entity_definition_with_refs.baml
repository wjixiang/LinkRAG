
class EntityWithRef {
    name string
    description string
    type string
    aliases string[]
    reference int[]
}


function DefineEntityWithReferences(
    entity_name:string,
    reference_documents:string[],
    language:string // "English" or "中文"
) -> EntityWithRef {
    client "GLM4Flash"
    prompt #"
    {{_.role("system")}}
    You are a medical knowledge expert. Given an entity name and reference documents,

    {{_.role("user")}}
    generate a comprehensive definition following these rules:

    1. Analyze all reference documents to extract relevant information
    2. Identify the most likely entity type (disease, symptom, treatment, etc)
    3. Include all common aliases/synonyms
    4. Prioritize single paragraph
    5. All content must be strictly based on given documents
    6. All aliases must be strictly based on given documents. Each alias must be completely synonymous with others. If the one you not sure, don't outout it.
    7. Output index of documents you referenced and exclude not-related documents

    Entity: {{entity_name}}
    Language: {{language}}
    Reference Documents:
    {% for doc in reference_documents %}
    --- Document {{loop.index}} ---
    {{doc}}
    {% endfor %}
    --- Output ---
    ## Resoning Steps
    Give your analysis for each document and evaluate relevancy

    ## Final Output 
    {{ ctx.output_format }}
    "#
}

