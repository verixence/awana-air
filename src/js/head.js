(function () {
  var d = document.documentElement, q = location.search;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  d.classList.add('js');
  if (!reduce) d.classList.add('motion');
  // Decide once, before first paint, whether the live WebGL scenes run or the static renders show.
  var gl = false;
  if (/[?&]3d=force/.test(q)) gl = true;
  else if (!/[?&]3d=off/.test(q) && !reduce) {
    var c = navigator.connection;
    if (!(c && c.saveData) && !(navigator.deviceMemory && navigator.deviceMemory < 2)) {
      try {
        var x = document.createElement('canvas'), g = x.getContext('webgl2') || x.getContext('webgl');
        if (g) {
          var e = g.getExtension('WEBGL_debug_renderer_info');
          var r = String(e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER));
          gl = !/swiftshader|llvmpipe|softpipe|software|basic render/i.test(r); // no GPU: use the static render
          var l = g.getExtension('WEBGL_lose_context'); if (l) l.loseContext();
        }
      } catch (_) {}
    }
  }
  d.classList.add(gl ? 'gl' : 'nogl');
  if (gl && window.fetch) { // start fetching the jet early (lighter LOD on narrow screens); the still shows until the scene is ready
    var u = matchMedia('(max-width: 760px)').matches ? '/assets/models/bizjet-lod1.glb' : '/assets/models/bizjet-lod0.glb';
    try { window.__jet = { url: u, buf: fetch(u, { priority: 'low' }).then(function (r) { if (!r.ok) throw 0; return r.arrayBuffer(); }) }; window.__jet.buf.catch(function () {}); } catch (_) {}
  }
  // safety net: never leave reveal content hidden if the main script fails to run
  setTimeout(function () { if (!d.classList.contains('ready')) d.classList.add('reveal-all'); }, 3500);
})();
