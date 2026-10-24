export type SessionPolicy={ownerEmail:string;code:string;sessionSecret:string;expiresAt:string};
export const SESSION_COOKIE="mm_session";
const encode=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replaceAll("+","-").replaceAll("/","_").replace(/=+$/,"");
const decode=(value:string)=>Uint8Array.from(atob(value.replaceAll("-","+").replaceAll("_","/")),c=>c.charCodeAt(0));
export async function secretEqual(a:string,b:string){
  const hash=async(s:string)=>new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)));
  const [x,y]=await Promise.all([hash(a),hash(b)]);let d=0;for(let i=0;i<x.length;i++)d|=x[i]^y[i];return d===0;
}
export function accessOpen(policy:SessionPolicy,now=Date.now()){
  const end=Date.parse(policy.expiresAt);
  return !!policy.ownerEmail&&policy.code.length>=24&&policy.sessionSecret.length>=32&&Number.isFinite(end)&&now<end;
}
export function accountOwner(email:string,policy:SessionPolicy){return !!policy.ownerEmail&&email.trim().toLowerCase()===policy.ownerEmail.trim().toLowerCase();}
async function signature(payload:string,policy:SessionPolicy){
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(policy.sessionSecret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return encode(new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(payload))));
}
export async function issueSession(userId:string,policy:SessionPolicy,now=Date.now()){
  if(!accessOpen(policy,now))throw new Error("Workspace access is closed.");
  const expires=Math.min(now+12*3600000,Date.parse(policy.expiresAt));
  const version=encode(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(policy.code))));
  const payload=encode(new TextEncoder().encode(JSON.stringify({u:userId,e:expires,v:version})));
  return {token:`${payload}.${await signature(payload,policy)}`,expires};
}
export async function verifySession(token:string,userId:string,policy:SessionPolicy,now=Date.now()){
  if(!accessOpen(policy,now)||token.length>2048)return false;
  try{
    const [payload,sig,extra]=token.split(".");if(!payload||!sig||extra!==undefined||!await secretEqual(sig,await signature(payload,policy)))return false;
    const value=JSON.parse(new TextDecoder().decode(decode(payload)));
    const version=encode(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(policy.code))));
    return value.u===userId&&typeof value.e==="number"&&value.e>now&&value.e<=Date.parse(policy.expiresAt)&&value.e<=now+12*3600000&&value.v===version;
  }catch{return false;}
}
