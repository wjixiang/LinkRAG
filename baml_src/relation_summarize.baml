class RelationReference {
  relation Relation
  doucment string[]
}

function SummarizeRelations(relationReferences: RelationReference[], entity_property: string, central_entity: Entity, language: string) -> string {
    client "GLM4Flash"
    prompt #"
        {{_.role("system")}}
        You are a helpful knowledge management assistant for summarizing knowledge by analysising given relations and documents
        Use {{language}} as output language

        {{_.role("user")}}
        ## task
        Summarize {{entity_property}} of {{central_entity.name}} ({{central_entity.type}})
        
        ## Output Format Requirements
        1. Brief and highly summarized
        2. Each point must contain synthesized knowledge
        3. Use precise terminology
        4. Focus on patterns not individual relations

        ## Documents
        {% for relationRef in relationReferences %}
        - Knowledge Relation: {{relationRef.relation.source_entity}} -> {{relationRef.relation.relation}} -> {{relationRef.relation.target_entity}}
          - Document: {{relationRef.doucment}}
        {% endfor %}

        ## output
        {{ctx.output_format}}
    "#
}

test TestSummarizeRelations {
  functions [SummarizeRelations]
  args {
    relationReferences [
      {
        relation {
          source_entity "Apple"
          target_entity "iPhone"
          relation "manufactures"
        }
        doucment "During the recent Apple Special Event, the company unveiled the latest iteration of its flagship smartphone, the iPhone. The announcement highlighted significant improvements in camera technology, processing power with the new A-series chip, and enhanced battery life, continuing Apple's trend of annual iPhone updates."
      }
      {
        relation {
          source_entity "Apple"
          target_entity "MacBook"
          relation "manufactures"
        }
        doucment "The redesigned MacBook Pro lineup now exclusively features Apple's powerful custom silicon, including the M1 Pro and M1 Max chips. These processors deliver substantial performance gains and improved power efficiency compared to previous Intel-based models, making the MacBook Pro a preferred choice for creative professionals."
      }
      {
        relation {
          source_entity "Apple"
          target_entity "iOS"
          relation "develops"
        }
        doucment "Apple is constantly evolving its mobile operating system, iOS, releasing major updates annually that introduce new features, performance enhancements, and security improvements. The development cycle involves extensive beta testing with developers and the public to refine the software before its official release to millions of iPhone and iPad users worldwide."
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
    relationReferences [
      {
        relation {
          source_entity "皮肌炎"
          target_entity "皮肤"
          relation "病变累及皮肤，表现为典型红疹"
        }
        doucment "皮肌炎是一种以皮肤和肌肉炎症为特征的自身免疫性疾病。其典型的皮肤病变是诊断的重要线索，其中包括出现在指关节、掌指关节和肘关节伸侧的Gottron丘疹，以及暴露在阳光下的面部、颈部和上胸部的向阳疹，这些皮疹常伴有瘙痒或疼痛。"
      }
      {
        relation {
          source_entity "皮肌炎"
          target_entity "红疹"
          relation "典型皮肤表现是红疹"
        }
        doucment "根据国际上广泛采用的皮肌炎分类和诊断标准，特征性的皮肤病变，特别是Gottron丘疹和向阳疹，是诊断皮肌炎的关键要素之一。即使在没有明显肌肉受累的情况下，这些典型的皮肤表现也足以高度提示皮肌炎的诊断，需要进一步检查以确诊。"
      }
      {
        relation {
          source_entity "皮肌炎"
          target_entity "心肌炎"
          relation "部分患者可出现肌肉以外的表现"
        }
        doucment "虽然皮肌炎主要影响皮肤和肌肉，但它是一种系统性疾病，可累及多个器官。在少数患者中，皮肌炎可能合并心脏受累，表现为心肌炎、心律失常或心力衰竭。因此，在皮肌炎的临床管理中，需要对患者进行全面的评估，警惕心脏并发症的发生，并及时进行相应的干预和治疗。"
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
