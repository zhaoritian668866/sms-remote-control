import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { COOKIE_NAME } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import { jwtVerify } from "jose";
import { ENV } from "./env";
import { getUserByOpenId } from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

async function authenticateFromCookie(req: CreateExpressContextOptions["req"]): Promise<User | null> {
  try {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) return null;

    const cookies = parseCookieHeader(cookieHeader);
    const sessionCookie = cookies[COOKIE_NAME];
    if (!sessionCookie) return null;

    const secretKey = new TextEncoder().encode(ENV.cookieSecret);
    const { payload } = await jwtVerify(sessionCookie, secretKey, {
      algorithms: ["HS256"],
    });

    const openId = payload.openId as string;
    if (!openId) return null;

    const user = await getUserByOpenId(openId);
    if (!user) return null;

    // Check session version - if token's sv doesn't match user's sessionVersion, session is invalidated
    const tokenSv = payload.sv as number | undefined;
    if (tokenSv !== undefined && tokenSv !== user.sessionVersion) {
      return null; // Session was invalidated by a newer login
    }

    return user;
  } catch (error) {
    return null;
  }
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  const user = await authenticateFromCookie(opts.req);

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
