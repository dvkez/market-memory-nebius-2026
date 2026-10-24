import { services,json,failure } from "@/lib/server";
import { tickerOf } from "@/lib/domain";
import { publicAnalysis } from "@/lib/engine";
export async function GET(request:Request) {
  try {
    const {user,store,config}=await services();
    let ticker;try{ticker=tickerOf(new URL(request.url).searchParams.get("ticker")||"NVDA");}catch{return json({error:"Choose NVDA, AMD or MSFT."},400);}
    const history=await store.history(user.userId,ticker);
    const backfill=await store.latestBackfill(user.userId);
    return json({history:history.map(a=>publicAnalysis(a,config.displayApproved)),backfill:backfill?{...backfill,userId:undefined,leaseUntil:undefined}:null,settings:{nebius:!!config.nebiusKey,tavily:!!config.tavilyKey,alpha:!!config.alphaKey,displayApproved:config.displayApproved,model:config.model||await store.cached<string>("nebius:model"),limits:{nebius:config.nebiusLimit,tavily:config.tavilyLimit,alpha:config.alphaLimit}}});
  }catch(e){return failure(e);}
}
