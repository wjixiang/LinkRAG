class UpdatedSummary {
  summary string
  changes string[]
}

function UpdateSummary(
  current_summary: string,
  new_information: string,
  entity: string,
  property: string
) -> UpdatedSummary {
  client "GLM4Flash"
  prompt #"
    {{_.role('system')}}
    You are a medical knowledge updater. Given an existing summary and new information, update the summary appropriately.

    {{_.role('user')}}
    ---Entity---
    {{ entity }}
    
    ---Property---
    {{ property }}
    
    ---Current Summary---
    {{ current_summary }}
    
    ---New Information---
    {{ new_information }}
    
    Update the summary and list the key changes made:
    {{ ctx.output_format }}
  "#
}

test TestUpdateSummary {
  functions [UpdateSummary]
  args {
    current_summary "高血压治疗包括生活方式改变和药物治疗"
    new_information "最新指南推荐将SGLT2抑制剂作为首选药物之一"
    entity "高血压"
    property "治疗措施"
  }
}