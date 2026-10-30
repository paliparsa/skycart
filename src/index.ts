interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  ADMIN_PASSWORD?: string;
  SUNSKY_API_KEY?: string;
  SUNSKY_API_SECRET?: string;
}
type Product = {id:string;slug:string;title:string;category:string;description:string;image_url:string;price_cents:number;currency:string;stock_status:string;featured:number;supplier_sku:string|null;supplier_cost_cents:number;markup_percent:number;active:number};
const json=(data:unknown,status=200,headers:Record<string,string>={})=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff",...headers}});
const fail=(message:string,status=400)=>json({error:message},status);
const clean=(v:unknown,max=300)=>typeof v==="string"?v.trim().replace(/[<>\u0000-\u001f]/g,"").slice(0,max):"";
const emailOK=(s:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)&&s.length<=254;
const hasSunsky=(e:Env)=>!!(e.SUNSKY_API_KEY&&e.SUNSKY_API_SECRET);
async function settingsCryptoKey(env:Env){
 if(!env.ADMIN_PASSWORD)throw new Error("Admin password is not configured.");
 const material=await crypto.subtle.importKey("raw",new TextEncoder().encode(env.ADMIN_PASSWORD),"PBKDF2",false,["deriveKey"]);
 return crypto.subtle.deriveKey({name:"PBKDF2",salt:new TextEncoder().encode("skycart:sunsky-settings:v1"),iterations:120000,hash:"SHA-256"},material,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
}
async function encryptSettings(env:Env,value:string){
 const iv=crypto.getRandomValues(new Uint8Array(12)),key=await settingsCryptoKey(env);
 const cipher=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,new TextEncoder().encode(value));
 return "v1."+b64url(iv)+"."+b64url(new Uint8Array(cipher));
}
async function decryptSettings(env:Env,value:string){
 const parts=value.split(".");if(parts.length!==3||parts[0]!=="v1")throw new Error("Stored SUNSKY credentials have an unsupported format.");
 const key=await settingsCryptoKey(env),plain=await crypto.subtle.decrypt({name:"AES-GCM",iv:fromB64url(parts[1])},key,fromB64url(parts[2]));
 return new TextDecoder().decode(plain);
}
async function sunskyCredentials(env:Env){
 const row=await env.DB.prepare("SELECT value FROM app_settings WHERE key='sunsky_credentials'").first<any>();
 if(row?.value){try{const saved=JSON.parse(await decryptSettings(env,String(row.value)));if(saved?.apiKey&&saved?.apiSecret)return {apiKey:String(saved.apiKey),apiSecret:String(saved.apiSecret),source:"admin"};}catch{throw new Error("Could not decrypt saved SUNSKY credentials. Check whether ADMIN_PASSWORD has changed.");}}
 return {apiKey:env.SUNSKY_API_KEY||"",apiSecret:env.SUNSKY_API_SECRET||"",source:"worker"};
}
async function sunskyConfigured(env:Env){const c=await sunskyCredentials(env);return !!(c.apiKey&&c.apiSecret);}
function md5(input:string):string{
 const bytes=new TextEncoder().encode(input),len=bytes.length,buf=new Uint8Array((((len+8)>>>6)+1)*64);buf.set(bytes);buf[len]=128;
 const dv=new DataView(buf.buffer);dv.setUint32(buf.length-8,(len*8)>>>0,true);dv.setUint32(buf.length-4,Math.floor(len/0x20000000),true);
 let a0=0x67452301,b0=0xefcdab89,c0=0x98badcfe,d0=0x10325476;
 const k=Array.from({length:64},(_,i)=>Math.floor(Math.abs(Math.sin(i+1))*4294967296)>>>0),s=[7,12,17,22,5,9,14,20,4,11,16,23,6,10,15,21];
 for(let off=0;off<buf.length;off+=64){const m=Array.from({length:16},(_,i)=>dv.getUint32(off+i*4,true));let a=a0,b=b0,c=c0,d=d0;
  for(let i=0;i<64;i++){let f,g,shift;if(i<16){f=(b&c)|(~b&d);g=i;shift=s[i%4]}else if(i<32){f=(d&b)|(~d&c);g=(5*i+1)%16;shift=s[4+i%4]}else if(i<48){f=b^c^d;g=(3*i+5)%16;shift=s[8+i%4]}else{f=c^(b|~d);g=(7*i)%16;shift=s[12+i%4]}const x=(a+f+k[i]+m[g])>>>0;const rot=((x<<shift)|(x>>>(32-shift)))>>>0;a=d;d=c;c=b;b=(b+rot)>>>0;}
  a0=(a0+a)>>>0;b0=(b0+b)>>>0;c0=(c0+c)>>>0;d0=(d0+d)>>>0;
 }
 return [a0,b0,c0,d0].map(n=>[0,8,16,24].map(s=>(n>>>s)&255).map(v=>v.toString(16).padStart(2,"0")).join("")).join("");
}
function sunskySignature(params:Record<string,string>,secret:string){const joined=Object.keys(params).sort().map(k=>params[k]).join("")+"@"+secret;return md5(joined);}
async function sunsky(env:Env,endpoint:string,params:Record<string,string>={}):Promise<any>{
 const credentials=await sunskyCredentials(env);
 if(!credentials.apiKey||!credentials.apiSecret)throw new Error("SUNSKY API credentials are not configured. Add them in Admin → API Settings.");
 const values={...params,key:credentials.apiKey};const signature=sunskySignature(values,credentials.apiSecret);
 const body=new URLSearchParams({...values,signature});
 const res=await fetch("https://open.sunsky-online.com/openapi/"+endpoint,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body,signal:AbortSignal.timeout(20000)});
 if(!res.ok)throw new Error("SUNSKY returned HTTP "+res.status);
 const data:any=await res.json();if(data?.result!=="success")throw new Error(clean((data?.messages||["SUNSKY API request failed"]).join("; "),300));
 return data.data;
}
function slugify(s:string){return s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,90)||crypto.randomUUID().slice(0,8);}
function safeImage(v:any){const s=typeof v==="string"?v:"";return /^https:\/\/[a-z0-9.-]+\//i.test(s)?s:"";}
function sunskyItems(items:Array<{itemNo:string;qty:number}>){const p:Record<string,string>={};for(let i=0;i<items.length;i++){p["items."+i+".itemNo"]=items[i].itemNo;p["items."+i+".qty"]=String(items[i].qty);}return p;}
async function syncPage(env:Env,page:number,pageSize=100){
 const data:any=await sunsky(env,"product!search.do",{lang:"en",page:String(page),pageSize:String(pageSize),status:"-1"});
 const rows:any[]=Array.isArray(data?.result)?data.result:Array.isArray(data?.result?.result)?data.result.result:[];
 let count=0;
 for(const p of rows){
  const sku=clean(p.itemNo,100),name=clean(p.name,240);if(!sku||!name)continue;
  const cost=Math.max(0,Math.round(Number(p.price||p.priceList?.[0]?.value||0)*100));if(!Number.isFinite(cost)||cost<=0)continue;
  const old=await env.DB.prepare("SELECT id,markup_percent,slug FROM products WHERE supplier_sku=?").bind(sku).first<any>();
  const markup=Number.isFinite(Number(old?.markup_percent))?Number(old.markup_percent):35;
  const retail=Math.round(cost*(1+markup/100));
  const status=Number(p.status)===1?1:0,stock=(status===1&&(Number(p.stock)>0||Number(p.leadTimeLevel)>1))?"in_stock":"out_of_stock";
  const desc=clean(String(p.description||"").replace(/<[^>]*>/g," ").replace(/\s+/g," "),1000);
  const image=safeImage(p.imageUrl||p.imgUrl||p.picUrl||p.image||p.picture||"");
  const category=String(p.categoryId||"Uncategorized");
  if(old){
   await env.DB.prepare("UPDATE products SET title=?,category=?,description=?,image_url=CASE WHEN ?='' THEN image_url ELSE ? END,supplier_cost_cents=?,markup_percent=?,price_cents=?,stock_status=?,active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(name,category,desc,image,image,cost,markup,retail,stock,status,old.id).run();
  }else{
   const id=crypto.randomUUID(),slug=slugify(name)+"-"+sku.toLowerCase().replace(/[^a-z0-9]/g,"").slice(-12);
   await env.DB.prepare("INSERT INTO products(id,slug,title,category,description,image_url,price_cents,currency,stock_status,featured,supplier_sku,active,supplier_cost_cents,markup_percent) VALUES(?,?,?,?,?,?,?,'USD',?,0,?,?,?,?)").bind(id,slug,name,category,desc,image,retail,stock,sku,status,cost,markup).run();
  }
  count++;
 }
 await env.DB.prepare("INSERT INTO sync_runs(status,message,finished_at) VALUES('success',?,CURRENT_TIMESTAMP)").bind("page "+page+": imported/updated "+count+" products").run();
 return {count,hasMore:rows.length>=pageSize,total:Number(data?.pageCount||data?.total||0)};
}
function cookieValue(req:Request,name:string){const all=req.headers.get("cookie")||"";const found=all.split(";").map(s=>s.trim()).find(s=>s.startsWith(name+"="));return found?decodeURIComponent(found.slice(name.length+1)):"";}
function b64url(bytes:Uint8Array){let s="";for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");}
function fromB64url(s:string){const raw=atob(s.replace(/-/g,"+").replace(/_/g,"/")+"===".slice((s.length+3)%4));return Uint8Array.from(raw,c=>c.charCodeAt(0));}
async function hmac(value:string,secret:string){const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign","verify"]);return new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(value)));}
async function sessionToken(exp:number,nonce:string,secret:string){const payload=String(exp)+"."+nonce;return payload+"."+b64url(await hmac(payload,secret));}
async function isAdmin(req:Request,env:Env){if(!env.ADMIN_PASSWORD)return false;const token=cookieValue(req,"skycart_admin"),parts=token.split(".");if(parts.length!==3)return false;const exp=Number(parts[0]),payload=parts[0]+"."+parts[1];if(!Number.isFinite(exp)||exp<Date.now()||exp>Date.now()+13*60*60*1000)return false;try{const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(env.ADMIN_PASSWORD),{name:"HMAC",hash:"SHA-256"},false,["verify"]);return await crypto.subtle.verify("HMAC",key,fromB64url(parts[2]),new TextEncoder().encode(payload));}catch{return false;}}
async function samePassword(a:string,b:string){const aa=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(a)),bb=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(b));const x=new Uint8Array(aa),y=new Uint8Array(bb);let d=0;for(let i=0;i<x.length;i++)d|=x[i]^y[i];return d===0;}
function originOK(req:Request){const origin=req.headers.get("origin");return !origin||origin===new URL(req.url).origin;}
async function adminApi(req:Request,env:Env):Promise<Response>{
 const u=new URL(req.url),path=u.pathname;
 if(path==="/api/admin/login"&&req.method==="POST"){
  if(!originOK(req))return fail("Origin rejected.",403);
  const ip=clean(req.headers.get("cf-connecting-ip")||"unknown",80);
  const attempts=await env.DB.prepare("SELECT COUNT(*) AS n FROM admin_login_attempts WHERE ip=? AND created_at>=datetime('now','-15 minutes')").bind(ip).first<any>();
  if(Number(attempts?.n||0)>=8)return fail("Too many login attempts. Try again in 15 minutes.",429);
  let body:any;try{body=await req.json()}catch{return fail("Invalid request.");}
  const password=typeof body?.password==="string"?body.password:"";
  if(!env.ADMIN_PASSWORD||!await samePassword(password,env.ADMIN_PASSWORD)){
   await env.DB.prepare("INSERT INTO admin_login_attempts(ip) VALUES(?)").bind(ip).run();return fail("Invalid credentials.",401);
  }
  await env.DB.prepare("DELETE FROM admin_login_attempts WHERE created_at<datetime('now','-1 day')").run();
  const exp=Date.now()+12*60*60*1000,nonce=b64url(crypto.getRandomValues(new Uint8Array(18))),token=await sessionToken(exp,nonce,env.ADMIN_PASSWORD);
  return json({ok:true,expiresAt:exp},200,{"set-cookie":"skycart_admin="+encodeURIComponent(token)+"; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200"});
 }
 if(path==="/api/admin/logout"&&req.method==="POST")return json({ok:true},200,{"set-cookie":"skycart_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0"});
 if(path==="/api/admin/session"&&req.method==="GET")return json({authenticated:await isAdmin(req,env),configured:!!env.ADMIN_PASSWORD,supplierConfigured:await sunskyConfigured(env)});
 if(!await isAdmin(req,env))return fail("Authentication required.",401);
 if(!originOK(req))return fail("Origin rejected.",403);
 if(path==="/api/admin/settings/sunsky"&&req.method==="GET"){
  const credentials=await sunskyCredentials(env);
  return json({configured:!!(credentials.apiKey&&credentials.apiSecret),source:credentials.source,apiKeyMasked:credentials.apiKey?credentials.apiKey.slice(0,3)+"••••"+credentials.apiKey.slice(-3):""});
 }
 if(path==="/api/admin/settings/sunsky"&&req.method==="PUT"){
  let d:any;try{d=await req.json()}catch{return fail("Invalid JSON.");}
  const apiKey=typeof d?.apiKey==="string"?d.apiKey.trim():"",apiSecret=typeof d?.apiSecret==="string"?d.apiSecret.trim():"";
  if(apiKey.length<4||apiKey.length>200||apiSecret.length<8||apiSecret.length>300)return fail("Enter a valid SUNSKY API key and API secret.");
  try{
   const encrypted=await encryptSettings(env,JSON.stringify({apiKey,apiSecret}));
   await env.DB.prepare("INSERT INTO app_settings(key,value,updated_at) VALUES('sunsky_credentials',?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP").bind(encrypted).run();
   return json({ok:true,configured:true,apiKeyMasked:apiKey.slice(0,3)+"••••"+apiKey.slice(-3)});
  }catch(e){return fail(clean(e instanceof Error?e.message:"Could not save SUNSKY credentials.",250),500);}
 }
 if(path==="/api/admin/settings/sunsky/test"&&req.method==="POST"){
  try{await sunsky(env,"product!search.do",{lang:"en",page:"1",pageSize:"1",status:"-1"});return json({ok:true,message:"SUNSKY API connection successful."});}
  catch(e){return fail(clean(e instanceof Error?e.message:"SUNSKY connection test failed.",300),502);}
 }
 if(path==="/api/admin/summary"&&req.method==="GET"){
  const [products,orders,pending,failed,latest]=await Promise.all([
   env.DB.prepare("SELECT COUNT(*) n FROM products WHERE active=1 AND supplier_sku IS NOT NULL").first<any>(),
   env.DB.prepare("SELECT COUNT(*) n FROM orders").first<any>(),
   env.DB.prepare("SELECT COUNT(*) n FROM orders WHERE status='pending_payment'").first<any>(),
   env.DB.prepare("SELECT COUNT(*) n FROM orders WHERE status='supplier_failed'").first<any>(),
   env.DB.prepare("SELECT id,status,total_cents,currency,customer_name,customer_email,created_at FROM orders ORDER BY created_at DESC LIMIT 8").all<any>()
  ]);
  const sync=await env.DB.prepare("SELECT status,message,started_at,finished_at FROM sync_runs ORDER BY id DESC LIMIT 1").first<any>();
  return json({products:products?.n||0,orders:orders?.n||0,pending:pending?.n||0,failed:failed?.n||0,latest:latest.results||[],sync,supplierConfigured:await sunskyConfigured(env)});
 }
 if(path==="/api/admin/products"&&req.method==="GET"){
  const q=clean(u.searchParams.get("q"),100),where=q?"WHERE title LIKE ? OR supplier_sku LIKE ?":"";
  const stmt=env.DB.prepare("SELECT id,slug,title,category,price_cents,supplier_cost_cents,markup_percent,currency,stock_status,featured,active,supplier_sku,image_url FROM products "+where+" ORDER BY updated_at DESC LIMIT 200");
  const rows=q?await stmt.bind("%"+q+"%","%"+q+"%").all<any>():await stmt.all<any>();return json({products:rows.results||[]});
 }
 const productPatch=path.match(/^\/api\/admin\/products\/([0-9a-f-]{36})$/i);
 if(productPatch&&req.method==="PATCH"){
  let d:any;try{d=await req.json()}catch{return fail("Invalid JSON.");}
  const markup=d.markupPercent===undefined?null:Number(d.markupPercent),active=d.active===undefined?null:(d.active?1:0),featured=d.featured===undefined?null:(d.featured?1:0);
  if(markup!==null&&(!Number.isFinite(markup)||markup<0||markup>500))return fail("Markup must be between 0 and 500 percent.");
  const p=await env.DB.prepare("SELECT supplier_cost_cents,markup_percent FROM products WHERE id=?").bind(productPatch[1]).first<any>();if(!p)return fail("Product not found.",404);
  const m=markup===null?Number(p.markup_percent):markup,price=Math.round(Number(p.supplier_cost_cents)*(1+m/100));
  await env.DB.prepare("UPDATE products SET markup_percent=?,price_cents=?,active=COALESCE(?,active),featured=COALESCE(?,featured),updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(m,price,active,featured,productPatch[1]).run();
  return json({ok:true,markupPercent:m,priceCents:price});
 }
 if(path==="/api/admin/sync"&&req.method==="POST"){
  if(!await sunskyConfigured(env))return fail("Configure SUNSKY API credentials in Admin → API Settings first.",503);
  try{const result=await syncPage(env,1,100);return json({ok:true,...result});}catch(e){const msg=clean(e instanceof Error?e.message:"Supplier sync failed",300);await env.DB.prepare("INSERT INTO sync_runs(status,message,finished_at) VALUES('error',?,CURRENT_TIMESTAMP)").bind(msg).run();return fail(msg,502);}
 }
 if(path==="/api/admin/orders"&&req.method==="GET"){
  const rows=await env.DB.prepare("SELECT id,status,customer_name,customer_email,shipping_country,shipping_address,shipping_address AS address,shipping_country AS country,city,state,address2,postcode,telephone,country_id,shipping_way_id,currency,subtotal_cents,shipping_cents,total_cents,items_json,payment_confirmed_at,supplier_order_ref,supplier_error,created_at FROM orders ORDER BY created_at DESC LIMIT 200").all<any>();
  return json({orders:(rows.results||[]).map(o=>({...o,items:(()=>{try{return JSON.parse(o.items_json)}catch{return[]}})()}))});
 }
 const confirm=path.match(/^\/api\/admin\/orders\/([0-9a-f-]{36})\/confirm-and-submit$/i);
 if(confirm&&req.method==="POST"){
  if(!await sunskyConfigured(env))return fail("SUNSKY API credentials are not configured.",503);
  const o=await env.DB.prepare("SELECT * FROM orders WHERE id=?").bind(confirm[1]).first<any>();if(!o)return fail("Order not found.",404);
  if(o.status!=="pending_payment"&&o.status!=="supplier_failed")return fail("Order cannot be submitted from status "+o.status+".",409);
  if(o.status==="supplier_failed")return fail("Supplier response previously failed or was ambiguous. Verify the order in SUNSKY before retrying to avoid a duplicate order.",409);
  const items:any[]=JSON.parse(o.items_json||"[]");if(!items.length||items.some(i=>!i.supplierSku))return fail("One or more order items have no SUNSKY SKU.",422);
  if(!o.country_id||!o.shipping_way_id)return fail("Shipping country or shipping method is missing.",422);
  await env.DB.prepare("UPDATE orders SET status='supplier_submitting',payment_confirmed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending_payment'").bind(o.id).run();
  const params:Record<string,string>={
   siteNumber:"",vatNumber:"",eoriNumber:"",iossNumber:"",coupon:"",useBalanceOnly:"true",
   "deliveryAddress.countryId":String(o.country_id),"deliveryAddress.state":o.state||"","deliveryAddress.city":o.city||"",
   "deliveryAddress.company":"","deliveryAddress.address":o.shipping_address,"deliveryAddress.address2":o.address2||"",
   "deliveryAddress.postcode":o.postcode||"","deliveryAddress.receiver":o.customer_name,"deliveryAddress.telephone":o.telephone||"",
   "deliveryAddress.email":o.customer_email,"deliveryAddress.shippingWayId":String(o.shipping_way_id),"deliveryAddress.shipment":"drop"
  };
  for(let i=0;i<items.length;i++){params["items."+i+".itemNo"]=items[i].supplierSku;params["items."+i+".qty"]=String(items[i].quantity);params["items."+i+".remark"]="SkyCart "+o.id;}
  try{
   const result:any=await sunsky(env,"order!createOrder.do",params);const ref=clean(String(result?.number||result?.orderNumber||result?.id||""),100);
   if(!ref)throw new Error("SUNSKY response did not include an order number; check the supplier portal before retrying.");
   await env.DB.prepare("UPDATE orders SET status='supplier_submitted',supplier_order_ref=?,supplier_error=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(ref,o.id).run();
   return json({ok:true,orderId:o.id,supplierOrderRef:ref,status:"supplier_submitted"});
  }catch(e){const msg=clean(e instanceof Error?e.message:"SUNSKY order failed",400);await env.DB.prepare("UPDATE orders SET status='supplier_failed',supplier_error=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(msg,o.id).run();return fail(msg,502);}
 }
 return fail("Admin API route not found.",404);
}
async function publicApi(req:Request,env:Env):Promise<Response>{
 const u=new URL(req.url),path=u.pathname;
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:{"allow":"GET, POST, PATCH, OPTIONS"}});
 if(path==="/api/health"&&req.method==="GET"){
  try{await env.DB.prepare("SELECT 1").first();return json({ok:true,service:"skycart",database:"ok",supplierConfigured:await sunskyConfigured(env),adminConfigured:!!env.ADMIN_PASSWORD});}
  catch{return json({ok:false,service:"skycart",database:"unavailable",hint:"Check Cloudflare Workers Builds deployment logs and D1 migrations."},503);}
 }
 if(path.startsWith("/api/admin/"))return adminApi(req,env);
 if(path==="/api/products"&&req.method==="GET"){
  const q=clean(u.searchParams.get("q"),100),cat=clean(u.searchParams.get("category"),60),limit=Math.min(60,Math.max(1,Number(u.searchParams.get("limit")||24)));
  let sql="SELECT id,slug,title,category,description,image_url,price_cents,currency,stock_status,featured,supplier_sku FROM products WHERE active=1 AND supplier_sku IS NOT NULL AND stock_status='in_stock'";
  const args:(string|number)[]=[];if(q){sql+=" AND (title LIKE ? OR description LIKE ? OR category LIKE ?)";const l="%"+q+"%";args.push(l,l,l);}if(cat&&cat!=="All"){sql+=" AND category=?";args.push(cat);}sql+=" ORDER BY featured DESC,title ASC LIMIT ?";args.push(limit);
  try{const rows=await env.DB.prepare(sql).bind(...args).all<Product>();const cats=await env.DB.prepare("SELECT DISTINCT category FROM products WHERE active=1 AND supplier_sku IS NOT NULL AND stock_status='in_stock' ORDER BY category").all<{category:string}>();return json({products:rows.results||[],categories:["All",...(cats.results||[]).map(x=>x.category)]});}catch{return fail("Catalog unavailable. Database migration may still be running.",503);}
 }
 const pm=path.match(/^\/api\/products\/([a-zA-Z0-9-]+)$/);
 if(pm&&req.method==="GET"){const p=await env.DB.prepare("SELECT id,slug,title,category,description,image_url,price_cents,currency,stock_status,featured,supplier_sku FROM products WHERE slug=? AND active=1 AND supplier_sku IS NOT NULL").bind(pm[1]).first<Product>();return p?json({product:p}):fail("Product not found.",404);}
 if(path==="/api/shipping/countries"&&req.method==="GET"){
  try{const data:any=await sunsky(env,"order!getCountries.do");return json({countries:(Array.isArray(data)?data:[]).map((c:any)=>({id:Number(c.id),name:clean(c.name,100),code:clean(c.code,3),shipToState:!!c.shipToState,stateList:Array.isArray(c.stateList)?c.stateList.map((s:any)=>({code:clean(s.code,20),name:clean(s.name,100)})):[]})).filter((c:any)=>c.id&&c.name)});}catch(e){return fail(clean(e instanceof Error?e.message:"Could not load countries",300),502);}
 }
 if(path==="/api/shipping/quote"&&req.method==="POST"){
  let d:any;try{d=await req.json()}catch{return fail("Invalid request.");}
  const countryId=Number(d?.countryId);if(!Number.isInteger(countryId)||countryId<1)return fail("Select a shipping country.");
  if(!Array.isArray(d?.items)||!d.items.length||d.items.length>30)return fail("Cart is empty.");
  const ids=[...new Set(d.items.map((x:any)=>String(x.productId||"")))];if(ids.some(x=>!x))return fail("Invalid cart.");
  const rows=await env.DB.prepare("SELECT id,supplier_sku FROM products WHERE active=1 AND stock_status='in_stock' AND id IN ("+ids.map(()=>"?").join(",")+")").bind(...ids).all<any>();
  if((rows.results||[]).length!==ids.length||(rows.results||[]).some((p:any)=>!p.supplier_sku))return fail("Some products are no longer available.",409);
  const quantities=new Map<string,number>();for(const item of d.items){const n=Number(item.quantity);if(!Number.isInteger(n)||n<1||n>10)return fail("Quantity must be between 1 and 10.");quantities.set(String(item.productId),(quantities.get(String(item.productId))||0)+n);}
  const items=(rows.results||[]).map((p:any)=>({itemNo:p.supplier_sku,qty:quantities.get(p.id)||1}));
  try{const data:any=await sunsky(env,"order!getPricesAndFreights.do",{countryId:String(countryId),state:clean(d.state,80),...sunskyItems(items)});return json({shippingMethods:(data?.freightList||[]).map((x:any)=>({id:Number(x.id),name:clean(x.name,100),costCents:Math.max(0,Math.round(Number(x.shippingCost||0)*100)),transitTime:clean(x.transitTime,60)})).filter((x:any)=>Number.isInteger(x.id)&&x.name),supplierPrices:data?.priceList||[]});}
  catch(e){return fail(clean(e instanceof Error?e.message:"Shipping quote failed",300),502);}
 }
 if(path==="/api/orders"&&req.method==="POST"){
  let d:any;try{const raw=await req.text();if(raw.length>16384)return fail("Request too large.",413);d=JSON.parse(raw);}catch{return fail("Invalid JSON.");}
  const name=clean(d?.customerName,100),email=clean(d?.email,254).toLowerCase(),country=clean(d?.country,100),address=clean(d?.address,400),city=clean(d?.city,100),state=clean(d?.state,100),address2=clean(d?.address2,300),postcode=clean(d?.postcode,30),telephone=clean(d?.telephone,40),countryId=Number(d?.countryId),shippingWayId=Number(d?.shippingWayId);
  if(name.length<2||!emailOK(email)||country.length<2||address.length<5||city.length<2||telephone.length<5)return fail("Enter valid delivery and contact details.");
  if(!Number.isInteger(countryId)||countryId<1||!Number.isInteger(shippingWayId)||shippingWayId<0)return fail("Select a country and shipping method.");
  if(!Array.isArray(d?.items)||!d.items.length||d.items.length>30)return fail("Cart is empty or contains too many lines.");
  const qty=new Map<string,number>();for(const item of d.items){if(typeof item?.productId!=="string"||!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>10)return fail("Quantity must be between 1 and 10.");qty.set(item.productId,(qty.get(item.productId)||0)+item.quantity);}if([...qty.values()].some(n=>n>10))return fail("Maximum quantity per product is 10.");
  const ids=[...qty.keys()],found=await env.DB.prepare("SELECT id,title,price_cents,currency,supplier_sku,supplier_cost_cents,stock_status FROM products WHERE active=1 AND supplier_sku IS NOT NULL AND stock_status='in_stock' AND id IN ("+ids.map(()=>"?").join(",")+")").bind(...ids).all<any>();
  if((found.results||[]).length!==ids.length)return fail("One or more products are unavailable.",409);
  const currencies=new Set((found.results||[]).map((p:any)=>p.currency));if(currencies.size!==1)return fail("Mixed-currency carts are not supported.",409);
  const map=new Map((found.results||[]).map((p:any)=>[p.id,p]));
  const lines=ids.map(id=>{const p:any=map.get(id);return{productId:id,title:p.title,supplierSku:p.supplier_sku,unitPriceCents:p.price_cents,supplierCostCents:p.supplier_cost_cents,quantity:qty.get(id)!};});
  const subtotal=lines.reduce((s,l)=>s+l.unitPriceCents*l.quantity,0);if(!Number.isSafeInteger(subtotal)||subtotal<=0||subtotal>5000000)return fail("Order total outside supported range.",422);
  let freight:any;try{const quote:any=await sunsky(env,"order!getPricesAndFreights.do",{countryId:String(countryId),state,...sunskyItems(lines.map(l=>({itemNo:l.supplierSku,qty:l.quantity})))});freight=(quote?.freightList||[]).find((f:any)=>Number(f.id)===shippingWayId);if(!freight) return fail("Shipping method is no longer available. Refresh the quote.",409);}catch(e){return fail(clean(e instanceof Error?e.message:"Could not verify shipping",300),502);}
  const shipping=Math.max(0,Math.round(Number(freight.shippingCost||0)*100)),total=subtotal+shipping;if(!Number.isSafeInteger(total)||total>10000000)return fail("Order total outside supported range.",422);
  const id=crypto.randomUUID(),key=clean(req.headers.get("idempotency-key"),120)||null,currency=[...currencies][0];
  try{
   await env.DB.prepare("INSERT INTO orders(id,status,customer_name,customer_email,shipping_country,shipping_address,currency,subtotal_cents,shipping_cents,total_cents,items_json,idempotency_key,country_id,state,city,address2,postcode,telephone,shipping_way_id) VALUES(?,'pending_payment',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(id,name,email,country,address,currency,subtotal,shipping,total,JSON.stringify(lines),key,countryId,state,city,address2,postcode,telephone,shippingWayId).run();
   return json({order:{id,status:"pending_payment",currency,subtotalCents:subtotal,shippingCents:shipping,totalCents:total,shippingMethod:clean(freight.name,100)},notice:"Order received. Payment is pending; the store owner must confirm payment before any supplier order is placed."},201);
  }catch(e){if(key){const prior=await env.DB.prepare("SELECT id,status,currency,total_cents FROM orders WHERE idempotency_key=?").bind(key).first<any>();if(prior)return json({order:{id:prior.id,status:prior.status,currency:prior.currency,totalCents:prior.total_cents}});}return fail("Could not save order.",500);}
 }
 const om=path.match(/^\/api\/orders\/([0-9a-f-]{36})$/i);
 if(om&&req.method==="GET"){const o=await env.DB.prepare("SELECT id,status,currency,total_cents,created_at FROM orders WHERE id=?").bind(om[1]).first<any>();return o?json({order:{id:o.id,status:o.status,currency:o.currency,totalCents:o.total_cents,createdAt:o.created_at}}):fail("Order not found.",404);}
 if(path==="/api/integrations/status"&&req.method==="GET"){const configured=await sunskyConfigured(env);return json({supplierConfigured:configured,adminConfigured:!!env.ADMIN_PASSWORD,liveOrdersEnabled:configured,paymentMode:"manual-admin-confirmation"});}
 return fail("API route not found.",404);
}
export default {
 async fetch(req:Request,env:Env):Promise<Response>{
  const u=new URL(req.url);
  if(u.pathname==="/api"||u.pathname.startsWith("/api/"))return publicApi(req,env);
  if(u.pathname==="/admin")return Response.redirect(new URL("/admin.html",u).toString(),302);
  const res=await env.ASSETS.fetch(req),h=new Headers(res.headers);
  h.set("x-content-type-options","nosniff");h.set("referrer-policy","strict-origin-when-cross-origin");h.set("x-frame-options","DENY");h.set("permissions-policy","camera=(), microphone=(), geolocation=()");
  if(u.pathname.endsWith(".html"))h.set("content-security-policy","default-src 'self'; img-src 'self' https://images.unsplash.com https://img.myipadbox.com data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'");
  return new Response(res.body,{status:res.status,statusText:res.statusText,headers:h});
 },
 async scheduled(_event:ScheduledController,env:Env):Promise<void>{
  if(!await sunskyConfigured(env))return;
  try{
   const row=await env.DB.prepare("SELECT value FROM app_settings WHERE key='sunsky_sync_page'").first<any>();let page=Math.max(1,Number(row?.value||1)),done=0,next=page;
   for(let i=0;i<3;i++){const r=await syncPage(env,next,100);done+=r.count;next=(next>=10000||r.count===0)?1:next+1;if(r.count===0)break;}
   await env.DB.prepare("INSERT INTO app_settings(key,value,updated_at) VALUES('sunsky_sync_page',?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP").bind(String(next)).run();
   await env.DB.prepare("INSERT INTO sync_runs(status,message,finished_at) VALUES('success',?,CURRENT_TIMESTAMP)").bind("scheduled sync: "+done+" products; next page "+next).run();
  }catch(e){try{await env.DB.prepare("INSERT INTO sync_runs(status,message,finished_at) VALUES('error',?,CURRENT_TIMESTAMP)").bind(clean(e instanceof Error?e.message:"Scheduled sync failed",300)).run();}catch{}}
 }
};
