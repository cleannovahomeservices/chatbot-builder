(function () {
  if (typeof window === 'undefined') return;
  var config = window.ChatbotConfig || {};
  var webhookUrl = config.webhookUrl;
  var botName = config.name || 'Asistente';
  if (!webhookUrl) return;

  var css = document.createElement('style');
  css.textContent = '#cb-bubble{position:fixed;bottom:24px;right:24px;width:56px;height:56px;background:linear-gradient(135deg,#7c3aed,#4338ca);border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 24px rgba(124,58,237,.45);z-index:9999;transition:transform .2s}#cb-bubble:hover{transform:scale(1.1)}#cb-bubble svg{width:26px;height:26px;fill:#fff}#cb-win{position:fixed;bottom:96px;right:24px;width:360px;height:520px;background:#0d0d0d;border:1px solid rgba(255,255,255,.1);border-radius:20px;display:none;flex-direction:column;z-index:9998;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.6)}#cb-win.open{display:flex}#cb-head{padding:16px 20px;background:linear-gradient(135deg,#7c3aed,#4338ca);color:#fff;font:600 14px/1 sans-serif;display:flex;align-items:center;gap:10px}#cb-head-dot{width:8px;height:8px;border-radius:50%;background:#4ade80;animation:cb-pulse 2s infinite}@keyframes cb-pulse{0%,100%{opacity:1}50%{opacity:.4}}#cb-msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;font-family:sans-serif}#cb-msgs::-webkit-scrollbar{width:4px}#cb-msgs::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:4px}.cb-msg{max-width:82%;padding:10px 14px;border-radius:14px;font-size:13px;line-height:1.55}.cb-bot{background:rgba(255,255,255,.07);color:rgba(255,255,255,.88);align-self:flex-start;border-bottom-left-radius:4px}.cb-user{background:linear-gradient(135deg,#7c3aed,#4338ca);color:#fff;align-self:flex-end;border-bottom-right-radius:4px}.cb-typing{display:flex;gap:4px;align-items:center;padding:12px 14px}.cb-typing span{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.4);animation:cb-bounce .9s infinite}.cb-typing span:nth-child(2){animation-delay:.15s}.cb-typing span:nth-child(3){animation-delay:.3s}@keyframes cb-bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}#cb-form{display:flex;padding:12px;gap:8px;border-top:1px solid rgba(255,255,255,.08)}#cb-inp{flex:1;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);color:#fff;padding:10px 14px;border-radius:10px;font-size:13px;outline:none;transition:border-color .2s}#cb-inp:focus{border-color:rgba(124,58,237,.5)}#cb-inp::placeholder{color:rgba(255,255,255,.28)}#cb-btn{background:linear-gradient(135deg,#7c3aed,#4338ca);color:#fff;border:none;border-radius:10px;padding:10px 16px;cursor:pointer;font-size:18px;line-height:1;transition:opacity .2s}#cb-btn:hover{opacity:.85}';
  document.head.appendChild(css);

  var bubble = document.createElement('div');
  bubble.id = 'cb-bubble';
  bubble.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>';
  document.body.appendChild(bubble);

  var win = document.createElement('div');
  win.id = 'cb-win';
  win.innerHTML = '<div id="cb-head"><div id="cb-head-dot"></div>' + botName + '</div><div id="cb-msgs"><div class="cb-msg cb-bot">¡Hola! ¿En qué puedo ayudarte hoy?</div></div><div id="cb-form"><input id="cb-inp" type="text" placeholder="Escribe un mensaje…"/><button id="cb-btn">➤</button></div>';
  document.body.appendChild(win);

  var msgs = win.querySelector('#cb-msgs');
  var inp = win.querySelector('#cb-inp');
  var btn = win.querySelector('#cb-btn');

  // Stable session ID for conversation memory (n8n memoryBufferWindow)
  var sessionId = 'cb-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now();

  bubble.addEventListener('click', function () { win.classList.toggle('open'); });

  async function send() {
    var text = inp.value.trim();
    if (!text) return;
    inp.value = '';

    var u = document.createElement('div');
    u.className = 'cb-msg cb-user';
    u.textContent = text;
    msgs.appendChild(u);

    var t = document.createElement('div');
    t.className = 'cb-msg cb-bot cb-typing';
    t.innerHTML = '<span></span><span></span><span></span>';
    msgs.appendChild(t);
    msgs.scrollTop = msgs.scrollHeight;

    try {
      // n8n chatTrigger expects { chatInput, sessionId }
      var r = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatInput: text, sessionId: sessionId }),
      });
      var d = await r.json();
      t.className = 'cb-msg cb-bot';
      // n8n agent returns `output`; fallback for other node types
      t.textContent = d.output || d.text || d.message || d.response || 'Sin respuesta';
    } catch (e) {
      t.className = 'cb-msg cb-bot';
      t.textContent = 'Error al conectar. Inténtalo de nuevo.';
    }
    msgs.scrollTop = msgs.scrollHeight;
  }

  btn.addEventListener('click', send);
  inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });
})();
