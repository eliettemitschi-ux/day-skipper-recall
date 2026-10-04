// build 202610041607
var CACHE='dsr-202610041607';
var FILES=["./","index.html","app.js","data.js","fonts.css","manifest.webmanifest","icons/icon-192.png","icons/icon-512.png","icons/apple-touch-icon.png","fonts/Fraunces-500.woff2","fonts/Fraunces-600.woff2","fonts/IBMPlexMono-500.woff2","fonts/IBMPlexMono-600.woff2","fonts/PublicSans-400.woff2","fonts/PublicSans-600.woff2","fonts/PublicSans-700.woff2"];
self.addEventListener('install',function(e){e.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(FILES);}).then(function(){return self.skipWaiting();}));});
self.addEventListener('activate',function(e){e.waitUntil(caches.keys().then(function(ks){return Promise.all(ks.filter(function(k){return k!==CACHE&&k.indexOf('dsr-')===0;}).map(function(k){return caches.delete(k);}));}).then(function(){return self.clients.claim();}));});
self.addEventListener('fetch',function(e){
  var req=e.request; if(req.method!=='GET') return;
  var url=new URL(req.url); if(url.origin!==location.origin) return;
  e.respondWith(caches.open(CACHE).then(function(c){
    return c.match(req,{ignoreSearch:true}).then(function(hit){
      var net=fetch(req).then(function(r){ if(r&&r.ok) c.put(req,r.clone()); return r; }).catch(function(){ return hit; });
      return hit||net;
    });
  }));
});
