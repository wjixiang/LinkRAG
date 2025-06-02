import { surrealDBClient } from '../database/surrealdbClient';
import EntityStorage from '../database/EntityStorage';
import { RecordId } from 'surrealdb';

async function testGraphStorage() {
  try {
    // Connect to test DB
    await surrealDBClient.connect();
    const db = await surrealDBClient.getDb();
    const entityStorageInstance = new EntityStorage('test_nodes',"reference");

    // Test createNode
    console.log('Testing createNode...');

    const node1 = await entityStorageInstance.createNode({ name: 'Node 1', type: 'test' });
    const node2 = await entityStorageInstance.createNode({ name: 'Node 2', type: 'test' });
    console.log('Created nodes:', node1, node2);

    // Test createEdge
    console.log('\nTesting createEdge...');
    const edge = await entityStorageInstance.createEdge(node1[0].id, 'test_edges', node2[0].id, { relation: 'connected' });
    console.log('Created edge:', edge);

    // Test getConnectedNodes
    console.log('\nTesting getConnectedNodes...');
    const connectedNodes = await entityStorageInstance.getConnectedNodes(node1[0].id, 'test_edges');
    console.log('Connected nodes:', connectedNodes);

    // Test getEdges
    console.log('\nTesting getEdges...');
    const edges = await entityStorageInstance.getEdges(node1[0].id, 'test_edges');
    console.log('Edges:', edges);

    // // Test deleteEdge
    // console.log('\nTesting deleteEdge...');
    // const deletedEdge = await entityStorageInstance.deleteEdge(edge[0].id);
    // console.log('Deleted edge:', deletedEdge);

    // // Test deleteNode
    // console.log('\nTesting deleteNode...');
    // const deletedNode1 = await entityStorageInstance.deleteNode(node1[0].id);
    // const deletedNode2 = await entityStorageInstance.deleteNode(node2[0].id);
    // console.log('Deleted nodes:', deletedNode1, deletedNode2);

    console.log('\nAll tests completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // Clean up
    await surrealDBClient.close();
  }
}

testGraphStorage();