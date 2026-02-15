import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import GoalsPage from './page';
import goals from '../../../data/goals.json';

describe('/goals page', () => {
  it('renders goals loaded from data/goals.json', () => {
    render(<GoalsPage />);

    expect(screen.getByRole('heading', { name: 'Goals' })).toBeInTheDocument();

    for (const g of goals) {
      expect(screen.getByText(g.title)).toBeInTheDocument();
      if (g.description) {
        expect(screen.getByText(g.description)).toBeInTheDocument();
      }
    }
  });

  it('shows placeholder fields for status/priority/target date when absent', () => {
    render(<GoalsPage />);

    // The page intentionally displays non-functional placeholders.
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Status:/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Priority:/i).length).toBeGreaterThan(0);
  });
});
