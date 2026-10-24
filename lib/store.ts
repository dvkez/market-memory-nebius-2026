import type {Analysis,Backfill,Source,Ticker} from "./domain.ts";
import {blobs} from "./blob.ts";
import type {BlobBackend} from "./blob.ts";
const key=(value:string)=>encodeURIComponent(value);
export class Store{
  constructor(private db:BlobBackend=blobs()){}
  private async read<T>(id:string):Promise<T|null>{return (await this.db.getWithMetadata(id,{type:"json",consistency:"strong"}))?.data??null;}
  private async write(id:string,value:unknown){const result=await this.db.setJSON(id,value);if(!result.modified)throw new Error("Persistent storage write was not confirmed.");}
  private async records<T>(prefix:string):Promise<T[]>{const {blobs}=await this.db.list({prefix});const values=await Promise.all(blobs.map(b=>this.read<T>(b.key)));return values.filter(v=>v!==null) as T[];}
  private async update(id:string,change:(current:any)=>unknown|null){for(let attempt=0;attempt<24;attempt++){const current=await this.db.getWithMetadata(id,{type:"json",consistency:"strong"});const next=change(current?.data??null);if(next===null)return false;const result=await this.db.setJSON(id,next,current?{onlyIfMatch:current.etag}:{onlyIfNew:true});if(result.modified)return true;}throw new Error("Persistent storage was busy. Retry this step.");}
  async saveAnalysis(a:Analysis){await this.write(`analyses/${key(a.userId)}/${a.id}`,a);}
  async getAnalysis(id:string,user:string){return this.read<Analysis>(`analyses/${key(user)}/${id}`);}
  async history(user:string,ticker:Ticker){return (await this.records<Analysis>(`analyses/${key(user)}/`)).filter(a=>a.ticker===ticker).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,30);}
  async claimAnalysis(id:string,user:string){return this.update(`analyses/${key(user)}/${id}`,a=>!a||(a.leaseUntil&&Date.parse(a.leaseUntil)>=Date.now())?null:{...a,leaseUntil:new Date(Date.now()+180000).toISOString()});}
  async cached<T>(id:string):Promise<T|null>{const c=await this.read<{value:T;expiresAt:number}>(`cache/${key(id)}`);return c&&c.expiresAt>Date.now()?c.value:null;}
  async putCache(id:string,value:unknown,ttlMs:number){await this.write(`cache/${key(id)}`,{value,expiresAt:Date.now()+ttlMs});}
  async reserve(provider:string,limit:number,units=1){if(limit<units)throw new Error(`${provider}: daily budget exhausted. Try again after 00:00 UTC.`);const id=`quotas/${key(provider)}:${new Date().toISOString().slice(0,10)}`;const accepted=await this.update(id,c=>(c?.used??0)+units>limit?null:{used:(c?.used??0)+units});if(!accepted)throw new Error(`${provider}: daily budget exhausted. Try again after 00:00 UTC.`);}
  async resetReservation(provider:string){await this.write(`quotas/${key(provider)}:${new Date().toISOString().slice(0,10)}`,{used:0});}
  async saveSources(ticker:Ticker,sources:Source[]){await Promise.all(sources.map(s=>this.write(`sources/${ticker}/${s.id}`,s)));}
  async sources(ticker:Ticker){return this.records<Source>(`sources/${ticker}/`);}
  async saveBackfill(b:Backfill){const id=`backfills/${key(b.userId)}/${b.id}`,exists=await this.read(id);await this.write(id,b);if(!exists)await this.write(`backfill-latest/${key(b.userId)}`,{id:b.id});}
  async getBackfill(id:string,user:string){return this.read<Backfill>(`backfills/${key(user)}/${id}`);}
  async latestBackfill(user:string){const latest=await this.read<{id:string}>(`backfill-latest/${key(user)}`);return latest?this.getBackfill(latest.id,user):null;}
  async claimBackfill(id:string,user:string){return this.update(`backfills/${key(user)}/${id}`,b=>!b||(b.leaseUntil&&Date.parse(b.leaseUntil)>=Date.now())?null:{...b,leaseUntil:new Date(Date.now()+180000).toISOString()});}
}
