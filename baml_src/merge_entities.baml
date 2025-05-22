function MergeEntities(previous_entity: Entity, latest_entity: Entity, language: string) -> string {
    client "GLM4Flash"
    prompt #"
        {{_.role("system")}}
        You are a knowledge management assistant for deeply merging and synthesizing entity descriptions.
        Use {{language}} as output language.
        ---step---
        1. Carefully analyze the current entity description and the new information provided.
        2. Synthesize and integrate the information from both descriptions into a single, cohesive narrative.
        3. Resolve any conflicting or redundant information, prioritizing accuracy and completeness.
        4. Ensure the final merged description is concise, accurate, and flows naturally.

        ---rules---
        - The output must be a single string containing the deeply merged and synthesized description.
        - Avoid simply concatenating the original descriptions.
        - Focus on creating a unified and comprehensive description.
        - Use precise terminology relevant to the entity's domain.

        ---output format---
        Return only the deeply merged and synthesized description of the entity as a single string.

        {{_.role("user")}}
        ---task---
        - Current definition:  {{previous_entity.description}}
        - new information ready to be merged: {{latest_entity.description}}
        
        ---response---
        {{ctx.output_format}}
        
    "#
}

test TestMergeBasicEntities {
  functions [MergeEntities]
  args {
    previous_entity {
      name "Apple Inc."
      type "company"
      description "A technology company that designs, develops, and sells consumer electronics, computer software, and online services."
    }
    latest_entity {
      name "Apple"
      type "tech company"
      description "Apple is a multinational technology company headquartered in Cupertino, California, that designs, develops, and sells consumer electronics, computer software, and online services."
    }
  }
}

test TestMergeMedicalEntities {
  functions [MergeEntities]
  args {
    previous_entity {
      name "Diabetes Mellitus"
      type "disease"
      description "Diabetes Mellitus is a chronic metabolic disorder characterized by elevated levels of blood glucose (hyperglycemia). It can lead to serious complications affecting the heart, blood vessels, eyes, kidneys, and nerves. Symptoms may include increased thirst, frequent urination, unexplained weight loss, and fatigue."
    }
    latest_entity {
      name "Type 2 Diabetes"
      type "chronic metabolic disease"
      description "Type 2 Diabetes is the most common form of diabetes, characterized by insulin resistance, where the body's cells don't respond effectively to insulin, and eventually, the pancreas may not produce enough insulin. Risk factors include obesity, physical inactivity, and genetics. Management often involves lifestyle changes, oral medications, and sometimes insulin therapy."
    }
  }
}

test TestMergeMedicalEntitiesChinese {
  functions [MergeEntities]
  args {
    previous_entity {
      name "高血压"
      type "疾病"
      description "高血压是一种常见的慢性病，主要特征是动脉血压持续升高。"
    }
    latest_entity {
      name "原发性高血压"
      type "心血管疾病"
      description "原发性高血压，又称高血压病，是一种原因不明的慢性非传染性疾病，占高血压患者的90%以上。它通常与遗传、不良生活习惯（如高盐饮食、缺乏运动、肥胖、吸烟饮酒）等因素有关。"
    }
  }
}
