import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from '../src/api.js';
import { OperationForm } from '../src/OperationForm.js';
import { operations } from '../src/operations.js';
import { workspace } from './fixtures.js';

vi.mock('../src/api.js', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  request: vi.fn(),
}));
beforeEach(() => {
  vi.resetAllMocks();
});

describe('operational forms', () => {
  it('creates an order from selected records and notifies only after success', async () => {
    vi.mocked(request).mockResolvedValue({ id: 'saved' });
    const user = userEvent.setup();
    const saved = vi.fn();
    render(
      <OperationForm operation={operations(workspace()).order} close={vi.fn()} saved={saved} />,
    );
    await user.selectOptions(screen.getByLabelText('Customer'), 'customer-1');
    await user.selectOptions(screen.getByLabelText('Packaged product'), 'product-1');
    await user.type(screen.getByLabelText('Bags'), '2');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(saved).toHaveBeenCalledOnce());
    expect(request).toHaveBeenCalledWith('/orders', {
      body: expect.objectContaining({
        customerId: 'customer-1',
        items: [{ productId: 'product-1', quantity: 2 }],
        requestKey: expect.any(String),
      }),
    });
  });
  it('shows backend errors and preserves the retry key after an ambiguous failure', async () => {
    vi.mocked(request)
      .mockRejectedValueOnce(new Error('Connection lost'))
      .mockResolvedValueOnce({});
    const user = userEvent.setup();
    const saved = vi.fn();
    render(
      <OperationForm
        operation={operations(workspace()).pay(workspace().orders[0]!)}
        close={vi.fn()}
        saved={saved}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Record payment' }));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      expect.stringContaining('Connection lost'),
    );
    expect(saved).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Record payment' }));
    await waitFor(() => expect(saved).toHaveBeenCalledOnce());
    const calls = vi.mocked(request).mock.calls;
    expect(calls[0]?.[1]?.body).toEqual(calls[1]?.[1]?.body);
  });
  it('blocks duplicate submissions while the first request is pending', async () => {
    let finish!: () => void;
    vi.mocked(request).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({});
        }),
    );
    const saved = vi.fn();
    render(
      <OperationForm
        operation={operations(workspace()).pay(workspace().orders[0]!)}
        close={vi.fn()}
        saved={saved}
      />,
    );
    const form = screen.getByRole('button', { name: 'Record payment' }).closest('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(request).toHaveBeenCalledOnce();
    finish();
    await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  });
});
