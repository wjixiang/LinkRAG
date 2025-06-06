class HyDE_rewrite_query {
  HyDE_answer string @stream.not_null
}


function HyDE_rewrite(query:string, language: string ) -> HyDE_rewrite_query {
    client "GLM4Plus"
    prompt #"
    {{_.role('system')}}
    You are a helpful medical assistant that answer the given query .

    {{_.role('user')}}
    ---instruction---
    1. Answer the question in a comprehensive manner.
    2. Organize the content as a reference document.
    ---query---
    {{ query }}
    ---answer---
    {{ ctx.output_format }}
    "#
}

test TestHyDE_rewrite {
  functions [HyDE_rewrite]
  args {
    query #"
      高血压的治疗措施有哪些？
    "#
    language #"
      中文
    "#
  }
}
