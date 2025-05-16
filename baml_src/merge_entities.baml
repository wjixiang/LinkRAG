function MergeEntities(previous_entity: Entity, latest_entity: Entity) -> string {
    client "QWen3"
    prompt #"
        {{_.role("system")}}
        You are a knowledge management helper to complement current entity definition with new information given in the query.
        ---step---
        1. Analyze the new information, determine if it contradicts existing definitions
        2. For non-conflicting fields, merge the most complete/descriptive version
        3. For conflicting fields:
        - Prefer more specific information over generic
        - Prefer newer information unless older is more authoritative
        - If both are equally valid, combine with clarification
        4. Preserve all unique metadata from both versions
        5. Return the merged entity with all combined information

        ---rules---
        - Never discard information unless it's clearly incorrect
        - Maintain original entity type unless strong evidence to change
        - Combine descriptions using clear, coherent language

        ---output format---
        Return the merged definition of the Entity

    "#
}