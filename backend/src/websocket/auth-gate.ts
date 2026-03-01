// Auth gate logic is integrated directly into the HTTP upgrade handler in server.ts.
// This module re-exports the verifyToken utility for use in other parts of the codebase
// and documents the auth gate contract.
//
// Auth gate contract:
// - Client connects to ws://<host>:<port>/game?token=<jwt>
// - Server extracts token from query string on HTTP upgrade
// - Token is verified with verifyToken(); on failure the socket is destroyed with HTTP 401
// - On success, AuthenticatedSession is created and attached to the connection
// - All subsequent messages are processed in the context of that session

export { verifyToken } from '../auth/jwt';
export type { JwtClaims } from '../auth/jwt';
