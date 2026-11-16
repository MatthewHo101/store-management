import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App.js';
import { request } from '../src/api.js';
import { workspace } from './fixtures.js';

vi.mock('../src/api.js', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  request: vi.fn(),
}));
beforeEach(() => {
  vi.resetAllMocks();
  const data = workspace();
  const paths: Record<string, unknown> = {
    '/health': data.health,
    '/suppliers': data.suppliers,
    '/customers': data.customers,
    '/warehouses': data.warehouses,
    '/products': data.products,
    '/lots': data.lots,
    '/orders': data.orders,
    '/purchases': data.purchases,
    '/recipes': data.recipes,
    '/reports/inventory': data.inventory,
    '/reports/operations': data.operations,
  };
  vi.mocked(request).mockImplementation(async (path) => paths[path] as never);
});
describe('workspace', () => {
  it('renders actual response values and navigates to searchable inventory', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Shipped gross margin');
    expect(screen.getAllByText('Shipped revenue')[0]?.closest('.stat-card')?.textContent).toContain(
      '$30.00',
    );
    expect(screen.getByText('Shipped gross margin').closest('div')?.textContent).toContain(
      '$24.00',
    );
    await user.click(screen.getByRole('button', { name: 'Inventory' }));
    expect(await screen.findByText('HOUSE-BATCH')).toBeTruthy();
    await user.type(screen.getByRole('searchbox', { name: 'Search inventory' }), 'not-present');
    expect(screen.queryByText('HOUSE-BATCH')).toBeNull();
    expect(screen.getByText(/No lots match your filters/)).toBeTruthy();
  });
  it('shows a connection failure instead of inventing empty business data', async () => {
    vi.mocked(request).mockRejectedValue(new Error('Database unavailable'));
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      expect.stringContaining('Database unavailable'),
    );
    expect(screen.getByText('Workspace unavailable')).toBeTruthy();
    expect(screen.queryByText('HOUSE-BATCH')).toBeNull();
  });
});
