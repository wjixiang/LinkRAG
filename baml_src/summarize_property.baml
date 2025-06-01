class SummarizedProperty {
  summary string
}

function SummarizeProperty(
  entity: string,
  property: string,
  context: string
) -> SummarizedProperty {
  client "GLM4Flash"
  prompt #"
    {{_.role('system')}}
    You are a medical knowledge summarizer. Given an entity, property, and context, provide a concise summary.

    {{_.role('user')}}
    ---Entity---
    {{ entity }}
    
    ---Property---
    {{ property }}
    
    ---Context---
    {{ context }}
    
    Please provide a summary of this property in the context of the entity:
    {{ ctx.output_format }}
  "#
}

test TestSummarizeProperty {
  functions [SummarizeProperty]
  args {
    entity "高血压"
    property "治疗措施"
    context "患者为65岁男性，有糖尿病史"
  }
}