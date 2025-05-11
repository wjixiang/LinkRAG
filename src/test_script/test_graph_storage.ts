import { surrealDBClient } from '../database/surrrealdbClient';
import GraphStorage from '../database/graphStorage';
import { RecordId } from 'surrealdb';

async function testGraphStorage() {
  try {
    // Connect to test DB
    await surrealDBClient.connect();
    const db = surrealDBClient.getDb();
    const graphStorage = new GraphStorage(db, 'test_nodes');

    // Test createNode
    console.log('Testing createNode...');

    const node1 = await graphStorage.createNode({ name: 'Node 1', type: 'test' });
    const node2 = await graphStorage.createNode({ name: 'Node 2', type: 'test' });
    console.log('Created nodes:', node1, node2);

    // Test createEdge
    console.log('\nTesting createEdge...');
    const edge = await graphStorage.createEdge(node1[0].id, 'test_edges', node2[0].id, { relation: 'connected' });
    console.log('Created edge:', edge);

    // Test getConnectedNodes
    console.log('\nTesting getConnectedNodes...');
    const connectedNodes = await graphStorage.getConnectedNodes(node1[0].id, 'test_edges');
    console.log('Connected nodes:', connectedNodes);

    // Test getEdges
    console.log('\nTesting getEdges...');
    const edges = await graphStorage.getEdges(node1[0].id, 'test_edges');
    console.log('Edges:', edges);

    // // Test deleteEdge
    // console.log('\nTesting deleteEdge...');
    // const deletedEdge = await graphStorage.deleteEdge(edge[0].id);
    // console.log('Deleted edge:', deletedEdge);

    // // Test deleteNode
    // console.log('\nTesting deleteNode...');
    // const deletedNode1 = await graphStorage.deleteNode(node1[0].id);
    // const deletedNode2 = await graphStorage.deleteNode(node2[0].id);
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