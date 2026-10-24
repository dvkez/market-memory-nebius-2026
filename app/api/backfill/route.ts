import { services,json,failure,sameOrigin,body } from "@/lib/server";
export async function POST(request:Request) {
  try {
    sameOrigin(request);const {user,engine}=await services();const input=await body(request);
    const b=typeof input.id==="string"?await engine.stepBackfill(input.id,user.userId):await engine.startBackfill(user.userId);
    return b?json({...b,userId:undefined,leaseUntil:undefined}):json({error:"Backfill not found."},404);
  }catch(e){return failure(e);}
}
