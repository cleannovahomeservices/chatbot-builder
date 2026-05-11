(function () {
  if (typeof window === 'undefined') return;
  if (window.__chatbotWidgetLoaded) return;
  window.__chatbotWidgetLoaded = true;

  var config = window.ChatbotConfig || {};
  var chatbotId = config.chatbotId;
  var webhookUrl = config.webhookUrl;
  if (!chatbotId && !webhookUrl) return;

  var botName = config.name || 'Asistente';
  var wStyle = config.style || 'bubble';
  var p = config.primaryColor || '#7c3aed';
  var s = config.secondaryColor || '#4338ca';
  var iconType = config.icon || 'chat';

  function hexToRgb(hex) {
    return parseInt(hex.slice(1,3),16)+','+parseInt(hex.slice(3,5),16)+','+parseInt(hex.slice(5,7),16);
  }
  var pr = hexToRgb(p.length === 7 ? p : '#7c3aed');

  function buildCSS() {
    var themes = {

      bubble:
        '#cb-bubble{position:fixed;bottom:24px;right:24px;width:56px;height:56px;background:linear-gradient(135deg,'+p+','+s+');border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 24px rgba('+pr+',.45);z-index:9999;transition:transform .2s}' +
        '#cb-bubble:hover{transform:scale(1.1)}' +
        '#cb-bubble svg{width:26px;height:26px;fill:#fff}' +
        '#cb-win{position:fixed;bottom:96px;right:24px;width:360px;height:520px;background:#0d0d0d;border:1px solid rgba(255,255,255,.1);border-radius:20px;display:none;flex-direction:column;z-index:9998;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.6)}' +
        '#cb-win.open{display:flex}' +
        '#cb-head{padding:16px 20px;background:linear-gradient(135deg,'+p+','+s+');color:#fff;font:600 14px/1 sans-serif;display:flex;align-items:center;gap:10px}' +
        '#cb-head-dot{width:8px;height:8px;border-radius:50%;background:#4ade80;animation:cb-pulse 2s infinite}' +
        '@keyframes cb-pulse{0%,100%{opacity:1}50%{opacity:.4}}' +
        '#cb-msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;font-family:sans-serif}' +
        '#cb-msgs::-webkit-scrollbar{width:4px}#cb-msgs::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:4px}' +
        '.cb-msg{max-width:82%;padding:10px 14px;border-radius:14px;font-size:13px;line-height:1.55}' +
        '.cb-bot{background:rgba(255,255,255,.07);color:rgba(255,255,255,.88);align-self:flex-start;border-bottom-left-radius:4px}' +
        '.cb-user{background:linear-gradient(135deg,'+p+','+s+');color:#fff;align-self:flex-end;border-bottom-right-radius:4px}' +
        '.cb-typing{display:flex;gap:4px;align-items:center;padding:12px 14px}' +
        '.cb-typing span{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.4);animation:cb-bounce .9s infinite}' +
        '.cb-typing span:nth-child(2){animation-delay:.15s}.cb-typing span:nth-child(3){animation-delay:.3s}' +
        '@keyframes cb-bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}' +
        '#cb-form{display:flex;padding:12px;gap:8px;border-top:1px solid rgba(255,255,255,.08)}' +
        '#cb-inp{flex:1;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);color:#fff;padding:10px 14px;border-radius:10px;font-size:13px;outline:none;transition:border-color .2s}' +
        '#cb-inp:focus{border-color:rgba('+pr+',.5)}#cb-inp::placeholder{color:rgba(255,255,255,.28)}' +
        '#cb-btn{background:linear-gradient(135deg,'+p+','+s+');color:#fff;border:none;border-radius:10px;padding:10px 16px;cursor:pointer;font-size:18px;line-height:1;transition:opacity .2s}' +
        '#cb-btn:hover{opacity:.85}',

      minimal:
        '#cb-bubble{position:fixed;bottom:24px;right:24px;width:52px;height:52px;background:'+p+';border-radius:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 12px rgba('+pr+',.3);z-index:9999;transition:transform .2s,box-shadow .2s}' +
        '#cb-bubble:hover{transform:translateY(-2px);box-shadow:0 4px 20px rgba('+pr+',.45)}' +
        '#cb-bubble svg{width:24px;height:24px;fill:#fff}' +
        '#cb-win{position:fixed;bottom:88px;right:24px;width:360px;height:500px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;display:none;flex-direction:column;z-index:9998;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.12)}' +
        '#cb-win.open{display:flex}' +
        '#cb-head{padding:14px 18px;background:#fff;border-bottom:1px solid #e5e7eb;color:#111;font:600 14px/1 sans-serif;display:flex;align-items:center;gap:10px}' +
        '#cb-head-dot{width:8px;height:8px;border-radius:50%;background:'+p+';animation:cb-pulse 2s infinite}' +
        '@keyframes cb-pulse{0%,100%{opacity:1}50%{opacity:.4}}' +
        '#cb-msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:8px;font-family:sans-serif;background:#f9fafb}' +
        '#cb-msgs::-webkit-scrollbar{width:4px}#cb-msgs::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:4px}' +
        '.cb-msg{max-width:82%;padding:9px 13px;border-radius:8px;font-size:13px;line-height:1.55}' +
        '.cb-bot{background:#fff;color:#374151;align-self:flex-start;border:1px solid #e5e7eb}' +
        '.cb-user{background:'+p+';color:#fff;align-self:flex-end}' +
        '.cb-typing{display:flex;gap:4px;align-items:center;padding:10px 13px}' +
        '.cb-typing span{width:5px;height:5px;border-radius:50%;background:#9ca3af;animation:cb-bounce .9s infinite}' +
        '.cb-typing span:nth-child(2){animation-delay:.15s}.cb-typing span:nth-child(3){animation-delay:.3s}' +
        '@keyframes cb-bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}' +
        '#cb-form{display:flex;padding:10px 12px;gap:8px;border-top:1px solid #e5e7eb;background:#fff}' +
        '#cb-inp{flex:1;background:#f3f4f6;border:1px solid transparent;color:#111;padding:9px 13px;border-radius:8px;font-size:13px;outline:none;transition:border-color .2s,background .2s}' +
        '#cb-inp:focus{border-color:'+p+';background:#fff}#cb-inp::placeholder{color:#9ca3af}' +
        '#cb-btn{background:'+p+';color:#fff;border:none;border-radius:8px;padding:9px 15px;cursor:pointer;font-size:17px;line-height:1;transition:opacity .2s}' +
        '#cb-btn:hover{opacity:.85}',

      rounded:
        '#cb-bubble{position:fixed;bottom:24px;right:24px;width:56px;height:56px;background:'+p+';border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba('+pr+',.4);z-index:9999;transition:transform .2s}' +
        '#cb-bubble:hover{transform:scale(1.08)}' +
        '#cb-bubble svg{width:26px;height:26px;fill:#fff}' +
        '#cb-win{position:fixed;bottom:96px;right:24px;width:360px;height:520px;background:#fff;border-radius:28px;display:none;flex-direction:column;z-index:9998;overflow:hidden;box-shadow:0 12px 40px rgba('+pr+',.15)}' +
        '#cb-win.open{display:flex}' +
        '#cb-head{padding:18px 22px;background:'+p+';color:#fff;font:600 14px/1 sans-serif;display:flex;align-items:center;gap:10px}' +
        '#cb-head-dot{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.8);animation:cb-pulse 2s infinite}' +
        '@keyframes cb-pulse{0%,100%{opacity:1}50%{opacity:.4}}' +
        '#cb-msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;font-family:sans-serif;background:#f8fafc}' +
        '#cb-msgs::-webkit-scrollbar{width:4px}#cb-msgs::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:4px}' +
        '.cb-msg{max-width:80%;padding:11px 16px;border-radius:22px;font-size:13px;line-height:1.55}' +
        '.cb-bot{background:#fff;color:#1e293b;align-self:flex-start;border-bottom-left-radius:6px;box-shadow:0 1px 4px rgba(0,0,0,.07)}' +
        '.cb-user{background:'+p+';color:#fff;align-self:flex-end;border-bottom-right-radius:6px}' +
        '.cb-typing{display:flex;gap:4px;align-items:center;padding:11px 16px}' +
        '.cb-typing span{width:6px;height:6px;border-radius:50%;background:#94a3b8;animation:cb-bounce .9s infinite}' +
        '.cb-typing span:nth-child(2){animation-delay:.15s}.cb-typing span:nth-child(3){animation-delay:.3s}' +
        '@keyframes cb-bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}' +
        '#cb-form{display:flex;padding:12px 16px;gap:8px;border-top:1px solid #f1f5f9;background:#fff}' +
        '#cb-inp{flex:1;background:#f1f5f9;border:2px solid transparent;color:#1e293b;padding:10px 16px;border-radius:22px;font-size:13px;outline:none;transition:border-color .2s}' +
        '#cb-inp:focus{border-color:'+p+';background:#fff}#cb-inp::placeholder{color:#94a3b8}' +
        '#cb-btn{background:'+p+';color:#fff;border:none;border-radius:50%;width:40px;height:40px;cursor:pointer;font-size:17px;flex-shrink:0;transition:opacity .2s}' +
        '#cb-btn:hover{opacity:.85}',

      dark:
        '#cb-bubble{position:fixed;bottom:24px;right:24px;width:56px;height:56px;background:rgba(15,15,20,.85);border:1px solid rgba('+pr+',.6);border-radius:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 0 20px rgba('+pr+',.25);z-index:9999;transition:transform .2s,box-shadow .2s;backdrop-filter:blur(10px)}' +
        '#cb-bubble:hover{transform:translateY(-2px);box-shadow:0 0 32px rgba('+pr+',.45)}' +
        '#cb-bubble svg{width:24px;height:24px;fill:'+p+'}' +
        '#cb-win{position:fixed;bottom:96px;right:24px;width:360px;height:520px;background:rgba(10,10,18,.88);border:1px solid rgba('+pr+',.18);border-radius:20px;display:none;flex-direction:column;z-index:9998;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.7);backdrop-filter:blur(20px)}' +
        '#cb-win.open{display:flex}' +
        '#cb-head{padding:16px 20px;background:rgba('+pr+',.1);border-bottom:1px solid rgba('+pr+',.15);color:#fff;font:600 14px/1 sans-serif;display:flex;align-items:center;gap:10px}' +
        '#cb-head-dot{width:8px;height:8px;border-radius:50%;background:'+p+';box-shadow:0 0 6px '+p+';animation:cb-pulse 2s infinite}' +
        '@keyframes cb-pulse{0%,100%{opacity:1}50%{opacity:.4}}' +
        '#cb-msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;font-family:sans-serif}' +
        '#cb-msgs::-webkit-scrollbar{width:4px}#cb-msgs::-webkit-scrollbar-thumb{background:rgba('+pr+',.2);border-radius:4px}' +
        '.cb-msg{max-width:82%;padding:10px 14px;border-radius:14px;font-size:13px;line-height:1.55}' +
        '.cb-bot{background:rgba(255,255,255,.05);color:rgba(255,255,255,.8);align-self:flex-start;border:1px solid rgba(255,255,255,.07);border-bottom-left-radius:4px}' +
        '.cb-user{background:rgba('+pr+',.2);color:#fff;border:1px solid rgba('+pr+',.3);align-self:flex-end;border-bottom-right-radius:4px}' +
        '.cb-typing{display:flex;gap:4px;align-items:center;padding:12px 14px}' +
        '.cb-typing span{width:6px;height:6px;border-radius:50%;background:rgba('+pr+',.5);animation:cb-bounce .9s infinite}' +
        '.cb-typing span:nth-child(2){animation-delay:.15s}.cb-typing span:nth-child(3){animation-delay:.3s}' +
        '@keyframes cb-bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}' +
        '#cb-form{display:flex;padding:12px;gap:8px;border-top:1px solid rgba('+pr+',.1)}' +
        '#cb-inp{flex:1;background:rgba(255,255,255,.05);border:1px solid rgba('+pr+',.2);color:#fff;padding:10px 14px;border-radius:10px;font-size:13px;outline:none;transition:border-color .2s}' +
        '#cb-inp:focus{border-color:rgba('+pr+',.5)}#cb-inp::placeholder{color:rgba(255,255,255,.2)}' +
        '#cb-btn{background:rgba('+pr+',.18);color:'+p+';border:1px solid rgba('+pr+',.3);border-radius:10px;padding:10px 16px;cursor:pointer;font-size:18px;line-height:1;transition:all .2s}' +
        '#cb-btn:hover{background:rgba('+pr+',.35)}',

      neon:
        '#cb-bubble{position:fixed;bottom:24px;right:24px;width:56px;height:56px;background:#000;border:2px solid '+p+';border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 0 15px '+p+',inset 0 0 15px rgba('+pr+',.1);z-index:9999;transition:all .2s}' +
        '#cb-bubble:hover{box-shadow:0 0 28px '+p+',0 0 55px rgba('+pr+',.35)}' +
        '#cb-bubble svg{width:24px;height:24px;fill:'+p+';filter:drop-shadow(0 0 4px '+p+')}' +
        '#cb-win{position:fixed;bottom:96px;right:24px;width:360px;height:520px;background:#050505;border:1px solid '+p+';border-radius:12px;display:none;flex-direction:column;z-index:9998;overflow:hidden;box-shadow:0 0 30px rgba('+pr+',.3)}' +
        '#cb-win.open{display:flex}' +
        '#cb-head{padding:16px 20px;background:#0a0a0a;border-bottom:1px solid '+p+';color:'+p+';font:700 13px/1 monospace;display:flex;align-items:center;gap:10px;text-shadow:0 0 8px '+p+'}' +
        '#cb-head-dot{width:8px;height:8px;border-radius:50%;background:'+p+';box-shadow:0 0 8px '+p+';animation:cb-pulse 2s infinite}' +
        '@keyframes cb-pulse{0%,100%{opacity:1}50%{opacity:.3}}' +
        '#cb-msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;font-family:monospace}' +
        '#cb-msgs::-webkit-scrollbar{width:4px}#cb-msgs::-webkit-scrollbar-thumb{background:rgba('+pr+',.3);border-radius:4px}' +
        '.cb-msg{max-width:85%;padding:10px 14px;border-radius:6px;font-size:12px;line-height:1.6}' +
        '.cb-bot{background:rgba('+pr+',.05);color:rgba(255,255,255,.7);align-self:flex-start;border-left:2px solid '+p+'}' +
        '.cb-user{background:rgba('+pr+',.12);color:'+p+';align-self:flex-end;border:1px solid rgba('+pr+',.4);text-shadow:0 0 6px rgba('+pr+',.5)}' +
        '.cb-typing{display:flex;gap:4px;align-items:center;padding:10px 14px}' +
        '.cb-typing span{width:6px;height:6px;border-radius:50%;background:'+p+';box-shadow:0 0 4px '+p+';animation:cb-bounce .9s infinite}' +
        '.cb-typing span:nth-child(2){animation-delay:.15s}.cb-typing span:nth-child(3){animation-delay:.3s}' +
        '@keyframes cb-bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}' +
        '#cb-form{display:flex;padding:12px;gap:8px;border-top:1px solid rgba('+pr+',.3)}' +
        '#cb-inp{flex:1;background:#0a0a0a;border:1px solid rgba('+pr+',.4);color:'+p+';padding:10px 14px;border-radius:6px;font-size:12px;font-family:monospace;outline:none;transition:border-color .2s}' +
        '#cb-inp:focus{border-color:'+p+';box-shadow:0 0 8px rgba('+pr+',.2)}#cb-inp::placeholder{color:rgba('+pr+',.3)}' +
        '#cb-btn{background:transparent;color:'+p+';border:1px solid '+p+';border-radius:6px;padding:10px 16px;cursor:pointer;font-size:18px;line-height:1;transition:all .2s;text-shadow:0 0 6px '+p+'}' +
        '#cb-btn:hover{background:rgba('+pr+',.15);box-shadow:0 0 10px rgba('+pr+',.3)}',

      corporate:
        '#cb-bubble{position:fixed;bottom:24px;right:24px;width:52px;height:44px;background:'+p+';border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.2);z-index:9999;transition:opacity .2s}' +
        '#cb-bubble:hover{opacity:.9}' +
        '#cb-bubble svg{width:22px;height:22px;fill:#fff}' +
        '#cb-win{position:fixed;bottom:80px;right:24px;width:360px;height:520px;background:#fff;border:1px solid #d1d5db;border-radius:8px;display:none;flex-direction:column;z-index:9998;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.1)}' +
        '#cb-win.open{display:flex}' +
        '#cb-head{padding:14px 18px;background:'+p+';color:#fff;font:600 13px/1 "Segoe UI",sans-serif;display:flex;align-items:center;gap:10px}' +
        '#cb-head-dot{width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.7);animation:cb-pulse 2s infinite}' +
        '@keyframes cb-pulse{0%,100%{opacity:1}50%{opacity:.4}}' +
        '#cb-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:8px;font-family:"Segoe UI",sans-serif;background:#f8f9fa}' +
        '#cb-msgs::-webkit-scrollbar{width:4px}#cb-msgs::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:2px}' +
        '.cb-msg{max-width:80%;padding:9px 13px;font-size:13px;line-height:1.5}' +
        '.cb-bot{background:#fff;color:#374151;align-self:flex-start;border:1px solid #e5e7eb;border-radius:0 8px 8px 8px}' +
        '.cb-user{background:'+p+';color:#fff;align-self:flex-end;border-radius:8px 0 8px 8px}' +
        '.cb-typing{display:flex;gap:4px;align-items:center;padding:9px 13px}' +
        '.cb-typing span{width:5px;height:5px;border-radius:50%;background:#9ca3af;animation:cb-bounce .9s infinite}' +
        '.cb-typing span:nth-child(2){animation-delay:.15s}.cb-typing span:nth-child(3){animation-delay:.3s}' +
        '@keyframes cb-bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}' +
        '#cb-form{display:flex;padding:10px 12px;gap:8px;border-top:1px solid #e5e7eb;background:#fff}' +
        '#cb-inp{flex:1;background:#fff;border:1px solid #d1d5db;color:#111;padding:8px 12px;border-radius:4px;font-size:13px;outline:none;transition:border-color .2s}' +
        '#cb-inp:focus{border-color:'+p+'}#cb-inp::placeholder{color:#9ca3af}' +
        '#cb-btn{background:'+p+';color:#fff;border:none;border-radius:4px;padding:8px 14px;cursor:pointer;font-size:17px;line-height:1;transition:opacity .2s}' +
        '#cb-btn:hover{opacity:.9}',

      soft:
        '#cb-bubble{position:fixed;bottom:24px;right:24px;width:58px;height:58px;background:'+p+';border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 20px rgba('+pr+',.35),0 2px 6px rgba('+pr+',.2);z-index:9999;transition:transform .2s,box-shadow .2s}' +
        '#cb-bubble:hover{transform:scale(1.07);box-shadow:0 8px 28px rgba('+pr+',.5)}' +
        '#cb-bubble svg{width:26px;height:26px;fill:#fff}' +
        '#cb-win{position:fixed;bottom:100px;right:24px;width:360px;height:520px;background:#fffbff;border-radius:24px;display:none;flex-direction:column;z-index:9998;overflow:hidden;box-shadow:0 12px 40px rgba('+pr+',.15),0 4px 12px rgba(0,0,0,.05)}' +
        '#cb-win.open{display:flex}' +
        '#cb-head{padding:18px 20px;background:'+p+';color:#fff;font:600 14px/1 sans-serif;display:flex;align-items:center;gap:10px}' +
        '#cb-head-dot{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.85);animation:cb-pulse 2s infinite}' +
        '@keyframes cb-pulse{0%,100%{opacity:1}50%{opacity:.4}}' +
        '#cb-msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;font-family:sans-serif}' +
        '#cb-msgs::-webkit-scrollbar{width:4px}#cb-msgs::-webkit-scrollbar-thumb{background:rgba('+pr+',.2);border-radius:4px}' +
        '.cb-msg{max-width:82%;padding:11px 15px;border-radius:20px;font-size:13px;line-height:1.55}' +
        '.cb-bot{background:rgba('+pr+',.07);color:#3b1f60;align-self:flex-start;border-bottom-left-radius:6px}' +
        '.cb-user{background:'+p+';color:#fff;align-self:flex-end;border-bottom-right-radius:6px}' +
        '.cb-typing{display:flex;gap:4px;align-items:center;padding:11px 15px}' +
        '.cb-typing span{width:6px;height:6px;border-radius:50%;background:rgba('+pr+',.4);animation:cb-bounce .9s infinite}' +
        '.cb-typing span:nth-child(2){animation-delay:.15s}.cb-typing span:nth-child(3){animation-delay:.3s}' +
        '@keyframes cb-bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}' +
        '#cb-form{display:flex;padding:12px 14px;gap:8px;border-top:1px solid rgba('+pr+',.1);background:#fffbff}' +
        '#cb-inp{flex:1;background:rgba('+pr+',.06);border:2px solid transparent;color:#2d1b4e;padding:10px 15px;border-radius:20px;font-size:13px;outline:none;transition:border-color .2s,background .2s}' +
        '#cb-inp:focus{border-color:rgba('+pr+',.3);background:#fff}#cb-inp::placeholder{color:rgba('+pr+',.4)}' +
        '#cb-btn{background:'+p+';color:#fff;border:none;border-radius:50%;width:40px;height:40px;cursor:pointer;font-size:17px;flex-shrink:0;transition:transform .2s}' +
        '#cb-btn:hover{transform:scale(1.1)}',

      floating:
        '#cb-bubble{position:fixed;bottom:28px;right:28px;width:62px;height:62px;background:linear-gradient(135deg,'+p+','+s+');border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 32px rgba('+pr+',.5),0 2px 8px rgba(0,0,0,.2);z-index:9999;transition:transform .2s,box-shadow .2s}' +
        '#cb-bubble:hover{transform:scale(1.08) translateY(-2px);box-shadow:0 14px 42px rgba('+pr+',.6),0 4px 14px rgba(0,0,0,.25)}' +
        '#cb-bubble svg{width:28px;height:28px;fill:#fff}' +
        '#cb-win{position:fixed;bottom:110px;right:28px;width:400px;height:560px;background:#0f0f14;border:1px solid rgba(255,255,255,.07);border-radius:24px;display:none;flex-direction:column;z-index:9998;overflow:hidden;box-shadow:0 32px 80px rgba(0,0,0,.7),0 8px 24px rgba(0,0,0,.4)}' +
        '#cb-win.open{display:flex}' +
        '#cb-head{padding:20px 24px;background:linear-gradient(135deg,'+p+','+s+');color:#fff;font:600 15px/1 sans-serif;display:flex;align-items:center;gap:12px}' +
        '#cb-head-dot{width:9px;height:9px;border-radius:50%;background:#4ade80;animation:cb-pulse 2s infinite}' +
        '@keyframes cb-pulse{0%,100%{opacity:1}50%{opacity:.4}}' +
        '#cb-msgs{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:12px;font-family:sans-serif}' +
        '#cb-msgs::-webkit-scrollbar{width:4px}#cb-msgs::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:4px}' +
        '.cb-msg{max-width:80%;padding:12px 16px;border-radius:16px;font-size:14px;line-height:1.55}' +
        '.cb-bot{background:rgba(255,255,255,.07);color:rgba(255,255,255,.88);align-self:flex-start;border-bottom-left-radius:4px}' +
        '.cb-user{background:linear-gradient(135deg,'+p+','+s+');color:#fff;align-self:flex-end;border-bottom-right-radius:4px}' +
        '.cb-typing{display:flex;gap:5px;align-items:center;padding:12px 16px}' +
        '.cb-typing span{width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.35);animation:cb-bounce .9s infinite}' +
        '.cb-typing span:nth-child(2){animation-delay:.15s}.cb-typing span:nth-child(3){animation-delay:.3s}' +
        '@keyframes cb-bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-7px)}}' +
        '#cb-form{display:flex;padding:14px;gap:10px;border-top:1px solid rgba(255,255,255,.08)}' +
        '#cb-inp{flex:1;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);color:#fff;padding:12px 16px;border-radius:12px;font-size:14px;outline:none;transition:border-color .2s}' +
        '#cb-inp:focus{border-color:rgba('+pr+',.5)}#cb-inp::placeholder{color:rgba(255,255,255,.25)}' +
        '#cb-btn{background:linear-gradient(135deg,'+p+','+s+');color:#fff;border:none;border-radius:12px;padding:12px 18px;cursor:pointer;font-size:20px;line-height:1;transition:opacity .2s}' +
        '#cb-btn:hover{opacity:.85}',

      compact:
        '#cb-bubble{position:fixed;bottom:20px;right:20px;width:46px;height:46px;background:'+p+';border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 12px rgba('+pr+',.4);z-index:9999;transition:transform .15s}' +
        '#cb-bubble:hover{transform:scale(1.1)}' +
        '#cb-bubble svg{width:22px;height:22px;fill:#fff}' +
        '#cb-win{position:fixed;bottom:76px;right:20px;width:300px;height:440px;background:#1a1a2e;border:1px solid rgba(255,255,255,.08);border-radius:14px;display:none;flex-direction:column;z-index:9998;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.5)}' +
        '#cb-win.open{display:flex}' +
        '#cb-head{padding:12px 16px;background:'+p+';color:#fff;font:600 13px/1 sans-serif;display:flex;align-items:center;gap:8px}' +
        '#cb-head-dot{width:7px;height:7px;border-radius:50%;background:#4ade80;animation:cb-pulse 2s infinite}' +
        '@keyframes cb-pulse{0%,100%{opacity:1}50%{opacity:.4}}' +
        '#cb-msgs{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;font-family:sans-serif}' +
        '#cb-msgs::-webkit-scrollbar{width:3px}#cb-msgs::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:3px}' +
        '.cb-msg{max-width:85%;padding:8px 11px;border-radius:10px;font-size:12px;line-height:1.5}' +
        '.cb-bot{background:rgba(255,255,255,.07);color:rgba(255,255,255,.85);align-self:flex-start;border-bottom-left-radius:3px}' +
        '.cb-user{background:'+p+';color:#fff;align-self:flex-end;border-bottom-right-radius:3px}' +
        '.cb-typing{display:flex;gap:3px;align-items:center;padding:8px 11px}' +
        '.cb-typing span{width:5px;height:5px;border-radius:50%;background:rgba(255,255,255,.35);animation:cb-bounce .9s infinite}' +
        '.cb-typing span:nth-child(2){animation-delay:.15s}.cb-typing span:nth-child(3){animation-delay:.3s}' +
        '@keyframes cb-bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}' +
        '#cb-form{display:flex;padding:8px 10px;gap:6px;border-top:1px solid rgba(255,255,255,.06)}' +
        '#cb-inp{flex:1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);color:#fff;padding:8px 11px;border-radius:8px;font-size:12px;outline:none;transition:border-color .2s}' +
        '#cb-inp:focus{border-color:rgba('+pr+',.5)}#cb-inp::placeholder{color:rgba(255,255,255,.25)}' +
        '#cb-btn{background:'+p+';color:#fff;border:none;border-radius:8px;padding:8px 12px;cursor:pointer;font-size:16px;line-height:1;transition:opacity .2s}' +
        '#cb-btn:hover{opacity:.85}',

      retro:
        '#cb-bubble{position:fixed;bottom:24px;right:24px;width:56px;height:56px;background:'+p+';border:3px solid #000;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:4px 4px 0 #000;z-index:9999;transition:transform .1s,box-shadow .1s}' +
        '#cb-bubble:hover{transform:translate(-2px,-2px);box-shadow:6px 6px 0 #000}' +
        '#cb-bubble:active{transform:translate(2px,2px);box-shadow:2px 2px 0 #000}' +
        '#cb-bubble svg{width:24px;height:24px;fill:#fff}' +
        '#cb-win{position:fixed;bottom:100px;right:24px;width:360px;height:520px;background:#fffef0;border:3px solid #000;border-radius:8px;display:none;flex-direction:column;z-index:9998;overflow:hidden;box-shadow:6px 6px 0 #000}' +
        '#cb-win.open{display:flex}' +
        '#cb-head{padding:14px 18px;background:'+p+';border-bottom:3px solid #000;color:#000;font:800 14px/1 "Arial Black",sans-serif;display:flex;align-items:center;gap:10px}' +
        '#cb-head-dot{width:8px;height:8px;border-radius:50%;background:#000;animation:cb-pulse 2s infinite}' +
        '@keyframes cb-pulse{0%,100%{opacity:1}50%{opacity:.3}}' +
        '#cb-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;font-family:Arial,sans-serif;background:#fffef0}' +
        '#cb-msgs::-webkit-scrollbar{width:6px}#cb-msgs::-webkit-scrollbar-thumb{background:#000;border-radius:0}' +
        '.cb-msg{max-width:82%;padding:10px 13px;border-radius:4px;font-size:13px;line-height:1.5;border:2px solid #000}' +
        '.cb-bot{background:#fff;color:#000;align-self:flex-start;box-shadow:2px 2px 0 #000}' +
        '.cb-user{background:'+p+';color:#000;align-self:flex-end;font-weight:700;box-shadow:2px 2px 0 #000}' +
        '.cb-typing{display:flex;gap:4px;align-items:center;padding:10px 13px}' +
        '.cb-typing span{width:7px;height:7px;border-radius:0;background:#000;animation:cb-bounce .9s infinite}' +
        '.cb-typing span:nth-child(2){animation-delay:.15s}.cb-typing span:nth-child(3){animation-delay:.3s}' +
        '@keyframes cb-bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}' +
        '#cb-form{display:flex;padding:10px 12px;gap:8px;border-top:3px solid #000;background:#fffef0}' +
        '#cb-inp{flex:1;background:#fff;border:2px solid #000;color:#000;padding:9px 13px;border-radius:4px;font-size:13px;outline:none;transition:box-shadow .1s}' +
        '#cb-inp:focus{box-shadow:2px 2px 0 #000}#cb-inp::placeholder{color:#999}' +
        '#cb-btn{background:'+p+';color:#000;border:2px solid #000;border-radius:4px;padding:9px 15px;cursor:pointer;font-size:18px;font-weight:900;line-height:1;box-shadow:2px 2px 0 #000;transition:transform .1s,box-shadow .1s}' +
        '#cb-btn:hover{transform:translate(-1px,-1px);box-shadow:3px 3px 0 #000}' +
        '#cb-btn:active{transform:translate(1px,1px);box-shadow:1px 1px 0 #000}'
    };

    return themes[wStyle] || themes.bubble;
  }

  var styleEl = document.createElement('style');
  styleEl.textContent = buildCSS();
  document.head.appendChild(styleEl);

  var iconPaths = {
    chat:   '<path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>',
    dots:   '<path d="M12 2C6.48 2 2 6.48 2 12c0 2.95 1.38 5.56 3.54 7.36L4 22l3.66-1.5C8.93 21.44 10.42 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm-4 11.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>',
    single: '<path fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M12 2C6.48 2 2 6.48 2 12c0 2.95 1.38 5.56 3.54 7.36L4 22l3.66-1.5C8.93 21.44 10.42 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2z"/>',
    forum:  '<path fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M1 1h14v10H5l-4 5V1z M9 11h13v10H20l3 3L20 21H9V11z"/>',
    pair:   '<path d="M16 4C12 4 9 6.7 9 10c0 1.8.8 3.4 2.2 4.5l-.8 2.5 2.8-1.2c.8.3 1.8.4 2.8.4 4 0 7-2.7 7-6S20 4 16 4zM8 9C4 9 1 11.7 1 15c0 1.8.8 3.4 2.2 4.5l-.8 2.5 2.8-1.2c.8.3 1.8.4 2.8.4 4 0 7-2.7 7-6S12 9 8 9z"/>',
  };

  var bubble = document.createElement('div');
  bubble.id = 'cb-bubble';
  bubble.innerHTML = '<svg viewBox="0 0 24 24">' + (iconPaths[iconType] || iconPaths.chat) + '</svg>';
  document.body.appendChild(bubble);

  var win = document.createElement('div');
  win.id = 'cb-win';
  win.innerHTML = '<div id="cb-head"><div id="cb-head-dot"></div>' + botName + '</div><div id="cb-msgs"><div class="cb-msg cb-bot">¡Hola! ¿En qué puedo ayudarte hoy?</div></div><div id="cb-form"><input id="cb-inp" type="text" placeholder="Escribe un mensaje…"/><button id="cb-btn">➤</button></div>';
  document.body.appendChild(win);

  var msgs = win.querySelector('#cb-msgs');
  var inp = win.querySelector('#cb-inp');
  var btn = win.querySelector('#cb-btn');

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
      var r = await fetch('https://chatbot-builder-iota.vercel.app/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatbotId ? { chatbotId: chatbotId, message: text, sessionId: sessionId } : { webhookUrl: webhookUrl, message: text, sessionId: sessionId }),
      });
      var d = await r.json();
      t.className = 'cb-msg cb-bot';
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
