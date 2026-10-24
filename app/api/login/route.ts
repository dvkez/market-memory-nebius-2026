import {cookies} from "next/headers";
import {z} from "zod";
import {createHash} from "node:crypto";
import {body,failure,json,sameOrigin} from "@/lib/server";
import {policy,newSession,DEMO_COOKIE} from "@/lib/auth";
import {verifyPassword} from "@/lib/password";
import {accessOpen,secretEqual} from "@/lib/session";
import {Store} from "@/lib/store";
export const runtime="nodejs";
export async function POST(request:Request){try{sameOrigin(request);const p=policy();if(!accessOpen(p))return json({error:"Workspace access has expired or is not configured."},403);const parsed=z.object({email:z.string().email().max(254),password:z.string().min(1).max(256)}).strict().safeParse(await body(request));if(!parsed.success)return json({error:"Enter a valid email and password."},400);const ip=request.headers.get("x-nf-client-connection-ip")||"local",email=parsed.data.email.trim().toLowerCase();const id=createHash("sha256").update(ip+"|"+email).digest("hex"),bucket=`Demo login:${id}:${Math.floor(Date.now()/900000)}`,store=new Store();try{await store.reserve(bucket,5);}catch{return new Response(JSON.stringify({error:"Too many attempts. Retry in 15 minutes."}),{status:429,headers:{"Content-Type":"application/json","Cache-Control":"no-store","Retry-After":"900"}});}const correct=verifyPassword(parsed.data.password,p.code);if(!await secretEqual(email,p.ownerEmail.trim().toLowerCase())||!correct)return json({error:"Invalid email or password."},401);await store.resetReservation(bucket);const session=await newSession();(await cookies()).set(DEMO_COOKIE,session.token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",expires:new Date(session.expires)});return json({ok:true,expiresAt:new Date(session.expires).toISOString()});}catch(e){return failure(e);}}
