export class UsageError extends Error {
  constructor(message, hint = "Try 'theatre --help'.") {
    super(message);
    this.name = "UsageError";
    this.exitCode = 2;
    this.hint = hint;
  }
}
