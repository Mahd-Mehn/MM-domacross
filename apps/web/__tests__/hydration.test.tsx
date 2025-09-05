import React from 'react';
import { render } from '@testing-library/react';
import Page from '../app/page';

// Minimal smoke test: render page component (without providers) to ensure deterministic SSR-friendly output.
describe('Hydration stability', () => {
  it('renders page without crashing', () => {
    const { container } = render(<Page />);
    expect(container.firstChild).toBeTruthy();
  });
});
