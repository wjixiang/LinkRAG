class Relation {
    source_entity string
    target_entity string
    relation string
}

class RelationExtractResult {
  source_entity int
  target_entity int
  relation string
}

function Extract_relations(content:string, entities: Entity[], language: string) -> RelationExtractResult[] {
    client "GLM4Flash"
    prompt #"
        {{_.role('system')}}
        ---instruction
        1. You are a helpful assistant that extracts relations among the given entities from a given text.
        2. The entities must be one of the input entities.
        3. Given a text document that is potentially relevant to this activity and a list of entity types, identify relationships among the identified entities.
        4. Use {{language}} as main output language.
        5. Using the original words to describe the `realtion` preferentially, and as detailed as possible.
        
        ---Steps---
        1. From the entities, identify all pairs of (source_entity, target_entity) that are *clearly related* to each other.
        2. For each pair of related entities, extract the following information:
            - source_entity: The index (1-based) of the source entity in the input entities list
            - target_entity: The index (1-based) of the target entity in the input entities list
            - relation: explanation as to why you think the source entity and the target entity are related to each other.
        3. Identify high-level key words that summarize the main concepts, themes, or topics of the entire text. These should capture the overarching ideas present in the document.
        

        {{_.role('user')}}
        ---input---
        # document
        {{ content }}

        # entities
        {% for entity in entities %}
        - entity{{ loop.index }}: {{ entity.name }}
            - entity type: {{entity.type}}
            - entity description: {{ entity.description }}
        {% endfor %}

        ---output---
        {{ ctx.output_format }}
    "#
}

function Extract_relations_Loop(content:string, language: string, already_identified_relations:Relation[], new_indentified_entities:Entity[]) -> Relation[] {
    client "GLM4Flash"
    prompt #"
        {{_.role('system')}}
        You are a helpful assistant that key extracts new relations among the given entities from a given text.
        You must only extract new relations based on newly extracted entities and already indentified rlelations
        The entities must be one of the input entities, It will be fatal error if you extract dupilcated relations.  

        Given a text document that is potentially relevant to this activity and a list of entity types, identify relationships among the identified entities.
        Use {{language}} as main output language, and use English in relation field.

        
        ---Steps---
        1. From the entities, identify all pairs of (source_entity, target_entity) that are *clearly related* to each other.
        2. For each pair of related entities, extract the following information:
            - source_entity: name of the source entity, must be one of the input entities
            - target_entity: name of the target entity, must be one of the input entities
            - relation: explanation as to why you think the source entity and the target entity are related to each other.
        

        {{_.role('user')}}
        ---input---
        # document
        {{ content }}

        # already_identified_relations
        {% for relation in already_identified_relations %}
        - exised relation {{loop.index}}: 
            - source_entity: {{relation.source_entity}}
            - target_entity: {{relation.target_entity}}
            - relation: {{relation.relation}}
        {% endfor %}

        # new entities
        {% for entity in new_indentified_entities %}
        - entity: {{ entity.name }}
            - entity type: {{entity.type}}
            - entity description: {{ entity.description }}
        {% endfor %}

        ---output---
        {{ ctx.output_format }}
    "#
}

test TestExtractRelations {
  functions [Extract_relations]
  args {
    content #"
性阻塞性肺疾病（chronic obstructive pulmonary disease，COPD）简称慢阻肺病，是一种异质性的肺部疾病，以因气道异常（支气管炎、细支气管炎）和 / 或肺泡异常（肺气肿）进而引起慢性呼吸症状（呼吸困难、咳嗽、咳痰）及持续的、进行性加重的气流受限为特征。不可逆气流受限是诊断慢阻肺病的关键，在吸入支气管扩张剂后，第一秒用力呼气容积（FEV 1）与用力肺活量（FVC）的比值（FEV 1 / FVC）＜70% 表明存在持续气流受限。
    "#
    entities [
      {
        name "慢性阻塞性肺疾病"
        description "慢性阻塞性肺疾病(COPD)是一种异质性的肺部疾病，以气道异常和肺泡异常引起慢性呼吸症状及持续气流受限为特征。"
        type "disease"
        aliases []
      },
      {
        name "慢阻肺病"
        description "慢性阻塞性肺疾病的简称，特征为慢性呼吸症状和持续气流受限."
        type "disease"
        aliases []
      },
      {
        name "支气管炎"
        description "气道异常表现之一，可导致慢性呼吸症状."
        type "disease"
        aliases []
      },
      {
        name "细支气管炎"
        description "气道异常表现之一，可导致慢性呼吸症状."
        type "disease"
        aliases []
      },
      {
        name: "肺气肿"
        description "肺泡异常表现之一，可导致慢性呼吸症状."
        type "disease"
        aliases []
      },
      {
        name "呼吸困难"
        description "慢性阻塞性肺疾病的主要症状之一，由气道和肺泡异常引起."
        type "symptom"
        aliases []
      },
      {
        name "咳嗽"
        description "慢性阻塞性肺疾病的主要症状之一，由气道和肺泡异常引起."
        type "symptom"
        aliases []
      },
      {
        name "咳痰"
        description "慢性阻塞性肺疾病的主要症状之一，由气道和肺泡异常引起."
        type "symptom"
        aliases []
      },
      {
        name "气流受限"
        description "慢性阻塞性肺疾病的关键特征，表现为FEV1/FVC比值＜70%。."
        type "sign"
        aliases []
      }
    ]
    language "Chinese"
  }
  // Expected output using entity indices
  // @@assert({{ this[0].source_entity == 1 }})
  // @@assert({{ this[0].target_entity == 2 }})
  // @@assert({{ this[0].relation == "简称" }})
  // @@assert({{ this[1].source_entity == 1 }})
  // @@assert({{ this[1].target_entity == 3 }})
  // @@assert({{ this[1].relation == "以...为特征，气道异常表现之一" }})
  // @@assert({{ this[2].source_entity == 1 }})
  // @@assert({{ this[2].target_entity == 4 }})
  // @@assert({{ this[2].relation == "以...为特征，气道异常表现之一" }})
  // @@assert({{ this[3].source_entity == 1 }})
  // @@assert({{ this[3].target_entity == 5 }})
  // @@assert({{ this[3].relation == "以...为特征，肺泡异常表现之一" }})
  // @@assert({{ this[4].source_entity == 1 }})
  // @@assert({{ this[4].target_entity == 6 }})
  // @@assert({{ this[4].relation == "引起慢性呼吸症状" }})
  // @@assert({{ this[5].source_entity == 1 }})
  // @@assert({{ this[5].target_entity == 7 }})
  // @@assert({{ this[5].relation == "引起慢性呼吸症状" }})
  // @@assert({{ this[6].source_entity == 1 }})
  // @@assert({{ this[6].target_entity == 8 }})
  // @@assert({{ this[6].relation == "引起慢性呼吸症状" }})
  // @@assert({{ this[7].source_entity == 1 }})
  // @@assert({{ this[7].target_entity == 9 }})
  // @@assert({{ this[7].relation == "持续的、进行性加重的" }})
}
