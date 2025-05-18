
class RelationGroup {
    group_name string @description(#"
        [Name of the group]
    "#)
    relation_index int[] @description(#"
        [The index number of given relations]
    "#)
    Reasoning string @description(#"
        [Brief explanation for this grouping]
    "#)

}

function GroupRelations(core_entity: Entity, relations: Relation[]) -> RelationGroup[] {
    client "GLM4Flash"
    prompt #"
        {{_.role("system")}}
        You are an expert at organizing and analyzing relationships between entities. You will be provided with a list of relations, each defined by a source entity, a target entity, and a contextual description.
        Your task is to identify the core entity among the relations and group the relations into meaningful categories based on how they describe attributes or aspects of this core entity.
        The group name should be a concise term representing the attribute or aspect, suitable to be used in the format "[group name] of [core entity]".
        Use 中文 as output language.

        ## Grouping Instructions:
        1. Analyze each relation carefully to identify the core entity that is central to the provided relations.
        2. Group the relations based on how they describe different attributes, aspects, or related concepts of the core entity.
        3. Provide a concise Chinese label for each group that represents the attribute or aspect (e.g., "临床表现", "治疗", "病因").
        4. If a relation does not clearly describe an attribute of the core entity or fit into a defined group, place it into an "其他" or "未分类" group.

        ## Input content:
        Input will consist of a list of relations, where each relation has the following structure:
        - relation [relation_index]
            - Source Entity: [Entity A]
            - Target Entity: [Entity B]
            - Relation: [Contextual Description]

        ## Output content:
        Respond with groups in the following structure:

        Group Name: [Name of the group]
        Relation 1: [Relation Index]
        Relation 2: [Relation description]
        ...
        Reasoning: [Brief explanation for this grouping]
        
        ## Example:
        ### Example Input:
        ---core entity---
        - entity name: 皮肌炎
        - entity definition: 皮肌炎是一种风湿性疾病
        - entity type: disease
        ---relations
        - relation 0
            - Source Entity: 皮肌炎
            - Target Entity: 皮肤
            - Relation: 皮肌炎病变累及皮肤，表现为典型红疹。
        - relation 1
            - Source Entity: 皮肌炎
            - Target Entity: 红疹
            - Relation: 皮肌炎的典型皮肤表现是红疹。
        - relation 2
            - Source Entity: 皮肌炎
            - Target Entity: 结缔组织病
            - Relation: 皮肌炎属于结缔组织病（connective tissue disease），也称胶原病（collagen disease）。
        - relation 3
            - Source Entity: 皮肌炎
            - Target Entity: 心肌炎
            - Relation: 部分皮肌炎患者可出现肌肉以外的表现，包括心肌炎。
        - relation 4
            - Source Entity: 皮肌炎
            - Target Entity: 筋膜
            - Relation: 皮肌炎中的皮肤病变常累及筋膜而导致疼痛。
        
        ### Example Output:
        ```json
        [
          {
            "group_name": "临床表现",
            "relation_index": [0, 1, 3, 4],
            "Reasoning": "These relations describe symptoms, manifestations, or physical outcomes of 皮肌炎."
          },
          {
            "group_name": "分类",
            "relation_index": [2],
            "Reasoning": "This group focuses on how 皮肌炎 is classified as part of a broader category of diseases."
          }
        ]
        ```

        {{_.role("user")}}
        ## User Real Input
        ---core entity---
        - entity name: {{core_entity.name}}
        - entity type: {{core_entity.type}}
        - entity definition: {{core_entity.description}}
        
        ---relations---
        {% for relation in relations %}
        - relation {{loop.index}}
            - Source Entity: {{relation.source_entity}}
            - Target Entity: {{relation.target_entity}}
            - Relation: {{relation.relation}}
        {% endfor%}
        ## Your Real Output:
        {{ctx.output_format}}
    "#
}