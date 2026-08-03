/**
 * Client-side view of the currently signed-in Administrator. Identity is
 * server-owned (ADR 0009): the client learns about it by asking
 * `GET /api/me` and never carries authorization state independently.
 * The API is the single enforcer of authorization on every request.
 */
export interface Administrator {
  id: string;
  email: string;
  displayName: string;
}
