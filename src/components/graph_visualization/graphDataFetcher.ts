import { surrealDBClient } from "../../database/surrealdbClient";
import { EntityData, PropertyData } from "./GraphViewer";

export async function fetchEntityData(): Promise<EntityData[]> {
  try {
    const db = await surrealDBClient.getDb();
    const result = await db.query<EntityData[][]>(
      `SELECT id, name, ->subset->property.{prop_name, id} AS property, ->reference->sources.{id, name, type} AS document FROM nodes ORDER BY property DESC;`
    );
    return result[0];
  } catch (error) {
    console.error("Error fetching entity data:", error);
    throw error;
  }
}

export async function fetchPropertyData(): Promise<PropertyData[]> {
  try {
    const db = await surrealDBClient.getDb();
    const result = await db.query<PropertyData[][]>(
      `SELECT id, prop_name, ->superset->nodes.{name, id} AS entity FROM property ORDER BY entity DESC;`
    );
    return result[0];
  } catch (error) {
    console.error("Error fetching property data:", error);
    throw error;
  }
}

export async function fetchGraphData(): Promise<{
  entity_data: EntityData[];
  property_data: PropertyData[];
}> {
  const [entity_data, property_data] = await Promise.all([
    fetchEntityData(),
    fetchPropertyData()
  ]);
  
  return {
    entity_data,
    property_data
  };
}
