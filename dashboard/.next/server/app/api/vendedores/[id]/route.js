(()=>{var a={};a.id=811,a.ids=[811],a.modules={99:a=>{"use strict";a.exports=require("node:sqlite")},261:a=>{"use strict";a.exports=require("next/dist/shared/lib/router/utils/app-paths")},846:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},903:(a,b,c)=>{"use strict";c.d(b,{Ay:()=>o,nL:()=>n});var d=c(99),e=c(3873),f=c.n(e),g=c(5511),h=c.n(g),i=c(2176),j=c.n(i);let k=process.env.SQLITE_DB_PATH?f().resolve(process.env.SQLITE_DB_PATH):f().join(process.cwd(),"..","database.db"),l=new d.DatabaseSync(k),m=!1;function n(){if(!m)for(let b=1;b<=10;b++)try{!function(){l.exec("PRAGMA journal_mode = WAL;"),l.exec("PRAGMA busy_timeout = 5000;"),l.exec(`
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
  `);let b=process.env.BOOTSTRAP_ADMIN_PASSWORD??"",c=b.length>=6;if(0===a.count){let a=h().randomBytes(8).toString("hex"),d=c?b:a,e=j().hashSync(d,10);l.prepare("INSERT INTO users (name, email, password, role, recebe_relatorio) VALUES (?, ?, ?, ?, ?)").run("Administrador","admin@empresa.com",e,"admin",1);let f="1"===process.env.PRINT_BOOTSTRAP_PASSWORD;!c&&f?(console.log("\n========================================================"),console.log("  ADMIN CRIADO: admin@empresa.com"),console.log(`  SENHA TEMPOR\xc1RIA: ${a}`),console.log("  Altere a senha imediatamente ap\xf3s o primeiro login."),console.log("========================================================\n")):c||console.log("[db] Admin padr\xe3o criado. Defina BOOTSTRAP_ADMIN_PASSWORD para controlar a senha.")}let d="1"===process.env.BOOTSTRAP_ADMIN_FORCE,e=(process.env.BOOTSTRAP_ADMIN_EMAIL??"admin@empresa.com").trim().toLowerCase();d&&b&&b.length>=6&&l.prepare("UPDATE users SET password = ? WHERE email = ?").run(j().hashSync(b,10),e)}(),m=!0;return}catch(c){var a;if(c?.errcode!==5&&c?.errstr!=="database is locked"&&c?.message!=="database is locked"&&c?.code!=="ERR_SQLITE_ERROR"||10===b)throw c;a=50*b,Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,a)}}let o=l},1158:(a,b,c)=>{"use strict";c.r(b),c.d(b,{handler:()=>E,patchFetch:()=>D,routeModule:()=>z,serverHooks:()=>C,workAsyncStorage:()=>A,workUnitAsyncStorage:()=>B});var d={};c.r(d),c.d(d,{PATCH:()=>y});var e=c(9225),f=c(4006),g=c(8317),h=c(9373),i=c(4775),j=c(4235),k=c(261),l=c(4365),m=c(771),n=c(3461),o=c(7798),p=c(2280),q=c(2018),r=c(5696),s=c(7929),t=c(6439),u=c(7527),v=c(3211),w=c(903),x=c(5587);async function y(a,{params:b}){let c=await (0,x.WV)();if(!c||"admin"!==c.role)return v.NextResponse.json({error:"N\xe3o autorizado"},{status:403});(0,w.nL)();let{id:d}=await b,e=parseInt(d,10);if(!Number.isFinite(e)||e<=0)return v.NextResponse.json({error:"ID inv\xe1lido"},{status:400});if(!w.Ay.prepare("SELECT id_olist FROM vendedores WHERE id_olist = ?").get(e))return v.NextResponse.json({error:"Vendedora n\xe3o encontrada"},{status:404});let f=await a.json(),g=void 0!==f.email?"string"==typeof f.email&&f.email.trim()||null:void 0,h=void 0!==f.recebe_email?+!!f.recebe_email:void 0;return void 0!==f.meta_mensal?v.NextResponse.json({error:"Meta \xe9 gerenciada pelo Olist"},{status:400}):(void 0!==g&&void 0!==h?w.Ay.prepare("UPDATE vendedores SET email = ?, recebe_email = ?, updated_at = CURRENT_TIMESTAMP WHERE id_olist = ?").run(g,h,e):void 0!==g?w.Ay.prepare("UPDATE vendedores SET email = ?, updated_at = CURRENT_TIMESTAMP WHERE id_olist = ?").run(g,e):void 0!==h&&w.Ay.prepare("UPDATE vendedores SET recebe_email = ?, updated_at = CURRENT_TIMESTAMP WHERE id_olist = ?").run(h,e),v.NextResponse.json({success:!0}))}let z=new e.AppRouteRouteModule({definition:{kind:f.RouteKind.APP_ROUTE,page:"/api/vendedores/[id]/route",pathname:"/api/vendedores/[id]",filename:"route",bundlePath:"app/api/vendedores/[id]/route"},distDir:".next",relativeProjectDir:"",resolvedPagePath:"/opt/betina/performance/dashboard/src/app/api/vendedores/[id]/route.ts",nextConfigOutput:"",userland:d}),{workAsyncStorage:A,workUnitAsyncStorage:B,serverHooks:C}=z;function D(){return(0,g.patchFetch)({workAsyncStorage:A,workUnitAsyncStorage:B})}async function E(a,b,c){c.requestMeta&&(0,h.setRequestMeta)(a,c.requestMeta),z.isDev&&(0,h.addRequestMeta)(a,"devRequestTimingInternalsEnd",process.hrtime.bigint());let d="/api/vendedores/[id]/route";"/index"===d&&(d="/");let e=await z.prepare(a,b,{srcPage:d,multiZoneDraftMode:!1});if(!e)return b.statusCode=400,b.end("Bad Request"),null==c.waitUntil||c.waitUntil.call(c,Promise.resolve()),null;let{buildId:g,params:v,nextConfig:w,parsedUrl:x,isDraftMode:y,prerenderManifest:A,routerServerContext:B,isOnDemandRevalidate:C,revalidateOnlyGenerated:D,resolvedPathname:E,clientReferenceManifest:F,serverActionsManifest:G}=e,H=(0,k.normalizeAppPath)(d),I=!!(A.dynamicRoutes[H]||A.routes[E]),J=async()=>((null==B?void 0:B.render404)?await B.render404(a,b,x,!1):b.end("This page could not be found"),null);if(I&&!y){let a=!!A.routes[E],b=A.dynamicRoutes[H];if(b&&!1===b.fallback&&!a){if(w.adapterPath)return await J();throw new t.NoFallbackError}}let K=null;!I||z.isDev||y||(K="/index"===(K=E)?"/":K);let L=!0===z.isDev||!I,M=I&&!L;G&&F&&(0,j.setManifestsSingleton)({page:d,clientReferenceManifest:F,serverActionsManifest:G});let N=a.method||"GET",O=(0,i.getTracer)(),P=O.getActiveScopeSpan(),Q=!!(null==B?void 0:B.isWrappedByNextServer),R=!!(0,h.getRequestMeta)(a,"minimalMode"),S=(0,h.getRequestMeta)(a,"incrementalCache")||await z.getIncrementalCache(a,w,A,R);null==S||S.resetRequestCache(),globalThis.__incrementalCache=S;let T={params:v,previewProps:A.preview,renderOpts:{experimental:{authInterrupts:!!w.experimental.authInterrupts},cacheComponents:!!w.cacheComponents,supportsDynamicResponse:L,incrementalCache:S,cacheLifeProfiles:w.cacheLife,waitUntil:c.waitUntil,onClose:a=>{b.on("close",a)},onAfterTaskError:void 0,onInstrumentationRequestError:(b,c,d,e)=>z.onRequestError(a,b,d,e,B)},sharedContext:{buildId:g}},U=new l.NodeNextRequest(a),V=new l.NodeNextResponse(b),W=m.NextRequestAdapter.fromNodeNextRequest(U,(0,m.signalFromNodeResponse)(b));try{let e,g=async a=>z.handle(W,T).finally(()=>{if(!a)return;a.setAttributes({"http.status_code":b.statusCode,"next.rsc":!1});let c=O.getRootSpanAttributes();if(!c)return;if(c.get("next.span_type")!==n.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${c.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let f=c.get("next.route");if(f){let b=`${N} ${f}`;a.setAttributes({"next.route":f,"http.route":f,"next.span_name":b}),a.updateName(b),e&&e!==a&&(e.setAttribute("http.route",f),e.updateName(b))}else a.updateName(`${N} ${d}`)}),h=async e=>{var h,i;let j=async({previousCacheEntry:f})=>{try{if(!R&&C&&D&&!f)return b.statusCode=404,b.setHeader("x-nextjs-cache","REVALIDATED"),b.end("This page could not be found"),null;let d=await g(e);a.fetchMetrics=T.renderOpts.fetchMetrics;let h=T.renderOpts.pendingWaitUntil;h&&c.waitUntil&&(c.waitUntil(h),h=void 0);let i=T.renderOpts.collectedTags;if(!I)return await (0,p.I)(U,V,d,T.renderOpts.pendingWaitUntil),null;{let a=await d.blob(),b=(0,q.toNodeOutgoingHttpHeaders)(d.headers);i&&(b[s.NEXT_CACHE_TAGS_HEADER]=i),!b["content-type"]&&a.type&&(b["content-type"]=a.type);let c=void 0!==T.renderOpts.collectedRevalidate&&!(T.renderOpts.collectedRevalidate>=s.INFINITE_CACHE)&&T.renderOpts.collectedRevalidate,e=void 0===T.renderOpts.collectedExpire||T.renderOpts.collectedExpire>=s.INFINITE_CACHE?void 0:T.renderOpts.collectedExpire;return{value:{kind:u.CachedRouteKind.APP_ROUTE,status:d.status,body:Buffer.from(await a.arrayBuffer()),headers:b},cacheControl:{revalidate:c,expire:e}}}}catch(b){throw(null==f?void 0:f.isStale)&&await z.onRequestError(a,b,{routerKind:"App Router",routePath:d,routeType:"route",revalidateReason:(0,o.c)({isStaticGeneration:M,isOnDemandRevalidate:C})},!1,B),b}},k=await z.handleResponse({req:a,nextConfig:w,cacheKey:K,routeKind:f.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:A,isRoutePPREnabled:!1,isOnDemandRevalidate:C,revalidateOnlyGenerated:D,responseGenerator:j,waitUntil:c.waitUntil,isMinimalMode:R});if(!I)return null;if((null==k||null==(h=k.value)?void 0:h.kind)!==u.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==k||null==(i=k.value)?void 0:i.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});R||b.setHeader("x-nextjs-cache",C?"REVALIDATED":k.isMiss?"MISS":k.isStale?"STALE":"HIT"),y&&b.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let l=(0,q.fromNodeOutgoingHttpHeaders)(k.value.headers);return R&&I||l.delete(s.NEXT_CACHE_TAGS_HEADER),!k.cacheControl||b.getHeader("Cache-Control")||l.get("Cache-Control")||l.set("Cache-Control",(0,r.getCacheControlHeader)(k.cacheControl)),await (0,p.I)(U,V,new Response(k.value.body,{headers:l,status:k.value.status||200})),null};Q&&P?await h(P):(e=O.getActiveScopeSpan(),await O.withPropagatedContext(a.headers,()=>O.trace(n.BaseServerSpan.handleRequest,{spanName:`${N} ${d}`,kind:i.SpanKind.SERVER,attributes:{"http.method":N,"http.target":a.url}},h),void 0,!Q))}catch(b){if(b instanceof t.NoFallbackError||await z.onRequestError(a,b,{routerKind:"App Router",routePath:H,routeType:"route",revalidateReason:(0,o.c)({isStaticGeneration:M,isOnDemandRevalidate:C})},!1,B),I)throw b;return await (0,p.I)(U,V,new Response(null,{status:500})),null}}},3033:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},3295:a=>{"use strict";a.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},3873:a=>{"use strict";a.exports=require("path")},4870:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},5511:a=>{"use strict";a.exports=require("crypto")},5587:(a,b,c)=>{"use strict";c.d(b,{WV:()=>i,zF:()=>h});var d=c(3759),e=c.n(d),f=c(5573);let g=process.env.JWT_SECRET??void 0;function h(a){if(!g)throw Error("JWT_SECRET n\xe3o definido.");return e().sign(a,g,{expiresIn:"8h"})}async function i(){let a=await (0,f.UL)(),b=a.get("auth_token")?.value;if(!b)return null;if(!g)return null;try{return e().verify(b,g)}catch{return null}}},6439:a=>{"use strict";a.exports=require("next/dist/shared/lib/no-fallback-error.external")},6487:()=>{},7910:a=>{"use strict";a.exports=require("stream")},8335:()=>{},8354:a=>{"use strict";a.exports=require("util")},9294:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-async-storage.external.js")},9428:a=>{"use strict";a.exports=require("buffer")}};var b=require("../../../../webpack-runtime.js");b.C(a);var c=b.X(0,[445,79,813,795],()=>b(b.s=1158));module.exports=c})();