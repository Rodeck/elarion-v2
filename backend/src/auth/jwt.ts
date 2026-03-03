import { SignJWT, jwtVerify } from 'jose';
import { config } from '../config';

const SECRET = new TextEncoder().encode(config.jwtSecret);
const ALGORITHM = 'HS256';
const EXPIRY = '10m';

export interface JwtClaims {
  accountId: string;
  characterId?: string;
}

export async function signToken(accountId: string, characterId?: string): Promise<string> {
  const payload: JwtClaims = { accountId };
  if (characterId) payload.characterId = characterId;

  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<JwtClaims> {
  const { payload } = await jwtVerify(token, SECRET, { algorithms: [ALGORITHM] });
  return {
    accountId: payload['accountId'] as string,
    characterId: payload['characterId'] as string | undefined,
  };
}
