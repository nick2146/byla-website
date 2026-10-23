import { NextResponse } from "next/server";
import { z } from "zod";
import { getMarketCandles } from "@/lib/market-data";
export const dynamic = "force-dynamic";
const schema = z.object({ symbol: z.string().trim().toUpperCase().regex(/^[A-Z0-9.^-]{1,15}$/), range: z.enum(["1D","1W","1M","3M","1Y"]).default("1D") });
export async function GET(request: Request) {
 const url=new URL(request.url);
 const parsed=schema.safeParse({symbol:url.searchParams.get("symbol")??"AAPL",range:url.searchParams.get("range")??"1D"});
 if(!parsed.success) return NextResponse.json({error:"Invalid symbol or range"},{status:400});
 try { const candles=await getMarketCandles(parsed.data.symbol,parsed.data.range); return NextResponse.json({candles},{headers:{"Cache-Control":"no-store, max-age=0"}}); }
 catch { return NextResponse.json({error:"Price history is temporarily unavailable"},{status:502}); }
}