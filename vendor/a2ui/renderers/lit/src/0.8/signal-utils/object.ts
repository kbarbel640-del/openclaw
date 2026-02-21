export class SignalObject {
  [key: string]: unknown;

  constructor(init?: Record<string, unknown>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
