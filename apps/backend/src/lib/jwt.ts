import jwt from "jsonwebtoken";

if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET must be set in production — refusing to start with a guessable default secret");
}

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-only-change-me-in-production-please-32chars-min";
const JWT_ACCESS_TOKEN_TTL = process.env.JWT_ACCESS_TOKEN_TTL ?? "15m";

export interface AccessTokenPayload {
  userId: number;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  const options: jwt.SignOptions = { algorithm: "HS256", expiresIn: JWT_ACCESS_TOKEN_TTL as jwt.SignOptions["expiresIn"] };
  return jwt.sign(payload, JWT_SECRET, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] }) as AccessTokenPayload & jwt.JwtPayload;
}
