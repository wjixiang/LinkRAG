function SummarizeRelations(relations: Relation[], entity_property: string, central_entity: Entity, language: string) -> string {
    client "GLM4Flash"
    prompt #"
        {{_.role("system")}}
        You are a helpful knowledge management assistant for summarizing multiple knowledge relationships about one given topic.
        Use {{language}} as output language

        {{_.role("user")}}
        ## task
        Summarize relationships about {{entity_property}} of {{central_entity.name}} ({{central_entity.type}})
        

        ## relations
        {% for relation in relations %}
        - {{relation.source_entity}} -> {{relation.relation}} -> {{relation.target_entity}}
        {% endfor %}

        ## Output Format Requirements
        1. Maximum 5 bullet points total
        2. Each point must contain synthesized knowledge
        3. Use precise medical terminology
        4. Focus on patterns not individual relations

        ## Knowledge Synthesis Template
        - **Core Pathology**: {{central_entity.name}} primarily manifests through [key patterns]
        - **Diagnostic Hallmarks**: [most characteristic features]
        - **Systemic Effects**: [secondary manifestations]
        - **Clinical Relevance**: [why these patterns matter]
        - **Knowledge Summary**: [1-sentence synthesis]

        ## rules
        1. Use only factual statements
        2. No narrative explanations
        3. Maximum 2 sentences per point
        4. Use technical/medical terminology precisely
        5. Omit any subjective language
    "#
}

test TestSummarizeRelations {
  functions [SummarizeRelations]
  args {
    relations [
      {
        source_entity "Apple"
        target_entity "iPhone"
        relation "manufactures"
      }
      {
        source_entity "Apple"
        target_entity "MacBook"
        relation "manufactures"
      }
      {
        source_entity "Apple"
        target_entity "iOS"
        relation "develops"
      }
    ]
    entity_property #"
      products
    "#
    central_entity {
      name "Apple"
      type "company"
      description "Technology company headquartered in Cupertino"
    }
  }
  @@assert({{ this|length > 0 }})
  @@assert({{ "manufactures" in this }})
  @@assert({{ "develops" in this }})
}

test TestSummarizeMedicalRelations {
  functions [SummarizeRelations]
  args {
    relations [
      {
        source_entity "皮肌炎"
        target_entity "皮肤"
        relation "病变累及皮肤，表现为典型红疹"
      }
      {
        source_entity "皮肌炎"
        target_entity "红疹"
        relation "典型皮肤表现是红疹"
      }
      {
        source_entity "皮肌炎"
        target_entity "心肌炎"
        relation "部分患者可出现肌肉以外的表现"
      }
    ]
    entity_property #"
      临床表现
    "#
    central_entity {
      name "皮肌炎"
      type "disease"
      description "皮肌炎是一种风湿性疾病"
    }
    language "中文"
  }
  @@assert({{ this|length > 0 }})
  @@assert({{ "皮肤" in this }})
  @@assert({{ "红疹" in this }})
  @@assert({{ "心肌炎" in this }})
}
