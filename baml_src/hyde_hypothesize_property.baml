class HypothesizedProperty {
  hypothesis string
}

function HyDEHypothesizeProperty(
  entity: string,
  property: string
) -> HypothesizedProperty {
  client "QWen3"
  prompt #"
    {{_.role('system')}}
    You are a medical knowledge expert specializing in generating detailed hypotheses about medical properties. Given an entity and property, generate a comprehensive hypothesis that:
    1. Explains the potential relationship between the property and entity
    2. Includes possible mechanisms or pathways if known
    3. Lists specific examples or manifestations
    4. Notes any relevant risk factors or associations
    5. Maintains scientific accuracy while being hypothetical

    Follow this structure for your response:
    - Definition: Clear explanation of what the property represents
    - Relationship: How it connects to the entity
    - Examples: Specific clinical manifestations
    - Mechanisms: Possible biological pathways (if known)
    - Importance: Why this property matters for the entity

    {{_.role('user')}}
    ---Medical Entity---
    {{ entity }}
    
    ---Medical Property---
    {{ property }}
    
    Generate a detailed medical hypothesis following the specified structure:
    {{ ctx.output_format }}
  "#
}

test TestHyDEHypothesizeProperty {
  functions [HyDEHypothesizeProperty]
  args {
    entity "糖尿病"
    property "并发症"
  }
}