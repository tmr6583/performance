(()=>{var a={};a.id=23,a.ids=[23],a.modules={99:a=>{"use strict";a.exports=require("node:sqlite")},261:a=>{"use strict";a.exports=require("next/dist/shared/lib/router/utils/app-paths")},846:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},903:(a,b,c)=>{"use strict";c.d(b,{Ay:()=>o,nL:()=>n});var d=c(99),e=c(3873),f=c.n(e),g=c(5511),h=c.n(g),i=c(2176),j=c.n(i);let k=process.env.SQLITE_DB_PATH?f().resolve(process.env.SQLITE_DB_PATH):f().join(process.cwd(),"..","database.db"),l=new d.DatabaseSync(k),m=!1;function n(){if(!m)for(let b=1;b<=10;b++)try{!function(){l.exec("PRAGMA journal_mode = WAL;"),l.exec("PRAGMA busy_timeout = 5000;"),l.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      name             TEXT    NOT NULL,
      email            TEXT    UNIQUE NOT NULL,
      password         TEXT    NOT NULL,
      role             TEXT    CHECK(role IN ('admin','salesperson')) NOT NULL,
      id_olist         INTEGER,
      recebe_relatorio INTEGER NOT NULL DEFAULT 0,
      created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);try{l.exec("ALTER TABLE users ADD COLUMN recebe_relatorio INTEGER NOT NULL DEFAULT 0")}catch{}try{l.exec("ALTER TABLE users ADD COLUMN id_olist INTEGER")}catch{}l.exec(`
    CREATE TABLE IF NOT EXISTS vendedores (
      id_olist     INTEGER PRIMARY KEY,
      nome         TEXT    NOT NULL,
      email        TEXT,
      recebe_email INTEGER NOT NULL DEFAULT 0,
      updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `),l.exec(`
    CREATE TABLE IF NOT EXISTS metas_vendedores (
      id_olist     INTEGER PRIMARY KEY,
      meta_mensal  REAL    NOT NULL DEFAULT 0,
      vigencia_ini TEXT,
      vigencia_fim TEXT,
      updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `),l.exec(`
    CREATE TABLE IF NOT EXISTS performance_cache (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      data             TEXT    NOT NULL,
      id_vendedor      INTEGER NOT NULL,
      nome_vendedor    TEXT    NOT NULL,
      pedidos_dia      INTEGER NOT NULL DEFAULT 0,
      valor_dia        REAL    NOT NULL DEFAULT 0,
      ticket_medio_dia REAL    NOT NULL DEFAULT 0,
      pedidos_mes      INTEGER NOT NULL DEFAULT 0,
      valor_mes        REAL    NOT NULL DEFAULT 0,
      ticket_medio_mes REAL    NOT NULL DEFAULT 0,
      atualizado_em    DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(data, id_vendedor)
    )
  `),l.exec(`
    CREATE TABLE IF NOT EXISTS email_logs (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      enviado_em   DATETIME DEFAULT CURRENT_TIMESTAMP,
      execucao_id  TEXT     NOT NULL,
      tipo         TEXT     NOT NULL CHECK(tipo IN ('vendedora','admin')),
      destinatario TEXT     NOT NULL,
      nome         TEXT,
      status       TEXT     NOT NULL CHECK(status IN ('ok','erro')),
      mensagem     TEXT
    )
  `),l.exec(`
    CREATE TABLE IF NOT EXISTS schedules (
      id         INTEGER PRIMARY KEY DEFAULT 1,
      hora       TEXT    NOT NULL DEFAULT '18:00',
      dias       TEXT    NOT NULL DEFAULT 'seg,ter,qua,qui,sex',
      recorrencia TEXT   NOT NULL DEFAULT 'weekly',
      dia_mes    INTEGER NOT NULL DEFAULT 1,
      ativo      INTEGER NOT NULL DEFAULT 0,
      modificado DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);try{l.exec("ALTER TABLE schedules ADD COLUMN recorrencia TEXT NOT NULL DEFAULT 'weekly'")}catch{}try{l.exec("ALTER TABLE schedules ADD COLUMN dia_mes INTEGER NOT NULL DEFAULT 1")}catch{}l.exec(`
    INSERT OR IGNORE INTO schedules (id, hora, dias, recorrencia, dia_mes, ativo)
    VALUES (1, '18:00', 'seg,ter,qua,qui,sex', 'weekly', 1, 0)
  `),l.exec(`
    UPDATE schedules
    SET
      recorrencia = CASE
        WHEN recorrencia IS NULL OR recorrencia = '' THEN 'weekly'
        ELSE recorrencia
      END,
      dia_mes = CASE
        WHEN dia_mes IS NULL OR dia_mes < 1 THEN 1
        ELSE dia_mes
      END
    WHERE id = 1
  `),l.exec(`
    CREATE TABLE IF NOT EXISTS job_locks (
      name         TEXT PRIMARY KEY,
      locked_until INTEGER NOT NULL,
      lock_id      TEXT NOT NULL
    )
  `);let a=l.prepare("SELECT count(*) as count FROM users WHERE role = 'admin'").get();l.exec(`
    CREATE TABLE IF NOT EXISTS login_attempts (
      email        TEXT NOT NULL,
      ip           TEXT NOT NULL,
      count        INTEGER NOT NULL DEFAULT 0,
      locked_until INTEGER NOT NULL DEFAULT 0,
      updated_at   INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (email, ip)
    )
  `);let b=process.env.BOOTSTRAP_ADMIN_PASSWORD??"",c=b.length>=6;if(0===a.count){let a=h().randomBytes(8).toString("hex"),d=c?b:a,e=j().hashSync(d,10);l.prepare("INSERT INTO users (name, email, password, role, recebe_relatorio) VALUES (?, ?, ?, ?, ?)").run("Administrador","admin@empresa.com",e,"admin",1);let f="1"===process.env.PRINT_BOOTSTRAP_PASSWORD;!c&&f?(console.log("\n========================================================"),console.log("  ADMIN CRIADO: admin@empresa.com"),console.log(`  SENHA TEMPOR\xc1RIA: ${a}`),console.log("  Altere a senha imediatamente ap\xf3s o primeiro login."),console.log("========================================================\n")):c||console.log("[db] Admin padr\xe3o criado. Defina BOOTSTRAP_ADMIN_PASSWORD para controlar a senha.")}let d="1"===process.env.BOOTSTRAP_ADMIN_FORCE,e=(process.env.BOOTSTRAP_ADMIN_EMAIL??"admin@empresa.com").trim().toLowerCase();d&&b&&b.length>=6&&l.prepare("UPDATE users SET password = ? WHERE email = ?").run(j().hashSync(b,10),e)}(),m=!0;return}catch(c){var a;if(c?.errcode!==5&&c?.errstr!=="database is locked"&&c?.message!=="database is locked"&&c?.code!=="ERR_SQLITE_ERROR"||10===b)throw c;a=50*b,Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,a)}}let o=l},3033:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},3295:a=>{"use strict";a.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},3873:a=>{"use strict";a.exports=require("path")},4599:(a,b,c)=>{"use strict";c.r(b),c.d(b,{handler:()=>H,patchFetch:()=>G,routeModule:()=>C,serverHooks:()=>F,workAsyncStorage:()=>D,workUnitAsyncStorage:()=>E});var d={};c.r(d),c.d(d,{GET:()=>A,POST:()=>B});var e=c(9225),f=c(4006),g=c(8317),h=c(9373),i=c(4775),j=c(4235),k=c(261),l=c(4365),m=c(771),n=c(3461),o=c(7798),p=c(2280),q=c(2018),r=c(5696),s=c(7929),t=c(6439),u=c(7527),v=c(3211),w=c(903),x=c(5587),y=c(8070);let z="https://api.tiny.com.br/public-api/v3";async function A(){let a=await (0,x.WV)();if(!a||"admin"!==a.role)return v.NextResponse.json({error:"N\xe3o autorizado"},{status:403});(0,w.nL)();let b=w.Ay.prepare(`
    SELECT v.id_olist, v.nome, v.email, v.recebe_email,
           COALESCE(m.meta_mensal, 0) AS meta_mensal
    FROM vendedores v
    LEFT JOIN metas_vendedores m ON m.id_olist = v.id_olist
    ORDER BY v.nome
  `).all();return v.NextResponse.json(b)}async function B(){let a=await (0,x.WV)();if(!a||"admin"!==a.role)return v.NextResponse.json({error:"N\xe3o autorizado"},{status:403});(0,w.nL)();let b=await (0,y.uX)();if(!b)return v.NextResponse.json({error:'Olist desconectado. Clique em "Conectar ao Olist" primeiro.'},{status:400});let c=0,d=1,e=[];for(;c<d;){let a=await fetch(`${z}/vendedores?limit=100&offset=${c}`,{headers:{Authorization:`Bearer ${b}`}});if(401===a.status){let d=await (0,y.He)();if(d?.refresh_token){let e=await (0,y.J1)(d.refresh_token);e&&(b=e,a=await fetch(`${z}/vendedores?limit=100&offset=${c}`,{headers:{Authorization:`Bearer ${b}`}}))}}if(!a.ok)break;let f=await a.json();for(let a of(d=f.paginacao?.total??0,f.itens??[]))("A"===a.situacao||"B"===a.situacao)&&e.push({id:a.id,nome:a.contato?.nome??`Vendedor ${a.id}`});c+=100}let f=0;for(let a of e)w.Ay.prepare("SELECT id_olist FROM vendedores WHERE id_olist = ?").get(a.id)?w.Ay.prepare("UPDATE vendedores SET nome = ? WHERE id_olist = ?").run(a.nome,a.id):(w.Ay.prepare("INSERT INTO vendedores (id_olist, nome, email, recebe_email) VALUES (?, ?, NULL, 0)").run(a.id,a.nome),f++);return v.NextResponse.json({success:!0,total:e.length,novos:f,ja_existentes:e.length-f})}let C=new e.AppRouteRouteModule({definition:{kind:f.RouteKind.APP_ROUTE,page:"/api/vendedores/route",pathname:"/api/vendedores",filename:"route",bundlePath:"app/api/vendedores/route"},distDir:".next",relativeProjectDir:"",resolvedPagePath:"/opt/betina/performance/dashboard/src/app/api/vendedores/route.ts",nextConfigOutput:"",userland:d}),{workAsyncStorage:D,workUnitAsyncStorage:E,serverHooks:F}=C;function G(){return(0,g.patchFetch)({workAsyncStorage:D,workUnitAsyncStorage:E})}async function H(a,b,c){c.requestMeta&&(0,h.setRequestMeta)(a,c.requestMeta),C.isDev&&(0,h.addRequestMeta)(a,"devRequestTimingInternalsEnd",process.hrtime.bigint());let d="/api/vendedores/route";"/index"===d&&(d="/");let e=await C.prepare(a,b,{srcPage:d,multiZoneDraftMode:!1});if(!e)return b.statusCode=400,b.end("Bad Request"),null==c.waitUntil||c.waitUntil.call(c,Promise.resolve()),null;let{buildId:g,params:v,nextConfig:w,parsedUrl:x,isDraftMode:y,prerenderManifest:z,routerServerContext:A,isOnDemandRevalidate:B,revalidateOnlyGenerated:D,resolvedPathname:E,clientReferenceManifest:F,serverActionsManifest:G}=e,H=(0,k.normalizeAppPath)(d),I=!!(z.dynamicRoutes[H]||z.routes[E]),J=async()=>((null==A?void 0:A.render404)?await A.render404(a,b,x,!1):b.end("This page could not be found"),null);if(I&&!y){let a=!!z.routes[E],b=z.dynamicRoutes[H];if(b&&!1===b.fallback&&!a){if(w.adapterPath)return await J();throw new t.NoFallbackError}}let K=null;!I||C.isDev||y||(K="/index"===(K=E)?"/":K);let L=!0===C.isDev||!I,M=I&&!L;G&&F&&(0,j.setManifestsSingleton)({page:d,clientReferenceManifest:F,serverActionsManifest:G});let N=a.method||"GET",O=(0,i.getTracer)(),P=O.getActiveScopeSpan(),Q=!!(null==A?void 0:A.isWrappedByNextServer),R=!!(0,h.getRequestMeta)(a,"minimalMode"),S=(0,h.getRequestMeta)(a,"incrementalCache")||await C.getIncrementalCache(a,w,z,R);null==S||S.resetRequestCache(),globalThis.__incrementalCache=S;let T={params:v,previewProps:z.preview,renderOpts:{experimental:{authInterrupts:!!w.experimental.authInterrupts},cacheComponents:!!w.cacheComponents,supportsDynamicResponse:L,incrementalCache:S,cacheLifeProfiles:w.cacheLife,waitUntil:c.waitUntil,onClose:a=>{b.on("close",a)},onAfterTaskError:void 0,onInstrumentationRequestError:(b,c,d,e)=>C.onRequestError(a,b,d,e,A)},sharedContext:{buildId:g}},U=new l.NodeNextRequest(a),V=new l.NodeNextResponse(b),W=m.NextRequestAdapter.fromNodeNextRequest(U,(0,m.signalFromNodeResponse)(b));try{let e,g=async a=>C.handle(W,T).finally(()=>{if(!a)return;a.setAttributes({"http.status_code":b.statusCode,"next.rsc":!1});let c=O.getRootSpanAttributes();if(!c)return;if(c.get("next.span_type")!==n.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${c.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let f=c.get("next.route");if(f){let b=`${N} ${f}`;a.setAttributes({"next.route":f,"http.route":f,"next.span_name":b}),a.updateName(b),e&&e!==a&&(e.setAttribute("http.route",f),e.updateName(b))}else a.updateName(`${N} ${d}`)}),h=async e=>{var h,i;let j=async({previousCacheEntry:f})=>{try{if(!R&&B&&D&&!f)return b.statusCode=404,b.setHeader("x-nextjs-cache","REVALIDATED"),b.end("This page could not be found"),null;let d=await g(e);a.fetchMetrics=T.renderOpts.fetchMetrics;let h=T.renderOpts.pendingWaitUntil;h&&c.waitUntil&&(c.waitUntil(h),h=void 0);let i=T.renderOpts.collectedTags;if(!I)return await (0,p.I)(U,V,d,T.renderOpts.pendingWaitUntil),null;{let a=await d.blob(),b=(0,q.toNodeOutgoingHttpHeaders)(d.headers);i&&(b[s.NEXT_CACHE_TAGS_HEADER]=i),!b["content-type"]&&a.type&&(b["content-type"]=a.type);let c=void 0!==T.renderOpts.collectedRevalidate&&!(T.renderOpts.collectedRevalidate>=s.INFINITE_CACHE)&&T.renderOpts.collectedRevalidate,e=void 0===T.renderOpts.collectedExpire||T.renderOpts.collectedExpire>=s.INFINITE_CACHE?void 0:T.renderOpts.collectedExpire;return{value:{kind:u.CachedRouteKind.APP_ROUTE,status:d.status,body:Buffer.from(await a.arrayBuffer()),headers:b},cacheControl:{revalidate:c,expire:e}}}}catch(b){throw(null==f?void 0:f.isStale)&&await C.onRequestError(a,b,{routerKind:"App Router",routePath:d,routeType:"route",revalidateReason:(0,o.c)({isStaticGeneration:M,isOnDemandRevalidate:B})},!1,A),b}},k=await C.handleResponse({req:a,nextConfig:w,cacheKey:K,routeKind:f.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:z,isRoutePPREnabled:!1,isOnDemandRevalidate:B,revalidateOnlyGenerated:D,responseGenerator:j,waitUntil:c.waitUntil,isMinimalMode:R});if(!I)return null;if((null==k||null==(h=k.value)?void 0:h.kind)!==u.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==k||null==(i=k.value)?void 0:i.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});R||b.setHeader("x-nextjs-cache",B?"REVALIDATED":k.isMiss?"MISS":k.isStale?"STALE":"HIT"),y&&b.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let l=(0,q.fromNodeOutgoingHttpHeaders)(k.value.headers);return R&&I||l.delete(s.NEXT_CACHE_TAGS_HEADER),!k.cacheControl||b.getHeader("Cache-Control")||l.get("Cache-Control")||l.set("Cache-Control",(0,r.getCacheControlHeader)(k.cacheControl)),await (0,p.I)(U,V,new Response(k.value.body,{headers:l,status:k.value.status||200})),null};Q&&P?await h(P):(e=O.getActiveScopeSpan(),await O.withPropagatedContext(a.headers,()=>O.trace(n.BaseServerSpan.handleRequest,{spanName:`${N} ${d}`,kind:i.SpanKind.SERVER,attributes:{"http.method":N,"http.target":a.url}},h),void 0,!Q))}catch(b){if(b instanceof t.NoFallbackError||await C.onRequestError(a,b,{routerKind:"App Router",routePath:H,routeType:"route",revalidateReason:(0,o.c)({isStaticGeneration:M,isOnDemandRevalidate:B})},!1,A),I)throw b;return await (0,p.I)(U,V,new Response(null,{status:500})),null}}},4870:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},5511:a=>{"use strict";a.exports=require("crypto")},5587:(a,b,c)=>{"use strict";c.d(b,{WV:()=>i,zF:()=>h});var d=c(3759),e=c.n(d),f=c(5573);let g=process.env.JWT_SECRET??void 0;function h(a){if(!g)throw Error("JWT_SECRET n\xe3o definido.");return e().sign(a,g,{expiresIn:"8h"})}async function i(){let a=await (0,f.UL)(),b=a.get("auth_token")?.value;if(!b)return null;if(!g)return null;try{return e().verify(b,g)}catch{return null}}},6439:a=>{"use strict";a.exports=require("next/dist/shared/lib/no-fallback-error.external")},6487:()=>{},7910:a=>{"use strict";a.exports=require("stream")},8070:(a,b,c)=>{"use strict";c.d(b,{uX:()=>o,He:()=>l,J1:()=>n,wU:()=>m});let d=require("fs/promises");var e=c.n(d),f=c(3873),g=c.n(f);let h=process.env.TOKEN_FILE,i=h?g().resolve(h):g().join(process.cwd(),"..",".tiny_tokens.json"),j=process.env.OLIST_CLIENT_ID??process.env.CLIENT_ID,k=process.env.OLIST_CLIENT_SECRET??process.env.CLIENT_SECRET;async function l(){try{let a=await e().readFile(i,"utf-8"),b=JSON.parse(a);if(!b.access_token&&!b.refresh_token)return null;return{access_token:b.access_token??"",refresh_token:b.refresh_token??null}}catch{return null}}async function m(a){let b=i+".tmp";await e().writeFile(b,JSON.stringify(a),"utf-8"),await e().rename(b,i)}async function n(a){if(!j||!k)return null;try{let b=new URLSearchParams({grant_type:"refresh_token",client_id:j,client_secret:k,refresh_token:a}),c=await fetch("https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:b.toString()});if(!c.ok)return null;let d=await c.json();if(!d.access_token)return null;return await m({access_token:d.access_token,refresh_token:d.refresh_token??a}),d.access_token}catch{return null}}async function o(){let a=await l();return a?a.access_token?a.access_token:a.refresh_token?await n(a.refresh_token):null:null}},8335:()=>{},8354:a=>{"use strict";a.exports=require("util")},9294:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-async-storage.external.js")},9428:a=>{"use strict";a.exports=require("buffer")}};var b=require("../../../webpack-runtime.js");b.C(a);var c=b.X(0,[445,79,813,795],()=>b(b.s=4599));module.exports=c})();