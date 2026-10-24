import {Store} from "./store.ts";
import {Providers} from "./providers.ts";
import type {Config} from "./providers.ts";
import {Engine} from "./engine.ts";
import {authenticated,DEMO_USER} from "./auth.ts";
export function readConfig():Config{
  const value=(key:string)=>process.env[key]||"";
  const limit=(key:string,fallback:number,max:number)=>{const n=Number(value(key)||fallback);return Number.isFinite(n)?Math.max(0,Math.min(max,Math.floor(n))):fallback;};
  return {nebiusKey:value("NEBIUS_API_KEY"),tavilyKey:value("TAVILY_API_KEY"),alphaKey:value("ALPHA_VANTAGE_API_KEY"),model:value("NEBIUS_MODEL"),displayApproved:value("ALPHA_VANTAGE_DISPLAY_APPROVED")==="true",nebiusLimit:limit("NEBIUS_DAILY_LIMIT",60,300),tavilyLimit:limit("TAVILY_DAILY_LIMIT",60,300),alphaLimit:limit("ALPHA_DAILY_LIMIT",20,25)};
}
export async function services(){if(!await authenticated())throw new ApiError(401,"Sign in to your workspace. Access may have expired.");const user={userId:DEMO_USER},store=new Store(),config=readConfig(),providers=new Providers(config,store);return {user,store,config,engine:new Engine(store,providers)};}
export class ApiError extends Error{constructor(public status:number,message:string){super(message);}}
export function json(value:unknown,status=200){return Response.json(value,{status,headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});}
export function failure(e:unknown){return json({error:e instanceof ApiError?e.message:"The request could not be completed. Check server configuration and retry."},e instanceof ApiError?e.status:503);}
export function sameOrigin(request:Request){const origin=request.headers.get("origin"),expected=process.env.APP_ORIGIN||process.env.URL||new URL(request.url).origin;if(!origin||origin!==new URL(expected).origin)throw new ApiError(403,"A same-origin request is required.");}
export async function body(request:Request):Promise<Record<string,unknown>>{if(Number(request.headers.get("content-length")||0)>2048)throw new ApiError(413,"Request too large.");const text=await request.text();if(text.length>2048)throw new ApiError(413,"Request too large.");try{const value=JSON.parse(text);if(!value||Array.isArray(value)||typeof value!=="object")throw new Error();return value;}catch{throw new ApiError(400,"Invalid JSON request.");}}
