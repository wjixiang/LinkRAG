class Entity {
    name string
    description string
    type string
    aliases string[]
}

class EntityExtractionExample {
  entity_type string[]
  example_input string
  extracted_entities Entity[]
}

function ExtractEntity(chunk_text:string, entity_type: string[], ) -> Entity[] {
  client "GLM4Flash"
  prompt #"
  {{_.role('user')}}

  ---role---
  You are a helpful assistant that extracts entities and relations from a given text.

  ---instruction---
  1. Given a piece of text, extract the main entity and its attributes. The main entity is usually a disease or a medical condition.
  2. The output should be a list of entities, each with a name, description, type and aliases.
  3. The name should be the canonical name of the entity.
  4. The aliases should include all alternative names found in text.
  5. The type should be one of the following: {{entity_type}}
  6. The description should strictly follow the text, without additional interpretation. Prioritize using the original text.
  
  ---rule---
  1. Entity should be one object. It should not be a combination of multiple objects. (e.g. EntityA ✅ ; EntityA and EntityB ❌)

  ---example---
  ###example_input###
  乳腺囊性增生病（breast cystic hyperplasia）亦称乳腺病、乳腺小叶增生症、乳腺结构不良症、纤维囊性病，常见于中年女性。其病理形态表现多样，增生可发生于腺管周围并伴有大小不等的囊肿形成，囊内含淡黄色或棕褐色液体；或腺管内表现为不同程度的乳头状增生，伴乳管囊性扩张；也有发生于小叶实质者，主要为乳管及腺泡上皮增生。
  
  ###example_output###
  [
    {
      name: "乳腺囊性增生病"
      description: "乳腺囊性增生病（breast cystic hyperplasia）亦称乳腺病、乳腺小叶增生症、乳腺结构不良症、纤维囊性病，常见于中年女性。其病理形态表现多样，增生可发生于腺管周围并伴有大小不等的囊肿形成，囊内含淡黄色或棕褐色液体；或腺管内表现为不同程度的乳头状增生，伴乳管囊性扩张；也有发生于小叶实质者，主要为乳管及腺泡上皮增生。"
      type: "disease"
      aliases: ["乳腺病", "乳腺小叶增生症", "乳腺结构不良症", "纤维囊性病"]
    },
    {
      name: "中年女性"
      description: "中年女性是一种人群，容易发生乳腺囊性增生病。"
      type: "population"
    }
  ]

  ---input---
  {{ chunk_text }}
  ---output---
  {{ ctx.output_format }}
  "#
}


function ExtractEntityLoop(chunk_text:string, entity_type: string[], already_identified_entities: Entity[], already_identified_relations: Relation[]) -> Entity[] {
  client "GLM4Flash"
  prompt #"
  {{_.role('system')}}
  You are a helpful assistant that extracts entities and relations from a given text.
  You should keep extracting entities until the text is fully processed based on the input entities that already identified.
  You should keep extracting entities until the text is fully processed based on the relations that already missing identified entities.

  ---instruction---
  1. Given a piece of text, extract the main entity and its attributes. The main entity is usually a disease or a medical condition.
  2. The output should be a list of entities, each with a name, description, type and aliases.
  3. The name should be the canonical name of the entity.
  4. The aliases should include all alternative names found in text (e.g. after "亦称", "又称", "也叫" etc).
  5. The type should be one of the following: {{entity_type}}
  6. The description should strictly follow the text, without additional interpretation. Prioritize using the original text.
  
  ---example---
  ###example_input###
  乳腺囊性增生病（breast cystic hyperplasia）亦称乳腺病、乳腺小叶增生症、乳腺结构不良症、纤维囊性病，常见于中年女性。其病理形态表现多样，增生可发生于腺管周围并伴有大小不等的囊肿形成，囊内含淡黄色或棕褐色液体；或腺管内表现为不同程度的乳头状增生，伴乳管囊性扩张；也有发生于小叶实质者，主要为乳管及腺泡上皮增生。
  
  ###example_output###
  [
    {
      name: "乳腺囊性增生病"
      description: "乳腺囊性增生病（breast cystic hyperplasia）亦称乳腺病、乳腺小叶增生症、乳腺结构不良症、纤维囊性病，常见于中年女性。其病理形态表现多样，增生可发生于腺管周围并伴有大小不等的囊肿形成，囊内含淡黄色或棕褐色液体；或腺管内表现为不同程度的乳头状增生，伴乳管囊性扩张；也有发生于小叶实质者，主要为乳管及腺泡上皮增生。"
      type: "disease"
      aliases: ["乳腺病", "乳腺小叶增生症", "乳腺结构不良症", "纤维囊性病"]
    },
    {
      name: "中年女性"
      description: "中年女性是一种人群，容易发生乳腺囊性增生病。"
      type: "population"
    }
  ]

  {{_.role('user')}}
  ---already_identified_entities---
  {% for entity in already_identified_entities %}
  - entity: {{ entity.name }}
      - entity type: {{entity.type}}
      - entity description: {{ entity.description }}
  {% endfor %}

  ---already_identified_relations---
  {% for relation in already_identified_relations %}
  - source_entity: {{ relation.source_entity }}
      - target_entity: {{relation.target_entity}}
      - relation: {{ relation.relation }}

  {% endfor %}
  
  ---input---
  {{ chunk_text }}
  ---output---
  {{ ctx.output_format }}
  "#
}

