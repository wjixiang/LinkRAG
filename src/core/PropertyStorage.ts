import { RecordId } from 'surrealdb';
import { surrealDBClient } from '@/database/surrealdbClient';
import createLoggerWithPrefix from '@/lib/console/logger';
import { Property } from 'baml_client';
import { PropertyRecord } from '@/type';

type Any = any; // Using 'any' for simplicity, can be refined later

export default class PropertyStorage {
    private propertyTableName: string;
    private logger = createLoggerWithPrefix('PropertyStorage');

    constructor(propertyTableName: string) {
        this.propertyTableName = propertyTableName;
    }

    /**
     * Store a new property for an entity
     * @param entityId The ID of the entity this property belongs to
     * @param propertyData The property data to store
     * @returns The created property record
     */
    async storeProperty(entityId: RecordId, propertyData: Property, references: RecordId[]): Promise<Array<Record<string, Any> & { id: RecordId }>> {
        try {
            const db = await surrealDBClient.getDb();
            // Save new property
            const property: Omit<PropertyRecord,"id"> = {
                core_entity: entityId,
                prop_name: propertyData.prop_name,
                content: propertyData.content
            }

            const results = await db.create(this.propertyTableName, {
                ...property,
            });
            this.logger.debug(`New property stored: ${JSON.stringify(results[0])}`);

            // Create SUBSET relationship with core entity
            db.insertRelation("subset", {
                in: entityId,
                out: results[0].id
            })
            //
            references.map(async(e)=>{
                db.insertRelation("references", {
                    in: entityId,
                    out: e
                })
            })

            // Use double assertion to match EntityStorage pattern
            return results as unknown as Array<Record<string, Any> & { id: RecordId }>;
        } catch (error: any) {
            console.error(`Error storing property in table ${this.propertyTableName}:`, error);
            throw error;
        }
    }

    /**
     * Get a property by its ID or by entity ID and property name
     */
    async getProperty(propertyId: RecordId): Promise<(Record<string, Any> & { id: RecordId }) | null>;
    async getProperty(entityId: RecordId, propertyName: string): Promise<(Record<string, Any> & { id: RecordId }) | null>;
    async getProperty(idOrEntityId: RecordId, propertyName?: string): Promise<(Record<string, Any> & { id: RecordId }) | null> {
        try {
            const db = await surrealDBClient.getDb();
            
            if (propertyName === undefined) {
                // Single parameter version - get by property ID
                const result = await db.select(idOrEntityId);
                return result[0] as (Record<string, Any> & { id: RecordId }) || null;
            } else {
                // Two parameter version - get by entity ID and property name
                const result = await db.query(
                    `SELECT * FROM ${this.propertyTableName} WHERE entity = ${idOrEntityId} AND name = "${propertyName}" LIMIT 1`
                );
                
                if (result && result.length > 0) {
                    const queryResult = result[0] as { status: string; result: (Record<string, Any> & { id: RecordId })[] };
                    if (queryResult.status === 'OK' && Array.isArray(queryResult.result) && queryResult.result.length > 0) {
                        return queryResult.result[0];
                    }
                }
                return null;
            }
        } catch (error: any) {
            const errorMsg = propertyName === undefined
                ? `Error getting property ${idOrEntityId}`
                : `Error getting property ${propertyName} for entity ${idOrEntityId}`;
            console.error(errorMsg, error);
            throw error;
        }
    }

    /**
     * Get all properties for a given entity
     * @param entityId The ID of the entity to get properties for
     * @returns Array of property records
     */
    async getPropertiesForEntity(entityId: RecordId): Promise<Record<string, Any>[]> {
        try {
            const db = await surrealDBClient.getDb();
            const result = await db.query(`SELECT * FROM ${this.propertyTableName} WHERE entity = ${entityId}`);
            
            if (result && result.length > 0) {
                const queryResult = result[0] as { status: string; result: Record<string, Any>[] };
                if (queryResult.status === 'OK' && Array.isArray(queryResult.result)) {
                    return queryResult.result;
                }
            }
            return [];
        } catch (error: any) {
            console.error(`Error getting properties for entity ${entityId}:`, error);
            throw error;
        }
    }

    /**
     * Update an existing property
     * @param propertyId The ID of the property to update
     * @param updateData The data to update
     * @returns The updated property record
     */
    async updateProperty(propertyId: RecordId, updateData: Record<string, Any>) {
        try {
            const db = await surrealDBClient.getDb();
            const result = await db.merge(propertyId, updateData);
            this.logger.debug(`Property updated: ${JSON.stringify(result[0])}`);
            return result[0];
        } catch (error: any) {
            console.error(`Error updating property ${propertyId}:`, error);
            throw error;
        }
    }

    /**
     * Check if a property exists for an entity
     * @param entityId The ID of the entity
     * @param propertyName The name of the property to check
     * @returns Boolean indicating if property exists
     */
    async propertyExists(entityId: RecordId, propertyName: string): Promise<boolean> {
        try {
            const db = await surrealDBClient.getDb();
            const result = await db.query(
                `SELECT count() FROM ${this.propertyTableName} WHERE entity = ${entityId} AND name = "${propertyName}"`
            );
            
            if (result && result.length > 0) {
                const queryResult = result[0] as { status: string; result: Array<{ count: number }> };
                if (queryResult.status === 'OK' && Array.isArray(queryResult.result)) {
                    return queryResult.result[0]?.count > 0;
                }
            }
            return false;
        } catch (error: any) {
            console.error(`Error checking property existence for ${propertyName} on entity ${entityId}:`, error);
            throw error;
        }
    }

    /**
     * Delete a property by its ID
     * @param propertyId The ID of the property to delete
     * @returns The deleted property record
     */
    async deleteProperty(propertyId: RecordId): Promise<Record<string, Any> & { id: RecordId }> {
        try {
            const db = await surrealDBClient.getDb();
            const result = await db.delete(propertyId);
            return result[0] as Record<string, Any> & { id: RecordId };
        } catch (error: any) {
            console.error(`Error deleting property ${propertyId}:`, error);
            throw error;
        }
    }
}