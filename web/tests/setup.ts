import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom has no native dialog implementation. These tests exercise React state and
// requests; visual layout and the browser's native focus behavior require browser QA.
HTMLDialogElement.prototype.showModal = function () {
  this.open = true;
};
HTMLDialogElement.prototype.close = function () {
  this.open = false;
};
afterEach(() => {
  cleanup();
  window.location.hash = '';
});
