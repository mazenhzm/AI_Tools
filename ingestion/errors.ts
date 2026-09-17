export type IngestionErrorKind =
  | "network"
  | "timeout"
  | "parse"
  | "validation"
  | "duplicate"
  | "persistence"
  | "unknown";

export class IngestionError extends Error {
  readonly kind: IngestionErrorKind;
  readonly cause?: unknown;

  constructor(kind: IngestionErrorKind, message: string, cause?: unknown) {
    super(message);
    this.name = "IngestionError";
    this.kind = kind;
    this.cause = cause;
  }
}

export class NetworkError extends IngestionError {
  constructor(message: string, cause?: unknown) {
    super("network", message, cause);
    this.name = "NetworkError";
  }
}

export class TimeoutError extends IngestionError {
  constructor(message: string, cause?: unknown) {
    super("timeout", message, cause);
    this.name = "TimeoutError";
  }
}

export class ParseError extends IngestionError {
  constructor(message: string, cause?: unknown) {
    super("parse", message, cause);
    this.name = "ParseError";
  }
}

export class ValidationError extends IngestionError {
  constructor(message: string, cause?: unknown) {
    super("validation", message, cause);
    this.name = "ValidationError";
  }
}

export class DuplicateError extends IngestionError {
  readonly duplicateOfToolId: string | null;
  constructor(message: string, duplicateOfToolId: string | null = null) {
    super("duplicate", message);
    this.name = "DuplicateError";
    this.duplicateOfToolId = duplicateOfToolId;
  }
}

export function classifyError(err: unknown): IngestionError {
  if (err instanceof IngestionError) return err;
  if (err instanceof Error) {
    if (err.name === "AbortError") {
      return new TimeoutError(err.message, err);
    }
    return new IngestionError("unknown", err.message, err);
  }
  return new IngestionError("unknown", String(err), err);
}
