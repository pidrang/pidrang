export function toError(error: { message: string }): Error {
  return new Error(error.message);
}
