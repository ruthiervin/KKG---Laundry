const ROW_HEIGHT = 44;

/** Touch-scrollable hours/minutes with keyboard and screen-reader controls. */
export class DurationPicker {
  constructor(element) {
    this.element = element;
    this.output = element.querySelector('output');
    this.disabled = false;
    this.wheels = [
      { element: element.querySelector('#duration-hours'), max: 3, value: 0, unit: 'hours' },
      { element: element.querySelector('#duration-minutes'), max: 59, value: 30, unit: 'minutes' },
    ];

    for (const wheel of this.wheels) {
      const topSpacer = document.createElement('div');
      topSpacer.className = 'wheel-spacer';
      topSpacer.setAttribute('aria-hidden', 'true');
      wheel.element.append(topSpacer);
      for (let value = 0; value <= wheel.max; value += 1) {
        const row = document.createElement('div');
        row.className = 'wheel-value';
        row.dataset.value = String(value);
        row.setAttribute('aria-hidden', 'true');
        row.textContent = String(value).padStart(2, '0');
        wheel.element.append(row);
      }
      wheel.element.append(topSpacer.cloneNode());
      wheel.element.addEventListener('pointerdown', event => {
        wheel.pointerStart = event.clientY;
        wheel.dragged = false;
      }, { passive: true });
      wheel.element.addEventListener('pointermove', event => {
        if (Math.abs(event.clientY - wheel.pointerStart) > 5) wheel.dragged = true;
      }, { passive: true });
      wheel.element.addEventListener('pointercancel', () => {
        wheel.dragged = true;
      }, { passive: true });
      wheel.element.addEventListener('scroll', () => {
        wheel.lastScrollAt = performance.now();
        if (!this.disabled) this.readWheel(wheel);
      }, { passive: true });
      wheel.element.addEventListener('click', event => {
        // Touch browsers may send a click at the end of a swipe. Keep the
        // number centered by scrolling instead of selecting the touched row.
        if (this.disabled || wheel.dragged || performance.now() - wheel.lastScrollAt < 200) return;
        const row = event.target.closest('[data-value]');
        if (row) this.selectWheel(wheel, Number(row.dataset.value));
      });
      wheel.element.addEventListener('keydown', event => this.onKeyDown(event, wheel));
    }
  }

  updateWheel(wheel, value) {
    const nextValue = Math.min(wheel.max, Math.max(0, value));
    if (wheel.value === nextValue && wheel.selectedRow) return;
    wheel.value = nextValue;
    wheel.element.setAttribute('aria-valuenow', String(wheel.value));
    wheel.element.setAttribute('aria-valuetext', `${wheel.value} ${wheel.unit}`);
    wheel.selectedRow?.classList.remove('selected');
    wheel.selectedRow = wheel.element.querySelector(`[data-value="${wheel.value}"]`);
    wheel.selectedRow.classList.add('selected');
    this.updateOutput();
    this.element.dispatchEvent(new Event('change'));
  }

  readWheel(wheel) {
    const value = Math.round(wheel.element.scrollTop / ROW_HEIGHT);
    this.updateWheel(wheel, value);
  }

  alignWheel(wheel) {
    wheel.element.scrollTo({ top: wheel.value * ROW_HEIGHT, behavior: 'auto' });
  }

  selectWheel(wheel, value) {
    this.updateWheel(wheel, value);
    this.alignWheel(wheel);
  }

  onKeyDown(event, wheel) {
    if (this.disabled) return;
    const targets = {
      ArrowUp: wheel.value - 1,
      ArrowDown: wheel.value + 1,
      PageUp: wheel.value - 10,
      PageDown: wheel.value + 10,
      Home: 0,
      End: wheel.max,
    };
    if (!(event.key in targets)) return;
    event.preventDefault();
    this.selectWheel(wheel, targets[event.key]);
  }

  setDuration(totalMinutes) {
    // Called after showModal so the wheels have measurable scroll containers.
    this.selectWheel(this.wheels[0], Math.floor(totalMinutes / 60));
    this.selectWheel(this.wheels[1], totalMinutes % 60);
  }

  getMinutes() {
    // Read the visible position even if the final scroll event is still queued.
    for (const wheel of this.wheels) {
      this.readWheel(wheel);
    }
    return this.wheels[0].value * 60 + this.wheels[1].value;
  }

  isValid() {
    const total = this.wheels[0].value * 60 + this.wheels[1].value;
    return total >= 1 && total <= 180;
  }

  updateOutput() {
    const total = this.wheels[0].value * 60 + this.wheels[1].value;
    if (total < 1) {
      this.output.textContent = 'Choose at least 1 minute';
    } else if (total > 180) {
      this.output.textContent = 'Choose up to 3 hours';
    } else {
      const hours = Math.floor(total / 60);
      const minutes = total % 60;
      const parts = [];
      if (hours) parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
      if (minutes) parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
      this.output.textContent = parts.join(' ');
    }
    this.output.classList.toggle('invalid', !this.isValid());
  }

  setDisabled(disabled) {
    this.disabled = disabled;
    this.element.classList.toggle('is-disabled', disabled);
    for (const wheel of this.wheels) {
      wheel.element.setAttribute('aria-disabled', String(disabled));
      wheel.element.tabIndex = disabled ? -1 : 0;
    }
  }
}
