import { services,json,failure,sameOrigin,body } from "@/lib/server";
import { tickerOf } from "@/lib/domain";
import { publicAnalysis } from "@/lib/engine";
export async function POST(request:Request) {
  try {
    sameOrigin(request);const {engine,user,config}=await services();const input=await body(request);
    let ticker;try{ticker=tickerOf(input.ticker);}catch{return json({error:"Enter a valid US stock symbol, such as AAPL."},400);}
    return json(publicAnalysis(await engine.start(user.userId,ticker,input.force===true),config.displayApproved),201);
  }catch(e){return failure(e);}
}
