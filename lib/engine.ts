import { COMPANIES, companyOf, calculateMetrics, deduplicate, nextDate } from "./domain.ts";
import type { Analysis, Backfill, Source, Ticker } from "./domain.ts";
import { Providers } from "./providers.ts";
import { Store } from "./store.ts";

export function publicAnalysis(a: Analysis,displayApproved=true) {
  const {userId: _userId,leaseUntil: _lease,...rest}=a;
  if(!displayApproved)return {...rest,prices:[],metrics:calculateMetrics([],rest.sources),providers:{...rest.providers,alpha:{state:"blocked" as const,detail:"Provider display permission has not been confirmed."}}};
  return rest;
}
export function providerError(error: unknown): string {
  // Never return arbitrary remote bodies, URLs, keys, SQL or stack traces.
  const text=error instanceof Error ? error.message : "Unexpected provider error.";
  if (/^(Nebius|Tavily|Alpha Vantage|Price display|Provider|No matching NVIDIA)/.test(text)) return text;
  return "The provider result could not be validated. No generated result was accepted.";
}
export class Engine {
  constructor(private store: Store, private providers: Providers) {}
  async start(userId: string,ticker: Ticker,force=false): Promise<Analysis> {
    const history=await this.store.history(userId,ticker);
    const running=history.find(a=>a.state==="running");
    if (running) return running;
    const previous=history.find(a=>a.state==="complete"||a.state==="partial")??null;
    if (!force && previous && Date.now()-Date.parse(previous.createdAt)<15*60000) return previous;
    const now=new Date().toISOString(); const c=this.providers.config;
    const a:Analysis={id:crypto.randomUUID(),userId,ticker,createdAt:now,updatedAt:now,state:"running",stage:"collect",previousId:previous?.id??null,
      sources:[],prices:[],metrics:calculateMetrics([],[]),report:null,errors:[],model:null,leaseUntil:null,usage:{searches:0,inferences:0},
      providers:{nebius:{state:c.nebiusKey?"ready":"missing",detail:c.nebiusKey?"Awaiting catalog and inference check":"Set NEBIUS_API_KEY"},tavily:{state:c.tavilyKey?"ready":"missing",detail:c.tavilyKey?"Ready to search":"Set TAVILY_API_KEY"},alpha:{state:!c.alphaKey?"missing":c.displayApproved?"ready":"blocked",detail:!c.alphaKey?"Set ALPHA_VANTAGE_API_KEY":c.displayApproved?"Daily bars; unadjusted":"Confirm provider display rights"}}};
    await this.store.saveAnalysis(a); return a;
  }
  async step(id: string,user: string): Promise<Analysis | null> {
    let a=await this.store.getAnalysis(id,user);
    if (!a || a.state!=="running") return a;
    if (!await this.store.claimAnalysis(id,user)) return a;
    a=(await this.store.getAnalysis(id,user))!;
    a.leaseUntil=new Date(Date.now()+180000).toISOString();
    try {
      if (a.stage==="collect") {
        const company=companyOf(a.ticker).name;
        const queries=Object.hasOwn(COMPANIES,a.ticker)
          ? [`${company} ${a.ticker} latest company developments earnings AI`,`${company} ${a.ticker} industry competition semiconductor cloud demand`,`${company} ${a.ticker} risks contrary evidence demand concerns`]
          : [`${company} stock company latest developments earnings`,`${company} stock industry competition market demand`,`${company} stock risks contrary evidence concerns`];
        const search=async()=>{
          if (!this.providers.config.tavilyKey) return;
          // Reserve this investigation's three-call allowance before sending requests.
          if (a!.usage.searches+3>3) return;
          a!.usage.searches+=3;
          const results=await Promise.allSettled(queries.map(q=>this.providers.search(a!.ticker,q)));
          const found:Source[]=[];
          for (const r of results) if(r.status==="fulfilled") found.push(...r.value); else a!.errors.push(providerError(r.reason));
          a!.sources=deduplicate(found).slice(0,30);
          a!.providers.tavily={state:results.every(r=>r.status==="rejected")?"error":"ready",detail:`${a!.sources.length} unique sources observed; sample capped at 10 results per query`,at:new Date().toISOString()};
        };
        const prices=async()=>{
          try {
            const p=await this.providers.prices(a!.ticker); a!.prices=p.prices;
            a!.providers.alpha={state:p.cached?"cached":"ready",detail:`Unadjusted daily OHLCV${p.provenance==="operator-sync"?" · operator-synced Alpha Vantage cache":""} · ${p.splitVerified?"splits checked":"split verification unavailable; correlation disabled"}`,at:p.at};
            await this.store.putCache(`analysis-prices:${a!.id}`,{splitDates:p.splitDates,splitVerified:p.splitVerified},86400000);
          } catch(e) {a!.errors.push(providerError(e));a!.providers.alpha={...a!.providers.alpha,state:!this.providers.config.alphaKey?"missing":!this.providers.config.displayApproved?"blocked":"error",detail:providerError(e)};}
        };
        // Persist the allowance before either independent provider starts.
        await this.store.saveAnalysis({...a,usage:{...a.usage,searches:this.providers.config.tavilyKey?3:0}});
        await Promise.all([search(),prices()]);
        a.stage="classify";
      } else if (a.stage==="classify") {
        try {
          const stored=await this.store.sources(a.ticker);
          const known=new Map(stored.map(s=>[s.url,s]));
          a.sources=a.sources.map(s=>{const k=known.get(s.url);return k&&k.excerpt===s.excerpt&&k.sentiment!==null?{...s,sentiment:k.sentiment,topic:k.topic,rationale:k.rationale}:s;});
          const pending=a.sources.filter(s=>s.sentiment===null);
          if (pending.length) {
            a.model=await this.providers.resolveModel();
            if (a.usage.inferences>=3) throw new Error("Nebius investigation inference limit reached.");
            a.usage.inferences++; await this.store.saveAnalysis(a);
            const labeled=await this.providers.classify(pending,a.model);
            const byId=new Map(labeled.map(s=>[s.id,s]));
            a.sources=a.sources.map(s=>byId.get(s.id)??s);
            a.providers.nebius={state:"ready",detail:`Verified inference · ${a.model}`,at:new Date().toISOString()};
          }
          await this.store.saveSources(a.ticker,a.sources.filter(s=>s.sentiment!==null));
        } catch(e) {a.errors.push(providerError(e));a.providers.nebius={state:this.providers.config.nebiusKey?"error":"missing",detail:providerError(e)};}
        const all=deduplicate([...await this.store.sources(a.ticker),...a.sources]);
        const corporate=await this.store.cached<{splitDates:string[];splitVerified:boolean}>(`analysis-prices:${a.id}`);
        a.metrics=calculateMetrics(a.prices,all,corporate?.splitDates??[]);
        if (!corporate?.splitVerified) a.metrics.correlations=a.metrics.correlations.map(c=>({...c,r:null,reason:"Corporate action verification unavailable for unadjusted prices."}));
        a.stage="report";
      } else if (a.stage==="report") {
        if (a.sources.some(s=>s.sentiment!==null)&&this.providers.config.nebiusKey) {
          try {
            a.model=await this.providers.resolveModel();
            if (a.usage.inferences>=3) throw new Error("Nebius investigation inference limit reached.");
            a.usage.inferences++;await this.store.saveAnalysis(a);
            const previous=a.previousId?await this.store.getAnalysis(a.previousId,user):null;
            a.report=await this.providers.report(a.ticker,a.sources,a.metrics,previous,a.model);
            a.providers.nebius={state:"ready",detail:`Verified inference · ${a.model}`,at:new Date().toISOString()};
          } catch(e){a.errors.push(providerError(e));a.providers.nebius={state:"error",detail:providerError(e)};}
        }
        a.stage="done";
        a.state=a.report&&a.prices.length&&!a.errors.length?"complete":a.report||a.prices.length||a.sources.length?"partial":"failed";
      }
    } finally {
      a.updatedAt=new Date().toISOString();a.leaseUntil=null; a.errors=[...new Set(a.errors)];
      await this.store.saveAnalysis(a);
    }
    return a;
  }
  async startBackfill(userId: string): Promise<Backfill> {
    const old=await this.store.latestBackfill(userId);
    if (old && old.state!=="complete") return old;
    const to=new Date().toISOString().slice(0,10);
    const from=new Date(Date.now()-90*86400000).toISOString().slice(0,10);
    const b:Backfill={id:crypto.randomUUID(),userId,ticker:"NVDA",from,to,cursor:from,days:0,state:"running",error:null,leaseUntil:null};
    await this.store.saveBackfill(b);return b;
  }
  async stepBackfill(id: string,user: string): Promise<Backfill | null> {
    let b=await this.store.getBackfill(id,user);
    if (!b||b.state==="complete") return b;
    if (!await this.store.claimBackfill(id,user)) return b;
    b=(await this.store.getBackfill(id,user))!;
    b.leaseUntil=new Date(Date.now()+180000).toISOString();b.state="running";b.error=null;
    try {
      const key=`backfill-raw:${b.ticker}:${b.cursor}`;
      let sources=await this.store.cached<Source[]>(key);
      if (!sources) {
        sources=await this.providers.search(b.ticker,`NVIDIA NVDA company earnings AI chips demand risks`,{from:b.cursor,to:nextDate(b.cursor)});
        await this.store.putCache(key,sources,7*86400000);
      }
      if(sources.length){const model=await this.providers.resolveModel();await this.store.saveSources(b.ticker,await this.providers.classify(sources,model));}
      b.cursor=nextDate(b.cursor);b.days++;if (b.cursor>=b.to) b.state="complete";
    } catch(e) {b.state="paused";b.error=providerError(e);}
    finally {b.leaseUntil=null;await this.store.saveBackfill(b);}
    return b;
  }
}
