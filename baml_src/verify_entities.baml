class EntityMatchResult {
    entity_name string
    is_match bool
    matched_entity_name string @description("Empty if no match")
    reasoning string
}

function VerifyEntities(
    target_entity: string,
    existing_entities: Entity[],
    context: string
) -> EntityMatchResult {
    client "GLM4Flash"
    prompt #"
        {{_.role('system')}}
        You are a medical knowledge validation assistant. Your task is to determine if a target entity matches any existing entities.

        {{_.role('user')}}
        ---Instruction---
        1. Matching must ONLY be based on the `entity name` column in the "Existing Entities" table. The `entity description` is for context and reasoning AFTER a match is found based on name/acronym, but should NOT be used for matching.
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
        | entity name | entity type | entity description |
        | ----------- | ----------- | ------------------ |
        {% for entity in existing_entities %}
        | {{ entity.name }} | ({{ entity.type }}) | {{ entity.description }} |
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
                description "慢性阻塞性肺疾病(COPD)是一种异质性的肺部疾病"
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
                description "肾小球轻微病变（minor glomerular lesion） 包括微小病变型肾病（minimal change disease， MCD）。"
                type "disease"
            },
            {
                name "局灶节段性肾小球病变"
                description "局灶节段性肾小球病变（focal segmental lesion） 包括局灶节段性肾小球硬化（focal segmental glomerulosclerosis，FSGS）和局灶性肾小球肾炎（focal glomerulonephritis）。"
                type "disease"
            },
            {
                name "弥漫性肾小球肾炎"
                description "弥漫性肾小球肾炎（diffuse glomerulonephritis） （1）膜性肾病（membranous nephropathy，MN）。 （2） 增生性肾小球肾炎（proliferative glomerulonephritis）：① 系膜增生性肾小球肾炎（mesangial proliferative glomerulonephritis）；②毛细血管内增生性肾小球肾炎（endocapillary proliferative glomerulonephritis）； ③ 系膜毛细血管性肾小球肾炎（mesangial capillary glomerulonephritis），包括膜增生性肾小球肾炎 （membranoproliferative glomerulonephritis，MPGN）Ⅰ型和Ⅲ型；④致密物沉积病（dense deposit disease），又称为膜增生性肾小球肾炎Ⅱ型；⑤新月体性肾小球肾炎（crescentic glomerulonephritis）。 （3）硬化性肾小球肾炎（sclerosing glomerulonephritis）。"
                type "disease"
            },
            {
                name "未分类的肾小球肾炎"
                description "未分类的肾小球肾炎（unclassified glomerulonephritis） 肾小球疾病的临床和病理类型之间存在一定联系，但两者之间没有必然的对应关系，即相同的临床表现可来源于不同的病理类型，而同一病理类型又可呈现不同的临床表现。"
                type "disease"
            },
            {
                name "微小病变型肾病"
                description "微小病变型肾病（minimal change disease， MCD）。"
                type "disease"
            },
            {
                name "局灶节段性肾小球硬化"
                description "局灶节段性肾小球硬化（focal segmental glomerulosclerosis，FSGS）。"
                type "disease"
            },
            {
                name "局灶性肾小球肾炎"
                description "局灶性肾小球肾炎（focal glomerulonephritis）。"
                type "disease"
            },
            {
                name "膜性肾病"
                description "膜性肾病（membranous nephropathy，MN）。"
                type "disease"
            },
            {
                name "系膜增生性肾小球肾炎"
                description "系膜增生性肾小球肾炎（mesangial proliferative glomerulonephritis）。"
                type "disease"
            },
            {
                name "毛细血管内增生性肾小球肾炎"
                description "毛细血管内增生性肾小球肾炎（endocapillary proliferative glomerulonephitis）。"
                type "disease"
            },
            {
                name "系膜毛细血管性肾小球肾炎"
                description "系膜毛细血管性肾小球肾炎（mesangial capillary glomerulonephritis），包括膜增生性肾小球肾炎 （membranoproliferative glomerulonephritis，MPGN）Ⅰ型和Ⅲ型。"
                type "disease"
            },

            {
                name "新月体性肾小球肾炎"
                description "新月体性肾小球肾炎（crescentic glomerulonephritis）。"
                type "disease"
            },
            {
                name "硬化性肾小球肾炎"
                description "硬化性肾小球肾炎（sclerosing glomerulonephritis）。"
                type "disease"
            }
        ]
        context #"  "#
    }
    @@assert({{ this.is_match == false }})
    // @@assert({{ this.matched_entity_name == "致密物沉积病" }})
}