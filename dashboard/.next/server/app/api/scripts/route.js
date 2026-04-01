(()=>{var a={};a.id=118,a.ids=[118],a.modules={99:a=>{"use strict";a.exports=require("node:sqlite")},261:a=>{"use strict";a.exports=require("next/dist/shared/lib/router/utils/app-paths")},846:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},903:(a,b,c)=>{"use strict";c.d(b,{Ay:()=>o,nL:()=>n});var d=c(99),e=c(3873),f=c.n(e),g=c(5511),h=c.n(g),i=c(2176),j=c.n(i);let k=process.env.SQLITE_DB_PATH?f().resolve(process.env.SQLITE_DB_PATH):f().join(process.cwd(),"..","database.db"),l=new d.DatabaseSync(k),m=!1;function n(){if(!m)for(let b=1;b<=10;b++)try{!function(){l.exec("PRAGMA journal_mode = WAL;"),l.exec("PRAGMA busy_timeout = 5000;"),l.exec(`
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
  `);let b=process.env.BOOTSTRAP_ADMIN_PASSWORD??"",c=b.length>=6;if(0===a.count){let a=h().randomBytes(8).toString("hex"),d=c?b:a,e=j().hashSync(d,10);l.prepare("INSERT INTO users (name, email, password, role, recebe_relatorio) VALUES (?, ?, ?, ?, ?)").run("Administrador","admin@empresa.com",e,"admin",1);let f="1"===process.env.PRINT_BOOTSTRAP_PASSWORD;!c&&f?(console.log("\n========================================================"),console.log("  ADMIN CRIADO: admin@empresa.com"),console.log(`  SENHA TEMPOR\xc1RIA: ${a}`),console.log("  Altere a senha imediatamente ap\xf3s o primeiro login."),console.log("========================================================\n")):c||console.log("[db] Admin padr\xe3o criado. Defina BOOTSTRAP_ADMIN_PASSWORD para controlar a senha.")}let d="1"===process.env.BOOTSTRAP_ADMIN_FORCE,e=(process.env.BOOTSTRAP_ADMIN_EMAIL??"admin@empresa.com").trim().toLowerCase();d&&b&&b.length>=6&&l.prepare("UPDATE users SET password = ? WHERE email = ?").run(j().hashSync(b,10),e)}(),m=!0;return}catch(c){var a;if(c?.errcode!==5&&c?.errstr!=="database is locked"&&c?.message!=="database is locked"&&c?.code!=="ERR_SQLITE_ERROR"||10===b)throw c;a=50*b,Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,a)}}let o=l},1223:(a,b,c)=>{"use strict";c.r(b),c.d(b,{handler:()=>P,patchFetch:()=>O,routeModule:()=>K,serverHooks:()=>N,workAsyncStorage:()=>L,workUnitAsyncStorage:()=>M});var d={};c.r(d),c.d(d,{POST:()=>J});var e=c(9225),f=c(4006),g=c(8317),h=c(9373),i=c(4775),j=c(4235),k=c(261),l=c(4365),m=c(771),n=c(3461),o=c(7798),p=c(2280),q=c(2018),r=c(5696),s=c(7929),t=c(6439),u=c(7527),v=c(3211);let w=require("child_process");var x=c(8354),y=c(3873),z=c.n(y);let A=require("fs");var B=c.n(A),C=c(5587),D=c(3524),E=c(903);let F=(0,x.promisify)(w.execFile),G=["fetch","send","fetch_and_send"],H=process.env.PERFORMANCE_SCRIPT_DIR??z().join(process.cwd(),"..");async function I(a){let b=z().join(H,a);try{let a,c,{stdout:d,stderr:e}=await F((a=z().join(H,".venv","bin","python"),B().existsSync(a)?a:"python3"),[b],{cwd:H,env:(!(c={...process.env}).CLIENT_ID&&c.OLIST_CLIENT_ID&&(c.CLIENT_ID=c.OLIST_CLIENT_ID),!c.CLIENT_SECRET&&c.OLIST_CLIENT_SECRET&&(c.CLIENT_SECRET=c.OLIST_CLIENT_SECRET),c.PYTHONUNBUFFERED=c.PYTHONUNBUFFERED??"1",c),timeout:3e5}),f=d+(e?`
STDERR:
${e}`:"");return{code:0,output:f}}catch(b){let a=(b.stdout??"")+(b.stderr?`
STDERR:
${b.stderr}`:"");return{code:b.code??1,output:a||b.message||"Erro desconhecido"}}}async function J(a){var b;let c,d,e;if(!(0,D.L)(a)){let a=await (0,C.WV)();if(!a||"admin"!==a.role)return v.NextResponse.json({error:"N\xe3o autorizado"},{status:403})}let{acao:f}=await a.json();if(!f||!G.includes(f))return v.NextResponse.json({error:"A\xe7\xe3o inv\xe1lida"},{status:400});let g=((0,E.nL)(),c=Date.now(),d=`${c}-${Math.random().toString(16).slice(2)}`,e=c+36e4,E.Ay.prepare(`
    INSERT INTO job_locks (name, locked_until, lock_id)
    VALUES (?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET
      locked_until = excluded.locked_until,
      lock_id = excluded.lock_id
    WHERE job_locks.locked_until < ?
    `).run("fetch_and_send",e,d,c).changes>0?{ok:!0,lockId:d}:{ok:!1});if(!g.ok)return v.NextResponse.json({error:"J\xe1 existe uma execu\xe7\xe3o em andamento. Aguarde."},{status:409});try{if("fetch"===f){let a=await I("fetch_performance.py");return v.NextResponse.json({success:0===a.code,...a})}if("send"===f){let a=await I("send_emails.py");return v.NextResponse.json({success:0===a.code,...a})}let a=await I("fetch_performance.py");if(0!==a.code)return v.NextResponse.json({success:!1,step:"fetch",code:a.code,output:a.output});let b=await I("send_emails.py");return v.NextResponse.json({success:0===b.code,step:"send",code:b.code,output:`[fetch]
${a.output}

[send]
${b.output}`})}finally{b=g.lockId,(0,E.nL)(),E.Ay.prepare("UPDATE job_locks SET locked_until = 0 WHERE name = ? AND lock_id = ?").run("fetch_and_send",b)}}let K=new e.AppRouteRouteModule({definition:{kind:f.RouteKind.APP_ROUTE,page:"/api/scripts/route",pathname:"/api/scripts",filename:"route",bundlePath:"app/api/scripts/route"},distDir:".next",relativeProjectDir:"",resolvedPagePath:"/opt/betina/performance/dashboard/src/app/api/scripts/route.ts",nextConfigOutput:"",userland:d}),{workAsyncStorage:L,workUnitAsyncStorage:M,serverHooks:N}=K;function O(){return(0,g.patchFetch)({workAsyncStorage:L,workUnitAsyncStorage:M})}async function P(a,b,c){c.requestMeta&&(0,h.setRequestMeta)(a,c.requestMeta),K.isDev&&(0,h.addRequestMeta)(a,"devRequestTimingInternalsEnd",process.hrtime.bigint());let d="/api/scripts/route";"/index"===d&&(d="/");let e=await K.prepare(a,b,{srcPage:d,multiZoneDraftMode:!1});if(!e)return b.statusCode=400,b.end("Bad Request"),null==c.waitUntil||c.waitUntil.call(c,Promise.resolve()),null;let{buildId:g,params:v,nextConfig:w,parsedUrl:x,isDraftMode:y,prerenderManifest:z,routerServerContext:A,isOnDemandRevalidate:B,revalidateOnlyGenerated:C,resolvedPathname:D,clientReferenceManifest:E,serverActionsManifest:F}=e,G=(0,k.normalizeAppPath)(d),H=!!(z.dynamicRoutes[G]||z.routes[D]),I=async()=>((null==A?void 0:A.render404)?await A.render404(a,b,x,!1):b.end("This page could not be found"),null);if(H&&!y){let a=!!z.routes[D],b=z.dynamicRoutes[G];if(b&&!1===b.fallback&&!a){if(w.adapterPath)return await I();throw new t.NoFallbackError}}let J=null;!H||K.isDev||y||(J="/index"===(J=D)?"/":J);let L=!0===K.isDev||!H,M=H&&!L;F&&E&&(0,j.setManifestsSingleton)({page:d,clientReferenceManifest:E,serverActionsManifest:F});let N=a.method||"GET",O=(0,i.getTracer)(),P=O.getActiveScopeSpan(),Q=!!(null==A?void 0:A.isWrappedByNextServer),R=!!(0,h.getRequestMeta)(a,"minimalMode"),S=(0,h.getRequestMeta)(a,"incrementalCache")||await K.getIncrementalCache(a,w,z,R);null==S||S.resetRequestCache(),globalThis.__incrementalCache=S;let T={params:v,previewProps:z.preview,renderOpts:{experimental:{authInterrupts:!!w.experimental.authInterrupts},cacheComponents:!!w.cacheComponents,supportsDynamicResponse:L,incrementalCache:S,cacheLifeProfiles:w.cacheLife,waitUntil:c.waitUntil,onClose:a=>{b.on("close",a)},onAfterTaskError:void 0,onInstrumentationRequestError:(b,c,d,e)=>K.onRequestError(a,b,d,e,A)},sharedContext:{buildId:g}},U=new l.NodeNextRequest(a),V=new l.NodeNextResponse(b),W=m.NextRequestAdapter.fromNodeNextRequest(U,(0,m.signalFromNodeResponse)(b));try{let e,g=async a=>K.handle(W,T).finally(()=>{if(!a)return;a.setAttributes({"http.status_code":b.statusCode,"next.rsc":!1});let c=O.getRootSpanAttributes();if(!c)return;if(c.get("next.span_type")!==n.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${c.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let f=c.get("next.route");if(f){let b=`${N} ${f}`;a.setAttributes({"next.route":f,"http.route":f,"next.span_name":b}),a.updateName(b),e&&e!==a&&(e.setAttribute("http.route",f),e.updateName(b))}else a.updateName(`${N} ${d}`)}),h=async e=>{var h,i;let j=async({previousCacheEntry:f})=>{try{if(!R&&B&&C&&!f)return b.statusCode=404,b.setHeader("x-nextjs-cache","REVALIDATED"),b.end("This page could not be found"),null;let d=await g(e);a.fetchMetrics=T.renderOpts.fetchMetrics;let h=T.renderOpts.pendingWaitUntil;h&&c.waitUntil&&(c.waitUntil(h),h=void 0);let i=T.renderOpts.collectedTags;if(!H)return await (0,p.I)(U,V,d,T.renderOpts.pendingWaitUntil),null;{let a=await d.blob(),b=(0,q.toNodeOutgoingHttpHeaders)(d.headers);i&&(b[s.NEXT_CACHE_TAGS_HEADER]=i),!b["content-type"]&&a.type&&(b["content-type"]=a.type);let c=void 0!==T.renderOpts.collectedRevalidate&&!(T.renderOpts.collectedRevalidate>=s.INFINITE_CACHE)&&T.renderOpts.collectedRevalidate,e=void 0===T.renderOpts.collectedExpire||T.renderOpts.collectedExpire>=s.INFINITE_CACHE?void 0:T.renderOpts.collectedExpire;return{value:{kind:u.CachedRouteKind.APP_ROUTE,status:d.status,body:Buffer.from(await a.arrayBuffer()),headers:b},cacheControl:{revalidate:c,expire:e}}}}catch(b){throw(null==f?void 0:f.isStale)&&await K.onRequestError(a,b,{routerKind:"App Router",routePath:d,routeType:"route",revalidateReason:(0,o.c)({isStaticGeneration:M,isOnDemandRevalidate:B})},!1,A),b}},k=await K.handleResponse({req:a,nextConfig:w,cacheKey:J,routeKind:f.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:z,isRoutePPREnabled:!1,isOnDemandRevalidate:B,revalidateOnlyGenerated:C,responseGenerator:j,waitUntil:c.waitUntil,isMinimalMode:R});if(!H)return null;if((null==k||null==(h=k.value)?void 0:h.kind)!==u.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==k||null==(i=k.value)?void 0:i.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});R||b.setHeader("x-nextjs-cache",B?"REVALIDATED":k.isMiss?"MISS":k.isStale?"STALE":"HIT"),y&&b.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let l=(0,q.fromNodeOutgoingHttpHeaders)(k.value.headers);return R&&H||l.delete(s.NEXT_CACHE_TAGS_HEADER),!k.cacheControl||b.getHeader("Cache-Control")||l.get("Cache-Control")||l.set("Cache-Control",(0,r.getCacheControlHeader)(k.cacheControl)),await (0,p.I)(U,V,new Response(k.value.body,{headers:l,status:k.value.status||200})),null};Q&&P?await h(P):(e=O.getActiveScopeSpan(),await O.withPropagatedContext(a.headers,()=>O.trace(n.BaseServerSpan.handleRequest,{spanName:`${N} ${d}`,kind:i.SpanKind.SERVER,attributes:{"http.method":N,"http.target":a.url}},h),void 0,!Q))}catch(b){if(b instanceof t.NoFallbackError||await K.onRequestError(a,b,{routerKind:"App Router",routePath:G,routeType:"route",revalidateReason:(0,o.c)({isStaticGeneration:M,isOnDemandRevalidate:B})},!1,A),H)throw b;return await (0,p.I)(U,V,new Response(null,{status:500})),null}}},2703:a=>{"use strict";a.exports=require("node-cron")},3033:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},3295:a=>{"use strict";a.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},3524:(a,b,c)=>{"use strict";c.d(b,{L:()=>k,v:()=>j});var d=c(2703),e=c.n(d),f=c(903);let g=null,h={dom:0,seg:1,ter:2,qua:3,qui:4,sex:5,sab:6};async function i(){try{let a=process.env.PORT??3200,b=`http://127.0.0.1:${a}/performance`,c=process.env.INTERNAL_SECRET??"",d=await fetch(`${b}/api/scripts`,{method:"POST",headers:{"Content-Type":"application/json","x-internal-secret":c},body:JSON.stringify({acao:"fetch_and_send"})});d.ok||console.error(`[scheduler] fetch_and_send retornou HTTP ${d.status}`)}catch(a){console.error("[scheduler] Erro ao disparar fetch_and_send:",a)}}function j(){g&&(g.stop(),g=null);try{(0,f.nL)();let a=f.Ay.prepare("SELECT hora, dias, recorrencia, dia_mes, ativo FROM schedules WHERE id = 1").get();if(!a||!a.ativo)return void console.log("[scheduler] Agendamento desativado.");let b=process.env.TZ??"America/Sao_Paulo",c=a.recorrencia??"weekly",d=a.dia_mes??1,j="weekly"===c?function(a,b){let[c,d]=a.split(":"),e=b.split(",").map(a=>h[a.trim()]).filter(a=>void 0!==a);return`${d} ${c} * * ${e.join(",")}`}(a.hora,a.dias):function(a){let[b,c]=a.split(":");return`${c} ${b} * * *`}(a.hora);if(!e().validate(j))return void console.error(`[scheduler] Express\xe3o cron inv\xe1lida: ${j}`);g=e().schedule(j,()=>{("monthly"!==c||function(a,b){var c;let d,e,f,{year:g,month:h,day:i}=(c=new Date,d=new Intl.DateTimeFormat("en-US",{timeZone:b,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(c),e=Number(d.find(a=>"year"===a.type)?.value??"0"),f=Number(d.find(a=>"month"===a.type)?.value??"0"),{year:e,month:f,day:Number(d.find(a=>"day"===a.type)?.value??"0")});return i===Math.min(Math.max(a,1),new Date(Date.UTC(g,h,0)).getUTCDate())}(d,b))&&(console.log(`[scheduler] Disparando fetch_and_send — ${new Date().toISOString()}`),i())},{timezone:b});let k="weekly"===c?`${a.hora} em ${a.dias}`:"monthly"===c?`${a.hora} no dia ${d} do m\xeas`:`${a.hora} todos os dias`;console.log(`[scheduler] Job agendado: ${j} (${k})`)}catch(a){console.error("[scheduler] Erro ao carregar schedule:",a)}}function k(a){let b=process.env.INTERNAL_SECRET;return!!b&&a.headers.get("x-internal-secret")===b}},3873:a=>{"use strict";a.exports=require("path")},4870:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},5511:a=>{"use strict";a.exports=require("crypto")},5587:(a,b,c)=>{"use strict";c.d(b,{WV:()=>i,zF:()=>h});var d=c(3759),e=c.n(d),f=c(5573);let g=process.env.JWT_SECRET??void 0;function h(a){if(!g)throw Error("JWT_SECRET n\xe3o definido.");return e().sign(a,g,{expiresIn:"8h"})}async function i(){let a=await (0,f.UL)(),b=a.get("auth_token")?.value;if(!b)return null;if(!g)return null;try{return e().verify(b,g)}catch{return null}}},6439:a=>{"use strict";a.exports=require("next/dist/shared/lib/no-fallback-error.external")},6487:()=>{},7910:a=>{"use strict";a.exports=require("stream")},8335:()=>{},8354:a=>{"use strict";a.exports=require("util")},9294:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-async-storage.external.js")},9428:a=>{"use strict";a.exports=require("buffer")}};var b=require("../../../webpack-runtime.js");b.C(a);var c=b.X(0,[445,79,813,795],()=>b(b.s=1223));module.exports=c})();