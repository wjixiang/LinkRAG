class EPpair {
  entity string
  property string
}

function ExtractEP(query:string) -> EPpair[] {
    client "GLM4Flash"
    prompt #"
        {{_.role("system")}}
        You are an expert at analyzing queries and extracting entity-property pairs.
        Your task is to convert natural language queries into structured lists of entity-property pairs.
        
        Rules:
        1. Identify all entities and their properties mentioned in the query
        2. Format each pair as "Entity--Property"
        3. Return only the pairs, one per line
        4. If no clear property is mentioned, use "general_info" as default
        
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

function ConvertQueryToEP(query:string) -> string[] {
  client "QWen3"
  prompt #"
    {{_.role("system")}}
    你是一位精神科诊断专家，请将复杂诊断问题拆解为4-6个关键子问题，严格使用"xx的xx是什么"的格式。

    拆解步骤：
    1. 识别核心症状群
    2. 分析症状间的关联性
    3. 确定3-5个主要鉴别诊断
    4. 形成关键鉴别问题

    示例：
    输入："18岁学生出现成绩下降、孤僻、失眠可能是什么病？"
    输出：
    - "成绩下降伴随孤僻和失眠的核心病因是什么？"
    - "这些症状群最可能的三种精神疾病是什么？"
    - "精神分裂症与抑郁症的核心区别是什么？"
    - "高考压力导致的精神症状特征是什么？"

    Outline some relevant information before you answer.
    Example:
    - 识别核心症状群：该患者的主要症状包括成绩下降、孤僻、失眠、对父母态度冷漠粗暴、自语自笑。
    - 分析症状间的关联性：这些症状可能指向情绪障碍、精神病性障碍或应激相关障碍。
    - 确定主要鉴别诊断：需要鉴别诊断精神分裂症、抑郁症、焦虑症、神经衰弱和应激相关障碍。
    - ...

    {{_.role("user")}}
    请将以下精神科诊断问题拆解为4-6个"xx的xx是什么"格式的关键问题：
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
  }
}

test extract2 {
  functions [ConvertQueryToEP ]
  args {
    query #"
      2006U1-102 男，18岁，高三学生。既往学习成绩一贯优良，品德良好。据父母反映该生近半年来，可能因为学习任务太重，高考压力太大，出现学习成缋明显下降，且变得孤僻不与人交往，对父母态度冷漠又粗暴，失眠，有时自语自笑。精神检查时，该学生回答问题语词单调，对上述表现回答说压力太大脑子变得空白听不进老师讲课记忆力变差，回答时面无表情。该学生最可能的诊断是 A. A. 焦虑症 B. B. 抑郁症 C. C. 精神分裂症 D. D. 神经衰弱 E. E. 应激相关障碍
    "#
  }
}