import { z } from "zod";
const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(d=>Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d);
const bar=z.object({date:day,open:z.number().positive().finite(),high:z.number().positive().finite(),low:z.number().positive().finite(),close:z.number().positive().finite(),volume:z.number().int().nonnegative().finite()}).strict().refine(p=>p.low<=Math.min(p.open,p.close)&&p.high>=Math.max(p.open,p.close)&&p.low<=p.high);
const snapshot=z.object({ticker:z.enum(["NVDA","AMD","MSFT"]),prices:z.array(bar).min(1).max(120),splitDates:z.array(day).max(100),splitVerified:z.boolean(),at:z.string().datetime()}).strict();
export const PRICE_CACHE_TTL=18*3600000;
export function validateMarketCache(input:unknown,now=Date.now()){
  const value=snapshot.parse(input),age=now-Date.parse(value.at);
  if(age< -60000||age>=PRICE_CACHE_TTL)throw new Error("Market snapshot must be less than 18 hours old and cannot be future dated.");
  const dates=value.prices.map(p=>p.date);
  if(new Set(dates).size!==dates.length||dates.some((d,i)=>d>new Date(now).toISOString().slice(0,10)||(i>0&&d<=dates[i-1])))throw new Error("Market snapshot sessions must be unique, ordered and not future dated.");
  return {...value,ttl:Math.min(PRICE_CACHE_TTL,PRICE_CACHE_TTL-Math.max(0,age))};
}
export async function authorizeMarketSync(header:string|null,secret:string){
  if(!secret||secret.length<32||!header?.startsWith("Bearer ")||header.length>256)return false;
  const hash=async(s:string)=>new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)));
  const [a,b]=await Promise.all([hash(header.slice(7)),hash(secret)]);let difference=0;
  for(let i=0;i<a.length;i++)difference|=a[i]^b[i];return difference===0;
}
