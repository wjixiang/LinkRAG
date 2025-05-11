class Entity {
    name string
    description string
    type string
}

function ExtractMainEntity(chunk_text:string, entity_type: string[]) -> Entity[] {
  client "GLM4Flash"
  prompt #"
  {{_.role('user')}}

  ---role---
  You are a helpful assistant that extracts entities and relations from a given text.

  ---instruction---
  Given a piece of text, extract the main entity and its attributes. The main entity is usually a disease or a medical condition. The attributes include:

  ---parameters---
  - name: The name of the entity.
  - description: A brief description of the entity.
  - type: The type of the entity, It must be one of the following
    {{entity_type}}
  
  ---example---
  ###example_input###
  乳腺囊性增生病（breast cystic hyperplasia）亦称乳腺病、乳腺小叶增生症、乳腺结构不良症、纤维囊性病，常见于中年女性。其病理形态表现多样，增生可发生于腺管周围并伴有大小不等的囊肿形成，囊内含淡黄色或棕褐色液体；或腺管内表现为不同程度的乳头状增生，伴乳管囊性扩张；也有发生于小叶实质者，主要为乳管及腺泡上皮增生。
  
  ###example_output###
  [
    {
      name: "乳腺囊性增生病"
      description: "乳腺囊性增生病（breast cystic hyperplasia）亦称乳腺病、乳腺小叶增生症、乳腺结构不良症、纤维囊性病，常见于中年女性。其病理形态表现多样，增生可发生于腺管周围并伴有大小不等的囊肿形成，囊内含淡黄色或棕褐色液体；或腺管内表现为不同程度的乳头状增生，伴乳管囊性扩张；也有发生于小叶实质者，主要为乳管及腺泡上皮增生。"
      type: "disease"
    },
    {
      name: "中年女性"
      description: "中年女性是一种人群，容易发生乳腺囊性增生病。"
      type: "population"
    }
  ]

  ---input---
  {{ chunk_text }}
  ---output---
  {{ ctx.output_format }}
  "#
}

test TestExtractMainEntity {
  functions [ExtractMainEntity]
  args {
    chunk_text #"
      急性肾盂肾炎（acute pyelonephritis） 可累及单侧或双侧肾脏。表现为局限或广泛肾盂肾盏黏膜充血、水肿，表面有脓性分泌物，黏膜下可有细小脓肿，可见大小不一、尖端指向肾乳头的楔形炎症病灶。病灶内有不同程度的肾小管上皮细胞肿胀、坏死、脱落，肾小管管腔内有白细胞管型。肾间质水肿，有中性粒细胞浸润和小脓肿形成。炎症剧烈时可有广泛性出血，较大的炎症病灶愈合后局部形成瘢痕。肾小球一般无形态学改变。
    "#
    entity_type ["disease", "symptom","body_part","organ","tissue","cell", "pathology_change","medicine","treatment","surgery", "population", "examination","diagnosis","etiology","risk_factor","prognosis","complication","differential_diagnosis","prevention"]
  }
}
