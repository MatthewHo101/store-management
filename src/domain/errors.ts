export class DomainError extends Error {
  constructor(
    message: string,
    public readonly status: number = 422,
  ) {
    super(message);
  }
}
export class NotFound extends DomainError {
  constructor(entity: string) {
    super(`${entity} not found`, 404);
  }
}
export class Conflict extends DomainError {
  constructor(message: string) {
    super(message, 409);
  }
}
