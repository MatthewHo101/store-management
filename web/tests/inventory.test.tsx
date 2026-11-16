import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { Inventory } from '../src/pages/Inventory.js';
import { workspace } from './fixtures.js';

it('does not present quarantined physical stock as available for orders', () => {
  const data = workspace();
  data.lots[0]!.status = 'quarantined';
  render(<Inventory data={data} search="" openLot={vi.fn()} />);
  expect(screen.getByText('quarantined')).toBeTruthy();
  expect(screen.getByText('0 units')).toBeTruthy();
  expect(screen.queryByText('18 units')).toBeNull();
});
