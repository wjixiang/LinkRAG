class MissingEntityExtractionResult {
    extracted_entities Entity[]
    reasoning string
}

function ExtractMissingEntities(
    missing_entity: string,
    existing_entities: Entity[],
    chunk_text: string
) -> MissingEntityExtractionResult {
    client "GLM4Flash"
    prompt #"
        {{_.role('system')}}
        You are a medical knowledge extraction assistant specialized in identifying and extracting missing entities from text.

        {{_.role('user')}}
        ---Instruction---
        1. Analyze the missing entity name in context of the provided text
        2. Extract detailed information about this entity from the text
        3. Compare with existing entities to avoid duplicates
        4. Return extracted entity with:
           - Name: Use most precise medical term
           - Description: Detailed description from text
           - Type: Appropriate medical category

        ---Rules---
        - Only extract if clearly present in text
        - Prefer standardized medical terminology
        - Avoid creating duplicate entities
        - Include all relevant details from text

        ---Context---
        {{ chunk_text }}

        ---Missing Entity---
        {{ missing_entity }}

        ---Existing Entities---
        {% for entity in existing_entities %}
        - {{ entity.name }} ({{ entity.type }}): {{ entity.description }}
        {% endfor %}

        ---Output---
        {{ ctx.output_format }}
    "#
}

test TestExtractMissingEntities {
    functions [ExtractMissingEntities]
    args {
        missing_entity #"心肌炎"#
        existing_entities [
            {
                name "皮肌炎"
                description "皮肌炎是一种风湿性疾病"
                type "disease"
            }
        ]
        chunk_text #"部分皮肌炎患者可出现肌肉以外的表现，包括心肌炎。心肌炎是心脏肌肉的炎症，可导致心力衰竭。"#
    }
    @@assert({{ this.extracted_entities|length > 0 }})
    @@assert({{ this.extracted_entities[0].name == "心肌炎" }})
    @@assert({{ "心脏" in this.extracted_entities[0].description }})
}