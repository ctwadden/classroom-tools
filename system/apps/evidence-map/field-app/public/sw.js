const CACHE_NAME='evidence-map-field-BUILD_VERSION';
const PRECACHE_ASSETS=['/field/','/field/index.html','/field/manifest.json','/field/icon.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(PRECACHE_ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('evidence-map-field-')&&k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin||!PRECACHE_ASSETS.includes(url.pathname))return;
  event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy)));}return response;}).catch(async()=>{const saved=await caches.match(event.request);return saved||(event.request.mode==='navigate'?await caches.match('/field/index.html'):Response.error());}));
});
