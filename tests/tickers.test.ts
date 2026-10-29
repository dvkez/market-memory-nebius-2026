import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import {tickerOf,companyOf} from "../lib/domain.ts";
import {validateMarketCache} from "../lib/market-cache.ts";
import {FileBlobs} from "../lib/blob.ts";
import {Store} from "../lib/store.ts";
import {Engine} from "../lib/engine.ts";
import {Providers} from "../lib/providers.ts";

test("stock symbols are normalized and malformed or unsafe input is rejected",()=>{
  assert.equal(tickerOf(" aapl "),"AAPL");assert.equal(tickerOf("brk.b"),"BRK.B");assert.equal(companyOf("AAPL").name,"AAPL");
  for(const bad of ["", "../../etc", "A&B", "TOOLONG", "A..B", "123", null])assert.throws(()=>tickerOf(bad));
});
test("price snapshots accept additional normalized tickers and reject unsafe symbols",()=>{
  const now=Date.parse("2026-10-23T18:00:00Z");
  const data={ticker:"AAPL",prices:[{date:"2026-10-22",open:100,high:102,low:99,close:101,volume:100}],splitDates:[],splitVerified:true,at:new Date(now).toISOString()};
  assert.equal(validateMarketCache(data,now).ticker,"AAPL");
  assert.throws(()=>validateMarketCache({...data,ticker:"../AAPL"},now));
});
test("an additional symbol runs the research workflow and its history remains separate",async()=>{
  const dir=mkdtempSync(path.join(tmpdir(),"market-memory-symbol-"));
  try{
    const queries:string[]=[];
    const fetcher=(async(input:RequestInfo|URL,init?:RequestInit)=>{
      const url=String(input),payload=init?.body?JSON.parse(String(init.body)):null;
      const respond=(data:unknown)=>new Response(JSON.stringify(data),{headers:{"content-type":"application/json"}});
      if(url.includes("/models"))return respond({data:[{id:"nvidia/Nemotron-Nano"}]});
      if(url.includes("/completions")){const p=JSON.parse(payload.messages[1].content);return respond({choices:[{finish_reason:"stop",message:{content:JSON.stringify(Array.isArray(p)?{labels:Object.fromEntries(p.map(s=>[s.id,{sentiment:1,topic:"Demand",rationale:"Company evidence"}]))}:{headline:"Research brief",summary:[{text:"Source describes demand.",sourceIds:[p.sources[0].id]}],changes:[],contradictions:[],limitations:[],charts:[{kind:"volume",title:"Daily volume"}]})}}]});}
      if(url.includes("tavily")){queries.push(payload.query);return respond({results:[{url:"https://example.org/apple",title:"AAPL report",content:"Company discusses demand.",published_date:"2026-10-22T14:00:00Z"}]});}
      if(url.includes("SPLITS"))return respond({data:[]});
      assert.equal(new URL(url).searchParams.get("symbol"),"AAPL");return respond({"Time Series (Daily)":{"2026-10-22":{"1. open":"100","2. high":"102","3. low":"99","4. close":"101","5. volume":"1000"}}});
    }) as typeof fetch;
    const store=new Store(new FileBlobs(dir));
    const engine=new Engine(store,new Providers({nebiusKey:"unit-key",tavilyKey:"unit-key",alphaKey:"unit-key",model:"",displayApproved:true,nebiusLimit:60,tavilyLimit:60,alphaLimit:20},store,fetcher));
    let analysis=await engine.start("researcher",tickerOf("aapl"));
    for(let i=0;i<3;i++)analysis=(await engine.step(analysis.id,"researcher"))!;
    assert.equal(analysis.state,"complete");assert.equal(analysis.ticker,"AAPL");assert.equal(analysis.prices.length,1);
    assert.equal(queries.length,3);assert.ok(queries.every(q=>q.includes("AAPL")&&!q.includes("semiconductor")));
    assert.equal((await new Store(new FileBlobs(dir)).history("researcher","AAPL")).length,1);
    assert.equal((await store.history("researcher","NVDA")).length,0);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
