import {getStore} from "@netlify/blobs";
import {createHash,randomUUID} from "node:crypto";
import {mkdirSync,readFileSync,writeFileSync,renameSync,readdirSync,existsSync,unlinkSync} from "node:fs";
import path from "node:path";
export type BlobBackend={getWithMetadata(key:string,options?:unknown):Promise<{data:any;etag:string}|null>;setJSON(key:string,value:unknown,options?:{onlyIfNew?:boolean;onlyIfMatch?:string}):Promise<{modified:boolean;etag?:string}>;list(options:{prefix:string}):Promise<{blobs:{key:string}[]}>;delete(key:string):Promise<void>};
// Log only timing and HTTP status: URLs, headers, keys, and response bodies may contain secrets.
const storageFetch:typeof fetch=async(input,init)=>{
  const start=Date.now();
  const warning=setTimeout(()=>console.warn("[storage] request pending for more than 4 seconds"),4000);
  try{
    const response=await globalThis.fetch(input,init);
    if(response.status===403||response.status===429||response.status>=500)console.warn(`[storage] HTTP ${response.status}; elapsed ${Date.now()-start}ms`);
    return response;
  }catch{
    console.warn(`[storage] request failed; elapsed ${Date.now()-start}ms`);
    throw new Error("Storage request failed.");
  }finally{clearTimeout(warning);}
};
// Local-only persistent backend. Hosted functions always use Netlify Blobs.
export class FileBlobs implements BlobBackend{
  constructor(private directory=path.resolve(".data/blobs")){mkdirSync(directory,{recursive:true});}
  private file(key:string){return path.join(this.directory,createHash("sha256").update(key).digest("hex")+".json");}
  async getWithMetadata(key:string){try{const v=JSON.parse(readFileSync(this.file(key),"utf8"));return {data:v.data,etag:v.etag};}catch(e){if((e as NodeJS.ErrnoException).code==="ENOENT")return null;throw e;}}
  async setJSON(key:string,data:unknown,options:{onlyIfNew?:boolean;onlyIfMatch?:string}={}){
    const file=this.file(key),current=existsSync(file)?JSON.parse(readFileSync(file,"utf8")):null;
    if((options.onlyIfNew&&current)||(options.onlyIfMatch&&current?.etag!==options.onlyIfMatch))return {modified:false};
    const etag=randomUUID(),temporary=file+"."+etag+".tmp";writeFileSync(temporary,JSON.stringify({key,data,etag}));renameSync(temporary,file);return {modified:true,etag};
  }
  async list({prefix}:{prefix:string}){return {blobs:readdirSync(this.directory).filter(f=>f.endsWith(".json")).map(f=>JSON.parse(readFileSync(path.join(this.directory,f),"utf8"))).filter(v=>v.key.startsWith(prefix)).map(v=>({key:v.key}))};}
  async delete(key:string){try{unlinkSync(this.file(key));}catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")throw e;}}
}
export function blobs():BlobBackend{
  if(process.env.STORE_MODE==="local"||(!process.env.SITE_ID&&!process.env.NETLIFY_BLOBS_CONTEXT&&process.env.STORE_MODE!=="netlify"))return new FileBlobs();
  return getStore({name:"market-memory",consistency:"strong",fetch:storageFetch}) as unknown as BlobBackend;
}
