import { services,json,failure,sameOrigin } from "@/lib/server";
import { publicAnalysis } from "@/lib/engine";
type Context={params:Promise<{id:string}>};
export async function GET(_request:Request,context:Context) {
  try {const {user,store,config}=await services();const {id}=await context.params;const a=await store.getAnalysis(id,user.userId);return a?json(publicAnalysis(a,config.displayApproved)):json({error:"Analysis not found."},404);}catch(e){return failure(e);}
}
export async function POST(request:Request,context:Context) {
  try {sameOrigin(request);const {user,engine,config}=await services();const {id}=await context.params;const a=await engine.step(id,user.userId);return a?json(publicAnalysis(a,config.displayApproved)):json({error:"Analysis not found."},404);}catch(e){return failure(e);}
}
