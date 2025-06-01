class RetrievedPropertyInfo {
  information string
  sources string[]
}

function BaselineRAGRetrieveProperty(
  query: string
) -> RetrievedPropertyInfo {
  client "GLM4Flash"
  prompt #"
    {{_.role('system')}}
    You are a medical information retrieval system. Given a query, retrieve relevant information from your knowledge base.

    {{_.role('user')}}
    ---Query---
    {{ query }}
    
    Retrieve relevant information about this medical query, including potential sources:
    {{ ctx.output_format }}
  "#
}

test TestBaselineRAGRetrieveProperty {
  functions [BaselineRAGRetrieveProperty]
  args {
    query "高血压的常见并发症有哪些？"
  }
}