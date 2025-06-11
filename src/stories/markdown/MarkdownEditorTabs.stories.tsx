import type { Meta, StoryObj } from '@storybook/nextjs';
import MarkdownEditorTabs from '@/components/markdown/MarkdownEditorTabs';

const meta: Meta<typeof MarkdownEditorTabs> = {
  title: 'Components/MarkdownEditorTabs',
  component: MarkdownEditorTabs,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    nextjs: {
        appDirectory: true, // 👈 Set this
    },
  },
};

export default meta;
type Story = StoryObj<typeof MarkdownEditorTabs>;

export const Default: Story = {
  render: () => (
    <div className="h-screen p-4">
      <MarkdownEditorTabs />
    </div>
  ),
    parameters: {
        nextjs: {
        appDirectory: true, // 👈 Set this
        },
    },
};

export const WithInitialContent: Story = {
  render: () => (
    <div className="h-screen p-4">
      <MarkdownEditorTabs />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Editor with initial markdown content including headings, lists and code blocks',
      },
    },
    nextjs: {
      appDirectory: true, // 👈 Set this
    },
  },
};