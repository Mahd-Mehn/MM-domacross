import { render, screen } from '@testing-library/react';
import Home from '../app/page';

describe('Home', () => {
  it('renders homepage', () => {
    render(<Home />);
    expect(screen.getByText('Welcome to DomaCross')).toBeInTheDocument();
  });
});
