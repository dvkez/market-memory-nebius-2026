import {cookies} from "next/headers";
import {issueSession,verifySession,accessOpen} from "./session.ts";
export const DEMO_COOKIE="mm_workspace";
export const DEMO_USER="shared-workspace";
export function policy(){return {ownerEmail:process.env.DEMO_EMAIL||"",code:process.env.DEMO_PASSWORD_HASH||"",sessionSecret:process.env.DEMO_SESSION_SECRET||"",expiresAt:process.env.DEMO_EXPIRES_AT||""};}
export async function authenticated(){const p=policy();if(!accessOpen(p))return false;const token=(await cookies()).get(DEMO_COOKIE)?.value||"";return verifySession(token,DEMO_USER,p);}
export async function newSession(){return issueSession(DEMO_USER,policy());}
