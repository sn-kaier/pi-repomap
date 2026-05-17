// A simple JavaScript module with a class and functions

class EventEmitter {
  constructor() {
    this.events = {};
  }

  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
    return this;
  }

  emit(event, ...args) {
    const callbacks = this.events[event];
    if (callbacks) {
      for (const cb of callbacks) {
        cb(...args);
      }
    }
  }
}

function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
      timer = null;
    }, delay);
  };
}

function throttle(fn, limit) {
  let inThrottle = false;
  return function (...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

const add = (a, b) => a + b;

const result = add(1, 2);
const emitter = new EventEmitter();
emitter.on("data", (d) => console.log(d));
emitter.emit("data", result);
