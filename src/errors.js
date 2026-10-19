export class OperatorError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
export function refuse(code, message) { throw new OperatorError(code, message); }
