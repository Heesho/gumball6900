import type { Preview } from '@storybook/nextjs-vite';

import '../app/globals.css';

const preview: Preview = {
  decorators: [
    (Story) => (
      <main className="min-h-screen bg-[#080c0d] p-6 text-[#f4f8f7] sm:p-10">
        <div className="mx-auto max-w-5xl">
          <Story />
        </div>
      </main>
    ),
  ],
  parameters: {
    a11y: { test: 'error' },
    backgrounds: {
      default: 'protocol',
      values: [{ name: 'protocol', value: '#080c0d' }],
    },
    controls: {
      matchers: {
        color: /(background|color)$/iu,
        date: /Date$/u,
      },
    },
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};

export default preview;
