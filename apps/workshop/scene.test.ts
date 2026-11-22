import { describe, expect, it } from 'vitest';
import { sceneMarkup } from './scene';

describe('sceneMarkup', () => {
  const html = sceneMarkup();

  it('shows the title and the Coming Soon wording', () => {
    expect(html).toContain('Adventure Workshop');
    expect(html).toContain('Coming Soon');
  });

  it('shows the back hint with its button', () => {
    expect(html).toContain('Back to games');
    expect(html).toContain('id="back-hint"');
  });
});
