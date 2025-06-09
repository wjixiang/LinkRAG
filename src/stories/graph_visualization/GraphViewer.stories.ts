import type { Meta, StoryObj } from '@storybook/nextjs';
import { GraphViewer } from '../../components/graph_visualization/GraphViewer';
import type { EntityData, PropertyData } from '../../components/graph_visualization/GraphViewer';

type MockEntityData = {
  id: string;
  name: string;
  property: Array<{
    id: string;
    prop_name: string;
  }>
};

type MockPropertyData = {
  id: string;
  prop_name: string;
  entity: Array<{
    id: string;
    name: string;
  }>
};

function asGraphData(data: {
  entity_data: MockEntityData[],
  property_data: MockPropertyData[]
}) {
  return data as unknown as {
    entity_data: EntityData[],
    property_data: PropertyData[]
  };
}

const meta: Meta<typeof GraphViewer> = {
  title: 'Graph Visualization/GraphViewer',
  component: GraphViewer,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof GraphViewer>;

// Mock data
const emptyData = {
  entity_data: [],
  property_data: []
};

const simpleData = {
  entity_data: [
    {
      id: 'entity:1',
      name: 'Entity 1',
      property: [
        { id: 'property:1', prop_name: 'Property 1' },
        { id: 'property:2', prop_name: 'Property 2' }
      ]
    }
  ],
  property_data: [
    {
      id: 'property:1',
      prop_name: 'Property 1',
      entity: [{ id: 'entity:1', name: 'Entity 1' }]
    },
    {
      id: 'property:2',
      prop_name: 'Property 2',
      entity: [{ id: 'entity:1', name: 'Entity 1' }]
    }
  ]
};

const complexData = {
  entity_data: [
    {
      id: 'entity:1',
      name: 'Entity 1',
      property: [
        { id: 'property:1', prop_name: 'Property 1' },
        { id: 'property:2', prop_name: 'Property 2' }
      ]
    },
    {
      id: 'entity:2',
      name: 'Entity 2',
      property: [
        { id: 'property:2', prop_name: 'Property 2' },
        { id: 'property:3', prop_name: 'Property 3' }
      ]
    }
  ],
  property_data: [
    {
      id: 'property:1',
      prop_name: 'Property 1',
      entity: [{ id: 'entity:1', name: 'Entity 1' }]
    },
    {
      id: 'property:2',
      prop_name: 'Property 2',
      entity: [
        { id: 'entity:1', name: 'Entity 1' },
        { id: 'entity:2', name: 'Entity 2' }
      ]
    },
    {
      id: 'property:3',
      prop_name: 'Property 3',
      entity: [{ id: 'entity:2', name: 'Entity 2' }]
    }
  ]
};

export const Empty: Story = {
  args: {
    data: emptyData
  }
};

export const SimpleGraph: Story = {
  args: {
    data: asGraphData(simpleData)
  }
};

export const ComplexGraph: Story = {
  args: {
    data: asGraphData(complexData)
  }
};
