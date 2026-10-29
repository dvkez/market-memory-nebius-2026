import {cookies} from "next/headers";
import {z} from "zod";
import {createHash} from "node:crypto";
import {body,failure,json,sameOrigin} from "@/lib/server";
import {policy,newSession,DEMO_COOKIE} from "@/lib/auth";
import {verifyPassword} from "@/lib/password";
import {accessOpen,secretEqual} from "@/lib/session";
import {Store} from "@/lib/store";
export const runtime="nodejs";
export async function POST(request:Request){
  const start=Date.now();
  try{
    sameOrigin(request);const p=policy();
    if(!accessOpen(p))return json({error:"Workspace access has expired or is not configured."},403);
    const parsed=z.object({email:z.string().email().max(254),password:z.string().min(1).max(256)}).strict().safeParse(await body(request));
    if(!parsed.success)return json({error:"Enter a valid email and password."},400);
    const ip=request.headers.get("x-nf-client-connection-ip")||"local",email=parsed.data.email.trim().toLowerCase();
    const id=createHash("sha256").update(ip+"|"+email).digest("hex"),bucket=`Demo login:${id}:${Math.floor(Date.now()/900000)}`,store=new Store();
    console.info("[auth] checking access limits");
    try{await store.reserve(bucket,5);}catch(e){
      console.warn("[auth] access limit check failed");
      if(e instanceof Error&&e.message.startsWith("Demo login:")&&e.message.endsWith("daily budget exhausted. Try again after 00:00 UTC."))return new Response(JSON.stringify({error:"Too many attempts. Retry in 15 minutes."}),{status:429,headers:{"Content-Type":"application/json","Cache-Control":"no-store","Retry-After":"900"}});
      return json({error:"Sign-in service is temporarily unavailable. Please retry."},503);
    }
    console.info(`[auth] access limit checked in ${Date.now()-start}ms`);
    const correct=verifyPassword(parsed.data.password,p.code);
    if(!await secretEqual(email,p.ownerEmail.trim().toLowerCase())||!correct)return json({error:"Invalid email or password."},401);
    console.info("[auth] resetting access limits");
    await store.resetReservation(bucket);
    const session=await newSession();
    (await cookies()).set(DEMO_COOKIE,session.token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",expires:new Date(session.expires)});
    console.info(`[auth] session issued in ${Date.now()-start}ms`);
    return json({ok:true,expiresAt:new Date(session.expires).toISOString()});
  }catch(e){console.warn("[auth] sign-in failed");return failure(e);}
}
