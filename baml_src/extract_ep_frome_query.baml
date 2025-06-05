class EPpair {
  entity string
  property string
}

class SubQuestion {
  subquestion string
  ep_pair EPpair
}

class EP_extract_result { 
  reasoning string
  subquestions SubQuestion[]
}

function ExtractEP(query:string, lang: string) -> EP_extract_result {
    client "GLM4Plus"
    prompt #"
        {{_.role("system")}}
        You are an expert at analyzing queries and extracting entity-property pairs.
        Your task is to convert natural language queries into structured lists of entity-property pairs.
        Use {{lang}} as output language
        
        Rules:
        1. Identify all entities and their properties mentioned in the query
        2. Format each pair as "Entity--Property"
        3. Return only the pairs, one per line
        4. If no clear property is mentioned, use "general_info" as default

        Steps:
        1. Analysis query, think what infomations are needed to solve the query.
        2. If the query is indirect, convert it into single questions or multimuple direct questions.
        3. Contert the subquestions into standard Entity-property pairs.
        
        Examples:
        Input: "What is the capital of France?"
        Output: "France--capital"
        
        Input: "Tell me about the side effects of aspirin"
        Output: "aspirin--side_effects"
        
        Input: "How old is the president of the US?"
        Output: "US_president--age"

        {{_.role("user")}}
        Convert this query to entity-property pairs:
        {{query}}
        ---output---
        {{ctx.output_format}}
        
    "#
}


test extract1 {
  functions [ExtractEP]
  args {
    query #"
      高血压的治疗及注意事项
    "#
    lang #"zh"#
  }
}

