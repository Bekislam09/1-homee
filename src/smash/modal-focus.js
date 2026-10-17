const FOCUSABLE = 'a[href],button,input,select,textarea,[tabindex]';

/** Keeps overlays usable by keyboard without exposing controls behind them. */
export class ModalFocus {
  constructor(root, overlays) {
    this.root = root;
    this.overlays = overlays;
    this.active = null;
    this.returnTargets = new Map();
    this.closeHandlers = new Map();
    this.background = new Map();
    this.observer = new MutationObserver(() => this.sync());
    for (const overlay of overlays) {
      this.observer.observe(overlay, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true });
    }
    document.addEventListener('keydown', event => this.onKeyDown(event), true);
    document.addEventListener('focusin', event => {
      if (this.active && !this.active.contains(event.target)) this.focusInitial();
    });
  }

  setCloseHandler(overlay, handler) {
    this.closeHandlers.set(overlay, handler);
  }

  focusable() {
    return [...this.active.querySelectorAll(FOCUSABLE)].filter(element =>
      !element.disabled && element.tabIndex >= 0 && !element.closest('[inert]') && element.getClientRects().length
    );
  }

  focusInitial() {
    if (!this.active) return;
    const modal = this.active.querySelector('[role="dialog"]') || this.active;
    const target = this.active.querySelector('[data-modal-focus]') || this.focusable()[0] || modal;
    if (!target.hasAttribute('tabindex') && target === modal) target.tabIndex = -1;
    target.focus({ preventScroll: true });
  }

  sync() {
    const next = [...this.overlays].reverse().find(overlay => !overlay.classList.contains('hidden')) || null;
    const previous = this.active;
    if (next !== previous && next && !this.returnTargets.has(next)) {
      this.returnTargets.set(next, document.activeElement);
    }
    this.active = next;
    for (const element of this.root.children) {
      // Status messages remain available to assistive technology.
      if (element.id === 'toast') continue;
      if (next) {
        if (!this.background.has(element)) this.background.set(element, element.inert);
        element.inert = element !== next;
      } else if (this.background.has(element)) {
        element.inert = this.background.get(element);
        this.background.delete(element);
      }
    }
    if (previous !== next && previous && previous.classList.contains('hidden')) {
      const target = this.returnTargets.get(previous);
      this.returnTargets.delete(previous);
      if (target?.isConnected && !target.closest('.hidden,[inert]')) target.focus({ preventScroll: true });
    }
    for (const overlay of this.returnTargets.keys()) {
      if (overlay.classList.contains('hidden')) this.returnTargets.delete(overlay);
    }
    // Rendering another dialog can replace the focused node inside this overlay.
    if (next && !next.contains(document.activeElement)) this.focusInitial();
  }

  onKeyDown(event) {
    this.sync();
    if (!this.active) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!event.repeat) this.closeHandlers.get(this.active)?.();
      this.sync();
      return;
    }
    if (event.key !== 'Tab') return;
    const elements = this.focusable();
    const index = elements.indexOf(document.activeElement);
    if (!elements.length) {
      event.preventDefault();
      this.focusInitial();
    } else if (event.shiftKey && index <= 0) {
      event.preventDefault();
      elements.at(-1).focus();
    } else if (!event.shiftKey && (index < 0 || index === elements.length - 1)) {
      event.preventDefault();
      elements[0].focus();
    }
  }
}
