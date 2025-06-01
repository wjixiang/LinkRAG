class HypothesizedProperty {
  hypothesis string
}

function HyDEHypothesizeProperty(
  entity: string,
  property: string
) -> HypothesizedProperty {
  client "GLM4Flash"
  prompt #"
    {{_.role('system')}}
    You are a medical knowledge generator. Given an entity and property, hypothesize what this property might describe.

    {{_.role('user')}}
    ---Entity---
    {{ entity }}
    
    ---Property---
    {{ property }}
    
    Generate a hypothetical description of what this property might mean in the context of the entity:
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