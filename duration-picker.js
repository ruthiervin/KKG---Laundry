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
      for (let value = 0; value <= wheel.max; value += 1) {
        const row = document.createElement('div');
        row.className = 'wheel-value';
        row.dataset.value = String(value);
        row.setAttribute('aria-hidden', 'true');
        row.textContent = String(value).padStart(2, '0');
        wheel.element.append(row);
      }
      wheel.element.addEventListener('scroll', () => {
        if (this.disabled) return;
        this.updateWheel(wheel, Math.round(wheel.element.scrollTop / ROW_HEIGHT));
        clearTimeout(wheel.settleTimer);
        wheel.settleTimer = setTimeout(() => this.alignWheel(wheel), 150);
      }, { passive: true });
      wheel.element.addEventListener('click', event => {
        const row = event.target.closest('[data-value]');
        if (row && !this.disabled) {
          this.selectWheel(wheel, Number(row.dataset.value));
        }
      });
      wheel.element.addEventListener('keydown', event => this.onKeyDown(event, wheel));
    }
  }

  updateWheel(wheel, value) {
    wheel.value = Math.min(wheel.max, Math.max(0, value));
    wheel.element.setAttribute('aria-valuenow', String(wheel.value));
    wheel.element.setAttribute('aria-valuetext', `${wheel.value} ${wheel.unit}`);
    for (const row of wheel.element.children) {
      row.classList.toggle('selected', Number(row.dataset.value) === wheel.value);
    }
    this.updateOutput();
    this.element.dispatchEvent(new Event('change'));
  }

  alignWheel(wheel) {
    wheel.element.scrollTo({ top: wheel.value * ROW_HEIGHT, behavior: 'instant' });
  }

  selectWheel(wheel, value) {
    clearTimeout(wheel.settleTimer);
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
      this.updateWheel(wheel, Math.round(wheel.element.scrollTop / ROW_HEIGHT));
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
