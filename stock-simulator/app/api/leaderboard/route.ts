import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMarketQuote } from "@/lib/market-data";
export async function GET() {
  const session = await createClient();
  const { data:{user}, error:authError } = await session.auth.getUser();
  if (authError || !user) return NextResponse.json({error:"Please sign in to view the leaderboard."},{status:401});
  try {
    const admin=createAdminClient();
    const {data:portfolios,error}=await admin.from("portfolios").select("user_id,cash").limit(1000);
    if(error || !portfolios) throw new Error("QUERY_FAILED");
    if(!portfolios.length) return NextResponse.json({entries:[]},{headers:{"Cache-Control":"private, no-store"}});
    const ids=portfolios.map(p=>p.user_id);
    const [pr,po]=await Promise.all([
      admin.from("profiles").select("id,username").in("id",ids),
      admin.from("positions").select("user_id,symbol,quantity").in("user_id",ids)
    ]);
    if(pr.error || po.error) throw new Error("QUERY_FAILED");
    const positions=po.data??[];
    // Limit provider calls to a bounded set of symbols; failures are marked and not silently treated as exact values.
    const symbols=Array.from(new Set(positions.map(p=>p.symbol))).slice(0,80);
    const quotePairs=await Promise.all(symbols.map(async s=>{try{return [s,await getMarketQuote(s)] as const;}catch{return [s,null] as const;}}));
    const quotes=new Map(quotePairs), names=new Map((pr.data??[]).map(p=>[p.id,p.username]));
    const entries=portfolios.map(p=>{
      const held=positions.filter(pos=>pos.user_id===p.user_id);
      const complete=held.every(pos=>quotes.has(pos.symbol)&&quotes.get(pos.symbol)!==null);
      const equity=held.reduce((sum,pos)=>sum+Number(pos.quantity)*(quotes.get(pos.symbol)?.price??0),0);
      const totalValue=Number(p.cash)+equity;
      return {userId:p.user_id,username:names.get(p.user_id)??"Student",totalValue,returnPercent:(totalValue-100000)/1000,isCurrentUser:p.user_id===user.id,quotesComplete:complete};
    }).sort((a,b)=>b.totalValue-a.totalValue).slice(0,100).map((e,i)=>({rank:i+1,...e}));
    return NextResponse.json({entries},{headers:{"Cache-Control":"private, no-store"}});
  } catch { return NextResponse.json({error:"Leaderboard is temporarily unavailable."},{status:503}); }
}