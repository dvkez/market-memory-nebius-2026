import {cookies} from "next/headers";
import {DEMO_COOKIE} from "@/lib/auth";
import {json,sameOrigin,failure} from "@/lib/server";
export async function POST(request:Request){try{sameOrigin(request);(await cookies()).delete(DEMO_COOKIE);return json({ok:true});}catch(e){return failure(e);}}
