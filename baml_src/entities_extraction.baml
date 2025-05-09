class Entity {
    name string
    description string
    type string
}

function ExtractMainEntity(chunk_text:string) -> Entity {
    client "FreeGLM4Flash"
    prompt #"
    {{_.role('user')}}

    ---role---
    You are a helpful assistant that extracts the main entity from a given text.

    ---instruction---
    The main entity is the most important entity in the text.
    The main entity can be a person, organization, location, or any other type of entity.
    The main entity should be a single word or a short phrase.

    ---example---
    ###example_input###
    "尿路感染（urinary tract infection，UTI）是指多种病原体侵犯尿路上皮或组织引起的炎症反应"
    
    ###example_output###
    {
        name: 尿路感染
        description: 尿路感染（urinary tract infection，UTI）是指多种病原体侵犯尿路上皮或组织引起的炎症反应
        type: disease
    }

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
  }
}
