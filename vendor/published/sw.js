const CACHE='finanzas-pro-final-v33-2-0';
const CORE=["./","./index.html","./manifest.webmanifest","./icon-192.png","./icon-512.png","./assets/main-4BD2VXAC.js","./assets/chunk-MA444GAO.js","./assets/chunk-QPU6DZSR.js","./assets/chunk-CIGMN2FI.js","./assets/chunk-4MMYBEL5.js","./assets/chunk-CKFHCJDW.js","./assets/manrope-latin-wght-normal-73PUZEUA.woff2","./assets/app-UJEEDWAR.css"];
const SHARE_DB='finanzas-pro-share', SHARE_STORE='incoming';

function openShareDb(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(SHARE_DB,1);
    req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(SHARE_STORE))req.result.createObjectStore(SHARE_STORE,{keyPath:'id'})};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
}
async function saveSharedFiles(files){
  const db=await openShareDb();
  await new Promise((resolve,reject)=>{
    const tx=db.transaction(SHARE_STORE,'readwrite'),store=tx.objectStore(SHARE_STORE);
    files.forEach((f,i)=>store.put({id:`${Date.now()}-${i}`,name:f.name||`compartido-${i}`,type:f.type||'application/octet-stream',blob:f,created_at:Date.now()}));
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
  });
  db.close();
}

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('finanzas-pro-') && k!==CACHE).slice(0,-1).map(k=>caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);

  if(event.request.method==='POST'&&url.pathname.endsWith('/share-target')){
    event.respondWith((async()=>{
      try{
        const form=await event.request.formData(),files=form.getAll('files').filter(v=>v&&typeof v==='object'&&typeof v.arrayBuffer==='function');
        if(files.length)await saveSharedFiles(files);
        const target=new URL('./#/capturar?shared=1',self.registration.scope).href;
        return Response.redirect(target,303);
      }catch{
        return Response.redirect(new URL('./#/capturar',self.registration.scope).href,303);
      }
    })());
    return;
  }

  if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).catch(async()=>{const cache=await caches.open(CACHE);return await cache.match('./index.html')||await caches.match('./index.html')||new Response('Abrí la app con conexión para descargarla por primera vez.',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}});}));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>{
    const network=fetch(event.request).then(response=>{
      if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(event.request,copy)).catch(()=>{});}return response;
    }).catch(()=>cached);
    return cached||network.then(r=>r||new Response('No disponible sin conexión',{status:503}));
  }));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  if(event.action==='later')return;
  const route=event.notification?.data?.route||'/';
  event.waitUntil((async()=>{
    const all=await clients.matchAll({type:'window',includeUncontrolled:true});
    const target=new URL(`./#${route}`,self.registration.scope).href;
    for(const client of all){if('focus'in client){await client.focus();client.navigate(target);return}}
    if(clients.openWindow)await clients.openWindow(target);
  })());
});
