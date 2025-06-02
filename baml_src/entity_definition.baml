
function HyDEDefineEntity(
    entity_name: string,
    language: string
) -> Entity {
    client "QWen3"
    prompt #"
        {{_.role('system')}}
        You are a medical knowledge assistant that generates comprehensive definitions for medical entities.
        Use {{language}} as output language.

        {{_.role('user')}}
        ---Instruction---
        1. Generate a detailed definition for the medical entity: {{entity_name}}
        2. Include all relevant information from the provided context
        3. Identify any aliases/synonyms for the entity
        4. Determine the most appropriate entity type from:
           - disease
           - symptom  
           - treatment
           - anatomy
           - population
           - other medical concepts

        ---Output Format---
        {
            "name": "Standard name of entity",
            "description": "Detailed definition including key characteristics",
            "type": "Entity type from allowed list", 
            "aliases": ["Alternative names", "Synonyms"]
        }

        ---Output---
        {{ ctx.output_format }}
    "#
}

test TestDefineDiseaseEntity {
    functions [HyDEDefineEntity]
    args {
        entity_name #"高血压"#
        language #"中文"#
    }
    @@assert({{ this.type == "disease" }})
    @@assert({{ "血压" in this.description }})
}

test TestDefineSymptomEntity {
    functions [HyDEDefineEntity]
    args {
        entity_name #"头痛"#
        language #"中文"#
    }
    @@assert({{ this.type == "symptom" }})
    @@assert({{ "头痛" in this.description }})
}

test TestDefineDiseaseEntityEnglish {
    functions [HyDEDefineEntity]
    args {
        entity_name #"Hypertension"#
        language #"English"#
    }
    @@assert({{ this.type == "disease" }})
    @@assert({{ "blood pressure" in this.description }})
}

test TestDefineSymptomEntityEnglish {
    functions [HyDEDefineEntity]
    args {
        entity_name #"Headache"#
        language #"English"#
    }
    @@assert({{ this.type == "symptom" }})
    @@assert({{ "headache" in this.description }})
}
