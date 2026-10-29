interface Env { DB: D1Database; ASSETS: Fetcher; SUNSKY_API_BASE_URL?: string; SUNSKY_API_KEY?: string; SUNSKY_API_SECRET?: string; PAYMENT_PROVIDER?: string; PAYMENT_API_KEY?: string }
interface Product { id:string; slug:string; title:string; category:string; description:string; image_url:string; price_cents:number; currency:string; stock_status:string; featured:number; supplier_sku:string|null }
const json = (data:unknown,status=200) => new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff","access-control-allow-origin":"*","access-control-allow-methods":"GET, POST, OPTIONS","access-control-allow-headers":"content-type, idempotency-key"}});
const fail = (message:string,status=400) => json({error:message},status);
const clean = (v:unknown,max=300) => typeof v==="string" ? v.trim().replace(/[<>\u0000-\u001f]/g,"").slice(0,max) : "";
const emailOK = (s:string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length<=254;
async function api(req:Request,env:Env):Promise<Response>{
  const url=new URL(req.url), path=url.pathname;
  if(req.method==="OPTIONS") return new Response(null,{status:204,headers:{"access-control-allow-origin":"*","access-control-allow-methods":"GET, POST, OPTIONS","access-control-allow-headers":"content-type, idempotency-key","access-control-max-age":"86400"}});
  if(path==="/api/health"&&req.method==="GET"){
    try { await env.DB.prepare("SELECT 1").first(); return json({ok:true,service:"skycart",database:"ok",supplier:"disabled-until-verified",payments:"disabled"}); }
    catch { return json({ok:false,service:"skycart",database:"unavailable",hint:"Apply the D1 migration."},503); }
  }
  if(path==="/api/products"&&req.method==="GET"){
    const q=clean(url.searchParams.get("q"),100), cat=clean(url.searchParams.get("category"),60), limit=Math.min(60,Math.max(1,Number(url.searchParams.get("limit")||24)));
    let sql="SELECT id,slug,title,category,description,image_url,price_cents,currency,stock_status,featured,supplier_sku FROM products WHERE active=1";
    const args:(string|number)[]=[];
    if(q){sql+=" AND (title LIKE ? OR description LIKE ? OR category LIKE ?)";const like="%"+q+"%";args.push(like,like,like);}
    if(cat&&cat!=="All"){sql+=" AND category=?";args.push(cat);}
    sql+=" ORDER BY featured DESC,title ASC LIMIT ?";args.push(limit);
    try { const rows=await env.DB.prepare(sql).bind(...args).all<Product>(); const cats=await env.DB.prepare("SELECT DISTINCT category FROM products WHERE active=1 ORDER BY category").all<{category:string}>(); return json({products:rows.results||[],categories:["All",...(cats.results||[]).map(x=>x.category)]}); }
    catch { return fail("Catalog unavailable. Apply the D1 migration.",503); }
  }
  const pm=path.match(/^\/api\/products\/([a-zA-Z0-9-]+)$/);
  if(pm&&req.method==="GET"){const p=await env.DB.prepare("SELECT id,slug,title,category,description,image_url,price_cents,currency,stock_status,featured,supplier_sku FROM products WHERE slug=? AND active=1").bind(pm[1]).first<Product>();return p?json({product:p}):fail("Product not found.",404);}
  if(path==="/api/orders"&&req.method==="POST"){
    let data:any;try{const len=Number(req.headers.get("content-length")||0);if(len>16384)return fail("Request too large.",413);const body=await req.text();if(body.length>16384)return fail("Request too large.",413);data=JSON.parse(body);}catch{return fail("Invalid JSON.");}
    const name=clean(data?.customerName,100), email=clean(data?.email,254).toLowerCase(), country=clean(data?.country,80), address=clean(data?.address,400);
    if(name.length<2||!emailOK(email)||country.length<2||address.length<5)return fail("Enter a valid name, email, country, and shipping address.");
    if(!Array.isArray(data?.items)||!data.items.length||data.items.length>30)return fail("Cart is empty or contains too many lines.");
    const qty=new Map<string,number>();
    for(const item of data.items){if(typeof item?.productId!=="string"||!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>10)return fail("Quantity must be between 1 and 10.");qty.set(item.productId,(qty.get(item.productId)||0)+item.quantity);}
    if([...qty.values()].some(n=>n>10))return fail("Maximum quantity per product is 10.");
    const ids=[...qty.keys()], placeholders=ids.map(()=>"?").join(",");
    const found=await env.DB.prepare("SELECT id,title,price_cents,currency FROM products WHERE active=1 AND id IN ("+placeholders+")").bind(...ids).all<{id:string;title:string;price_cents:number;currency:string}>();
    if((found.results||[]).length!==ids.length)return fail("One or more products are unavailable.",409);
    const currencies=new Set((found.results||[]).map(p=>p.currency));if(currencies.size!==1)return fail("Mixed-currency carts are not supported.",409);
    const map=new Map((found.results||[]).map(p=>[p.id,p]));
    const lines=ids.map(id=>{const p=map.get(id)!;return{productId:id,title:p.title,unitPriceCents:p.price_cents,quantity:qty.get(id)!};});
    const total=lines.reduce((s,l)=>s+l.unitPriceCents*l.quantity,0);if(!Number.isSafeInteger(total)||total<=0||total>5000000)return fail("Order total outside supported range.",422);
    const id=crypto.randomUUID(), key=clean(req.headers.get("idempotency-key"),120)||null, currency=[...currencies][0];
    try{await env.DB.prepare("INSERT INTO orders(id,status,customer_name,customer_email,shipping_country,shipping_address,currency,subtotal_cents,shipping_cents,total_cents,items_json,idempotency_key) VALUES(?,'pending_payment',?,?,?,?,?,?,0,?,?,?)").bind(id,name,email,country,address,currency,total,total,JSON.stringify(lines),key).run();return json({order:{id,status:"pending_payment",currency,subtotalCents:total,shippingCents:0,totalCents:total},notice:"Saved for preview only. No payment was collected and no supplier order was placed."},201);}
    catch{if(key){const prior=await env.DB.prepare("SELECT id,status,currency,total_cents FROM orders WHERE idempotency_key=?").bind(key).first<any>();if(prior)return json({order:{id:prior.id,status:prior.status,currency:prior.currency,totalCents:prior.total_cents}});}return fail("Could not save order.",500);}
  }
  const om=path.match(/^\/api\/orders\/([0-9a-f-]{36})$/i);
  if(om&&req.method==="GET"){const o=await env.DB.prepare("SELECT id,status,currency,total_cents,created_at FROM orders WHERE id=?").bind(om[1]).first<any>();return o?json({order:{id:o.id,status:o.status,currency:o.currency,totalCents:o.total_cents,createdAt:o.created_at}}):fail("Order not found.",404);}
  if(path==="/api/integrations/status"&&req.method==="GET")return json({supplier:env.SUNSKY_API_BASE_URL&&env.SUNSKY_API_KEY&&env.SUNSKY_API_SECRET?"credentials-present-but-integration-disabled":"not-configured",payments:env.PAYMENT_PROVIDER&&env.PAYMENT_API_KEY?"credentials-present-but-not-enabled":"not-configured",liveOrdersEnabled:false});
  return fail("API route not found.",404);
}
export default {
 async fetch(req:Request,env:Env):Promise<Response>{
  const url=new URL(req.url);
  if(url.pathname==="/api"||url.pathname.startsWith("/api/"))return api(req,env);
  const res=await env.ASSETS.fetch(req),h=new Headers(res.headers);
  h.set("x-content-type-options","nosniff");h.set("referrer-policy","strict-origin-when-cross-origin");h.set("x-frame-options","DENY");h.set("permissions-policy","camera=(), microphone=(), geolocation=()");
  if(url.pathname.endsWith(".html"))h.set("content-security-policy","default-src 'self'; img-src 'self' https://images.unsplash.com data:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'");
  return new Response(res.body,{status:res.status,statusText:res.statusText,headers:h});
 },
 async scheduled(_event:ScheduledController,env:Env):Promise<void>{
  // Cron is deliberately a safe no-op until the official SUNSKY API contract is implemented.
  try{await env.DB.prepare("INSERT INTO sync_runs(status,message) VALUES('skipped','SUNSKY sync disabled until API contract is verified')").run();}catch{}
 }
};
