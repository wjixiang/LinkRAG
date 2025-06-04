import DynamicLlmClient from '@/lib/dynanmicLlmClient';
import { b } from '../../baml_client'; // Import the BAML client instance
import dotenv from 'dotenv'
dotenv.config()

// Removed Attribute interface since we now return simple EP-style strings
// Example outputs: "高血压的临床表现", "乳腺癌的辅助检查"

export interface PropertyType {
  name: string;
  description: string;
  examples: string[];
}

// Define common medical attribute types
const MEDICAL_ATTRIBUTE_TYPES: PropertyType[] = [
  {
    name: "临床表现",
    description: "疾病或症状的表现特征",
    examples: ["症状", "体征", "病程特点"]
  },
  {
    name: "辅助检查",
    description: "用于诊断的检查方法",
    examples: ["实验室检查", "影像学检查", "病理检查"]
  },
  {
    name: "治疗方案",
    description: "疾病的治疗方法",
    examples: ["药物治疗", "手术治疗", "物理治疗"]
  },
  {
    name: "病因",
    description: "疾病发生的原因",
    examples: ["遗传因素", "环境因素", "感染"]
  },
  {
    name: "并发症",
    description: "疾病可能引起的其他病症",
    examples: ["肾衰竭", "心脏病", "感染"]
  }
];

export class AttributeExtractor {
  client = new DynamicLlmClient()
  private attributeTypes: PropertyType[];

  constructor() {
    this.attributeTypes = MEDICAL_ATTRIBUTE_TYPES;
  }

  /**
   * Extracts attributes from a given text using BAML.
   * @param text The input text to extract attributes from.
   * @returns A promise that resolves to an array of extracted attributes.
   */
  async extract(text: string): Promise<string[]> {
    try {
      // Call the new BAML function with text and attribute types
      this.client.cr.setPrimary("glm-4-plus")

      const eps = await b.ExtractEP(
        text,
        {
          clientRegistry: this.client.cr
        }
      );

      // Convert attributes to EP-style strings ("某实体的某属性/xx的xx")
      return eps.map(attr => {
        const matchedType = this.findBestMatchType(attr.entity);
        const typeName = matchedType ? matchedType.name : "属性";
        // Format as "实体名+的+属性名" per user examples
        return `${attr.entity}的${attr.property}`;
      });
    } catch (error) {
      console.error("Error extracting attributes with BAML:", error);
      return [];
    }
  }

  /**
   * Finds the best matching attribute type for a given attribute name.
   * This is a simple heuristic and can be improved with more sophisticated matching (e.g., embeddings).
   * @param attributeName The name of the attribute to match.
   * @returns The best matching AttributeType or undefined if no match is found.
   */
  private findBestMatchType(attributeName: string): PropertyType | undefined {
    // Simple case-insensitive exact match or partial match
    const lowerCaseAttributeName = attributeName.toLowerCase();
    for (const type of this.attributeTypes) {
      if (type.name.toLowerCase() === lowerCaseAttributeName) {
        return type;
      }
      // Check if attribute name is one of the examples
      if (type.examples.some(example => example.toLowerCase() === lowerCaseAttributeName)) {
        return type;
      }
    }
    return undefined;
  }

  /**
   * Allows adding new attribute types dynamically.
   * @param newType The new AttributeType to add.
   */
  public addAttributeType(newType: PropertyType): void {
    this.attributeTypes.push(newType);
  }
}