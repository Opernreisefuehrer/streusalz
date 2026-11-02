export class AppError extends Error {
  constructor(message: string, public status = 400, public code?: "manual_quote_required") {
    super(message);
  }
}
