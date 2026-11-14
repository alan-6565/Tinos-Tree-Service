/**
 * Wind in real photos: a small WebGL shader that makes the leaves in a
 * photo sway, ripples away from the cursor, and can wipe to another photo.
 * Usage: <canvas class="wind" data-srcs="a.jpg,b.jpg">; canvas.windShow(i)
 * If WebGL is missing the plain <img> fallback next to it stays visible.
 */
(function () {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const VS = 'attribute vec2 p; varying vec2 vUv; void main(){ vUv = p*0.5+0.5; gl_Position = vec4(p,0.,1.); }';
  const FS = `precision mediump float;
    uniform sampler2D uA, uB; uniform vec2 uRes, uSA, uSB, uMouse; uniform float uT, uMix, uAmt, uMA;
    varying vec2 vUv;
    vec2 cover(vec2 uv, vec2 img){ float rs = uRes.x/uRes.y, ri = img.x/img.y;
      vec2 s = rs > ri ? vec2(1., ri/rs) : vec2(rs/ri, 1.); return (uv-0.5)*s+0.5; }
    void main(){
      vec2 uv = vUv;
      float top = smoothstep(0.1, 1.0, uv.y);
      vec2 w = vec2(sin(uv.y*9.+uT*1.7) + 0.5*sin(uv.y*23.+uT*2.9), cos(uv.x*7.+uT*1.3)) * 0.0045 * top * uAmt;
      vec2 m = uv - uMouse; m.x *= uRes.x/uRes.y; float d = length(m);
      w += normalize(m + 1e-5) * sin(d*38. - uT*7.) * 0.012 * exp(-d*7.) * uMA;
      vec2 q = uv + w;
      float n = sin(uv.x*28. + uT*2.)*0.025;
      float k = smoothstep(0.0, 0.07, uMix*1.2 - (1.0 - uv.y) + n);
      vec4 a = texture2D(uA, cover(q, uSA)); vec4 b = texture2D(uB, cover(q, uSB));
      vec4 c = mix(a, b, k);
      float edge = smoothstep(0.07, 0.0, abs(uMix*1.2 - (1.0 - uv.y) + n)) * step(0.001, uMix) * step(uMix, 0.999);
      gl_FragColor = c + vec4(0.95, 0.72, 0.02, 0.) * edge * 0.6;
    }`;

  function setup(cv) {
    const gl = cv.getContext('webgl', { premultipliedAlpha: false, antialias: false });
    if (!gl) return;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
    gl.useProgram(pr);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = {};
    ['uA', 'uB', 'uRes', 'uSA', 'uSB', 'uMouse', 'uT', 'uMix', 'uAmt', 'uMA'].forEach((n) => { U[n] = gl.getUniformLocation(pr, n); });
    gl.uniform1i(U.uA, 0); gl.uniform1i(U.uB, 1);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    const srcs = cv.dataset.srcs.split(',');
    const tex = srcs.map(() => null), sizes = srcs.map(() => [1, 1]);
    let cur = 0, next = 0, mix = 0, mixing = false, ready = false;
    const mouse = [0.5, 0.5]; let mAmt = 0, visible = true;

    srcs.forEach((src, i) => {
      const img = new Image();
      img.onload = () => {
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        tex[i] = t; sizes[i] = [img.naturalWidth, img.naturalHeight];
        if (i === 0) { ready = true; cv.parentElement.classList.add('gl-on'); }
      };
      img.src = src;
    });

    function resize() {
      const dpr = Math.min(devicePixelRatio || 1, 1.75);
      cv.width = Math.max(1, cv.clientWidth * dpr); cv.height = Math.max(1, cv.clientHeight * dpr);
      gl.viewport(0, 0, cv.width, cv.height);
    }
    addEventListener('resize', resize);
    resize();
    cv.addEventListener('pointermove', (e) => {
      const r = cv.getBoundingClientRect();
      mouse[0] = (e.clientX - r.left) / r.width; mouse[1] = 1 - (e.clientY - r.top) / r.height;
      mAmt = 1;
    });
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(cv);

    cv.windShow = (i) => {
      if (i === cur && !mixing) return;
      if (mixing) { cur = next; }
      next = i; mix = 0; mixing = true;
      if (reduce || !tex[i]) { cur = i; mixing = false; }
    };

    const t0 = performance.now();
    (function frame(now) {
      requestAnimationFrame(frame);
      if (!ready || !visible) return;
      if (cv.width !== Math.round(cv.clientWidth * Math.min(devicePixelRatio || 1, 1.75))) resize();
      const t = (now - t0) / 1000;
      if (mixing) { mix += 0.022; if (mix >= 1) { cur = next; mix = 0; mixing = false; } }
      mAmt *= 0.96;
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex[cur] || tex[0]);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tex[next] || tex[cur] || tex[0]);
      gl.uniform2f(U.uRes, cv.width, cv.height);
      gl.uniform2f(U.uSA, sizes[cur][0], sizes[cur][1]);
      gl.uniform2f(U.uSB, sizes[next][0], sizes[next][1]);
      gl.uniform2f(U.uMouse, mouse[0], mouse[1]);
      gl.uniform1f(U.uT, reduce ? 0 : t);
      gl.uniform1f(U.uMix, mixing ? mix : 0);
      gl.uniform1f(U.uAmt, reduce ? 0 : 1);
      gl.uniform1f(U.uMA, reduce ? 0 : mAmt);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    })(t0);
  }

  function start() { document.querySelectorAll('canvas.wind').forEach(setup); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
