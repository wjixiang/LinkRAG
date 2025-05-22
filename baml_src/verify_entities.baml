class EntityMatchResult {
    entity_name string
    is_match bool
    matched_entity_name string @description("Empty if no match")
    reasoning string
}

function VerifyEntities(
    target_entity: string,
    existing_entities: Entity[], // Entity should now include aliases and exclude description
    context: string
) -> EntityMatchResult {
    client "GLM4Flash"
    prompt #"
        {{_.role('system')}}
        You are a medical knowledge validation assistant. Your task is to determine if a target entity matches any existing entities based on their name or aliases.

        {{_.role('user')}}
        ---Instruction---
        1. Matching must ONLY be based on the `entity name` or `entity aliases` columns in the "Existing Entities" table.
        2. Analyze if the target entity matches any existing entities based on the strict matching rules below.
        3. `matched_entity_name` must be one of the exact values from the `entity name` column in the "Existing Entities" table.
        4. Must merge entity strictly based on given content. If given content doesn't refer, DO NOT merge entities.
        5. Strict matching rules:
            - Only allow merging if:
              * Names are identical (after normalization)
              OR
              * One is an exact acronym of the other (e.g. "COPD" and "Chronic Obstructive Pulmonary Disease")
            - Do NOT merge based on:
              * YOUR SUBJECTIVE COMPREHENSION or EXTERNAL KNOWLEDGE, Partial name similarity
              * Similar descriptions alone
              * Parent/child relationships
              * Conceptual similarity
              * If the given content doesn't refer, DON'T merge entities no matter how similar they are
        6. Must provide clear reasoning for any match

        ---Context---
        {{ context }}

        ---Target Entity---
        {{ target_entity }}

        ---Existing Entities---
        | entity name | entity type | entity aliases |
        | ----------- | ----------- | -------------- |
        {% for entity in existing_entities %}
        | {{ entity.name }} | ({{ entity.type }}) | {{ entity.aliases | join(', ') }} |
        {% endfor %}

        ---Output---
        {{ ctx.output_format }}
    "#
}

test TestVerifyEntities {
    functions [VerifyEntities]
    args {
        target_entity #"COPD"#
        existing_entities [
            {
                name "慢性阻塞性肺疾病"
                aliases ["COPD"]
                type "disease"
            }
        ]
        context #"Medical text about respiratory diseases"#
    }
    @@assert({{ this.is_match == true }})
    @@assert({{ this.matched_entity_name == "慢性阻塞性肺疾病" }})
}

test TestVerifyEntities2 {
    functions [VerifyEntities]
    args {
        target_entity #"膜增生性肾小球肾炎Ⅱ型"#
        existing_entities [
            {
                name "肾小球轻微病变"
                aliases []
                description ""
                type "disease"
            },
            {
                name "局灶节段性肾小球病变"
                aliases []
                description ""
                type "disease"
            },
            {
                name "弥漫性肾小球肾炎"
                aliases []
                description ""
                type "disease"
            },
            {
                name "未分类的肾小球肾炎"
                aliases []
                description ""
                type "disease"
            },
            {
                name "微小病变型肾病"
                aliases ["MCD"]
                description ""
                type "disease"
            },
            {
                name "局灶节段性肾小球硬化"
                aliases ["FSGS"]
                description ""
                type "disease"
            },
            {
                name "局灶性肾小球肾炎"
                aliases []
                description ""
                type "disease"
            },
            {
                name "膜性肾病"
                aliases ["MN"]
                description ""
                type "disease"
            },
            {
                name "系膜增生性肾小球肾炎"
                aliases []
                description ""
                type "disease"
            },
            {
                name "毛细血管内增生性肾小球肾炎"
                aliases []
                description ""
                type "disease"
            },
            {
                name "系膜毛细血管性肾小球肾炎"
                aliases ["MPGN"]
                description ""
                type "disease"
            },
            {
                name "新月体性肾小球肾炎"
                aliases []
                description ""
                type "disease"
            },
            {
                name "硬化性肾小球肾炎"
                aliases []
                description ""
                type "disease"
            }
        ]
        context #"  "#
    }
    @@assert({{ this.is_match == false }})
    // @@assert({{ this.matched_entity_name == "致密物沉积病" }})
}