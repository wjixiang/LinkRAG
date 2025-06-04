class Attribute {
    name string
    description string
    type string
}

function ExtractAttributesFromText(text: string, attribute_types: string[]) -> Attribute[] {
  client "QWen3"
  prompt #"
  {{_.role('system')}}
  You are a helpful assistant that extracts disease attributes from medical texts.
  {{_.role('user')}}
  ---instruction---
  1. Given a medical text, extract attributes of the primary disease entity
  2. The output should be a list of attributes, each with a name, description, and type
  3. The name should be the canonical name of the disease attribute (e.g. "临床表现")
  4. The type should be one of: {{attribute_types}}
  5. The description should show the disease's attribute (e.g. "高血压的临床表现包括头痛")
  
  ---example---
  ###example_input###
  高血压的临床表现包括头痛、眩晕、心悸、胸闷等。

  ###example_output###
  [
    {
      name: "临床表现",
      description: "高血压的临床表现包括头痛、眩晕、心悸、胸闷",
      type: "临床表现"
    }
  ]

  ###example_input###
  乳腺癌的诊断通常需要乳腺X线摄影和活检等辅助检查

  ###example_output###
  [
    {
      name: "诊断方法",
      description: "乳腺癌的诊断通常需要乳腺X线摄影和活检",
      type: "诊断"
    }
  ]

  ###example_input###
  糖尿病的治疗方案包括胰岛素注射和饮食控制

  ###example_output###
  [
    {
      name: "治疗方案",
      description: "糖尿病的治疗方案包括胰岛素注射和饮食控制",
      type: "治疗"
    }
  ]

  ---input---
  {{ text }}
  ---output---
  {{ ctx.output_format }}
  "#
}