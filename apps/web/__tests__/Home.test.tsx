import { render, screen } from '@testing-library/react';
import Home from '../app/page';

describe('Home', () => {
  it('renders hero headline', () => {
    render(<Home />);
    expect(screen.getByText(/Compete\. Strategize\. Dominate Domains\./)).toBeInTheDocument();
  });
});
