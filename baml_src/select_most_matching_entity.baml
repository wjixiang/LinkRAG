class EntityMatch {
  entity string
  confidence float
}

function SelectMostMatchingEntity(
  entities: string[],
  query: string
) -> EntityMatch {
  client "GLM4Flash"
  prompt #"
    {{_.role('system')}}
    You are a medical entity matching system. Given a list of entities and a query, select the most relevant entity.

    {{_.role('user')}}
    ---Entities---
    {{ entities | join(', ') }}
    
    ---Query---
    {{ query }}
    
    Select the most relevant entity from the list and provide a confidence score (0-1):
    {{ ctx.output_format }}
  "#
}

test TestSelectMostMatchingEntity {
  functions [SelectMostMatchingEntity]
  args {
    entities ["高血压", "糖尿病", "冠心病"]
    query "血糖控制不良的慢性疾病"
  }
}