function ExtractEntityFromQuery(query: string) -> Entity[] {
  client "GLM4Flash"
  prompt #"
  {{_.role('user')}}

  ---role---
  You are a medical knowledge extraction assistant that identifies entities from user queries.

  ---instruction---
  1. Analyze the user query to extract both high-level concepts and specific entities
  2. Consider the conversation context if available
  3. Output entities in standard format with name, description, type and aliases
  4. Maintain the same language as the query
  5. Entity types should be relevant to medical domain (disease, symptom, treatment etc.)

  ---example---
  ###example_input###
  患者最近有头痛和视力模糊，怀疑是青光眼

  ###example_output###
  [
    {
      name: "头痛",
      description: "患者最近有头痛",
      type: "symptom",
      aliases: []
    },
    {
      name: "视力模糊",
      description: "患者有视力模糊",
      type: "symptom",
      aliases: []
    },
    {
      name: "青光眼",
      description: "怀疑是青光眼",
      type: "disease",
      aliases: []
    }
  ]

  ---input---
  {{ query }}

  ---output---
  {{ ctx.output_format }}
  "#
}

function ExtractEntityFromProperty(core_entity_name: string,property_name: string, property_content: string, entity_type: string[]) -> Entity[] {
  client "GLM4Plus"
  prompt #"
  {{_.role('system')}}
  You are a medical knowledge extraction assistant that identifies subset entities from given content.
  {{_.role('user')}}
  ---instruction---
  1. Given a piece of text, extract the main entity and its attributes. 
  2. The output should be a list of entities, each with a name, description, type and aliases.
  3. The name should be the canonical name of the entity.
  4. The aliases should include all alternative names found in text.
  5. The type should be one of the following: {{entity_type}}
  6. The description should strictly follow the text, without additional interpretation. Prioritize using the original text.
  7. The type of extracted entities must belong to "{{property_name}} of {{core_entity_name}}". If one entity exist in given content but being descripted not belong to  "{{property_name}} of {{core_entity_name}}", don't output it.

  ---steps---
  1. Find out entities
  2. Exclude the entities which don't belong to {{property_name}}
  3. Output final result

  ---input---
  {{ property_content }}

  ---output---
  {{ ctx.output_format }}
  "#
}

template_string EntityExtractExamples(examples: EntityExtractionExample) #"
  {% for example in examples %}
  ## EXAMPLE {{ loop.index }}
  ### input_content
  {{example.example_input}}
  ### entity_type
  {{example.entity_type}}
  ### extracted_entities
  {{example.extracted_entities}}
  
  {% endfor %}
"#


test TestExtractMainEntity {
  functions [ExtractEntity]
  args {
    chunk_text #"
      弥漫性肾小球肾炎（diffuse glomerulonephritis） （1）膜性肾病（membranous nephropathy，MN）。 （2） 增生性肾小球肾炎（proliferative glomerulonephritis）：① 系膜增生性肾小球肾炎（mesangial proliferative glomerulonephritis）；②毛细血管内增生性肾小球肾炎（endocapillary proliferative glomerulonephritis）； ③ 系膜毛细血管性肾小球肾炎（mesangial capillary glomerulonephritis），包括膜增生性肾小球肾炎 （membranoproliferative glomerulonephritis，MPGN）Ⅰ型和Ⅲ型；④致密物沉积病（dense deposit disease），又称为膜增生性肾小球肾炎Ⅱ型；⑤新月体性肾小球肾炎（crescentic glomerulonephritis）。 （3）硬化性肾小球肾炎（sclerosing glomerulonephritis）。
    "#
    entity_type ["disease", "symptom","body_part","organ","tissue","cell", "pathology_change","medicine","treatment","surgery", "population", "examination","diagnosis","etiology","risk_factor","prognosis","complication","differential_diagnosis","prevention"]
  }
}

test TestExtractEntityFromQuery {
  functions [ExtractEntityFromQuery]
  args {
    query #"
      类风湿性关节炎的发病机制
    "#
  }
}
