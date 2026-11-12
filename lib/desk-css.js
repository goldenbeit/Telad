// Styles for the team desk (lib/desk-ui.js), scoped inside its shadow root.
// Layout: one calm column (max 560px), sticky header + tabs, bottom sheets stacked one over another.
export const DESK_CSS = String.raw`
:host{display:block;
  --bg:#F6F2EA; --card:#FFFFFF; --ink:#15213B; --muted:#5D6578; --line:#E7DFD0; --soft:#F1ECE3;
  --gold:#F0A63A; --gold-bg:#FDF3E1;
  --ok:#2F6B47; --ok-bg:#E8F3EC; --warn:#8A5A0E; --warn-bg:#FDF0DA; --bad:#B4441F; --bad-bg:#FBE9E1; --blue:#22335A; --blue-bg:#E8EEF8;
  --fd:var(--font-display),Tahoma,sans-serif; --fb:var(--font-body),Tahoma,sans-serif;
  color-scheme:light;
}
*,*::before,*::after{box-sizing:border-box}
[hidden]{display:none!important}
.dkr{color:var(--ink);font-family:var(--fb);font-size:14.5px;line-height:1.55;direction:rtl;-webkit-tap-highlight-color:transparent;background:var(--bg);min-height:100vh}
button,input,select,textarea{font:inherit;color:inherit}
button{cursor:pointer;background:none;border:0;padding:0;text-align:inherit}
a{color:inherit}
:focus-visible{outline:2.5px solid var(--gold);outline-offset:2px}
h1,h2,h3,p{margin:0}
h1,h2,h3{font-family:var(--fd);font-weight:700;text-wrap:balance}
svg{fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.num{font-variant-numeric:tabular-nums}
.app{max-width:560px;margin:0 auto;padding-bottom:calc(24px + env(safe-area-inset-bottom,0px))}

/* header */
.hd{position:sticky;top:env(safe-area-inset-top,0px);z-index:5;background:var(--card);border-bottom:1px solid var(--line)}
.hd-in{display:flex;align-items:center;gap:8px;padding-block:10px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
.brand{font-family:var(--fd);font-size:22px;font-weight:700}
.me{flex:1;min-width:0;display:grid;line-height:1.3}
.me b{font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.me span{font-size:12px;color:var(--muted)}
.ib{position:relative;min-width:42px;height:42px;border-radius:12px;border:1.5px solid var(--line);display:grid;place-items:center;padding:0 8px;font-size:12.5px;font-weight:600}
.ib b{position:absolute;top:-6px;left:-6px;min-width:20px;height:20px;border-radius:99px;background:var(--bad);color:#FFFFFF;font-size:11px;display:grid;place-items:center;padding:0 5px}
.actas{display:flex;align-items:center;gap:8px;padding-block:6px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));background:var(--soft);font-size:12.5px;color:var(--muted)}
.actas.on{background:var(--gold-bg);color:var(--warn);font-weight:600}
.actas select{flex:1;min-width:0;min-height:38px;border:1.5px solid var(--line);border-radius:10px;background:var(--card);padding:0 8px;font-size:13.5px;font-weight:600;color:var(--ink)}
.tabs{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;padding-left:max(12px,env(safe-area-inset-left,0px));padding-right:max(12px,env(safe-area-inset-right,0px))}
.tab{flex:none;min-height:44px;padding:0 12px;font-weight:600;color:var(--muted);border-bottom:2.5px solid transparent;display:flex;align-items:center;gap:6px}
.tab.on{color:var(--ink);border-bottom-color:var(--gold)}
.tab i{font-style:normal;font-size:11.5px;background:var(--soft);border-radius:99px;padding:0 7px;color:var(--ink)}
.tab.on i{background:var(--ink);color:#FFFFFF}

/* page */
.pg{display:flex;flex-direction:column;gap:10px;padding-block:14px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
.flt{display:flex;gap:6px;flex-wrap:wrap}
.fc{min-height:36px;padding:0 13px;border-radius:99px;border:1.5px solid var(--line);background:var(--card);font-size:13px;font-weight:600}
.fc.on{background:var(--ink);border-color:var(--ink);color:#FFFFFF}
.empty{text-align:center;color:var(--muted);padding:36px 12px}
.sub{font-size:12.5px;color:var(--muted)}
.sec-t{font-size:14px;color:var(--muted);font-family:var(--fb);font-weight:600;margin-top:4px}

/* request card */
.rc{display:grid;gap:6px;width:100%;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 14px}
.rc:hover{border-color:#D6CAB3}
.rc.late{border-color:#EDBBA6}
.rc-top{display:flex;align-items:baseline;gap:8px}
.rc-top b{font-family:var(--fd);font-size:16px}
.code{margin-inline-start:auto;font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}
.chips{display:flex;gap:6px;flex-wrap:wrap}
.chip{display:inline-flex;align-items:center;gap:4px;border-radius:99px;padding:2px 9px;font-size:12px;font-weight:600;background:var(--soft);color:var(--ink);white-space:nowrap}
.c-me{background:var(--gold-bg);color:var(--warn)}
.c-ok{background:var(--ok-bg);color:var(--ok)} .c-warn{background:var(--warn-bg);color:var(--warn)} .c-bad{background:var(--bad-bg);color:var(--bad)} .c-blue{background:var(--blue-bg);color:var(--blue)}
.task{display:grid;gap:8px;background:var(--bad-bg);border:1px solid #EDBBA6;border-radius:14px;padding:12px 14px}

/* sheet */
.ov{position:fixed;inset:0;z-index:30;display:flex;align-items:flex-end;justify-content:center}
.scrim{position:absolute;inset:0;background:rgba(21,33,59,.42)}
.sheet{position:relative;width:100%;max-width:560px;max-height:calc(92% - env(safe-area-inset-top,0px));background:var(--card);border-radius:20px 20px 0 0;display:flex;flex-direction:column;animation:up .22s ease-out}
.sheet.lvl2{box-shadow:0 -10px 30px rgba(21,33,59,.18)}
.peek{position:absolute;inset:auto 0 100%;margin:0 auto 6px;width:calc(100% - 36px);max-width:520px;height:10px;border-radius:12px 12px 0 0;background:#E5DED2}
@keyframes up{from{transform:translateY(24px);opacity:.6}}
.sh-h{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid var(--line)}
.sh-h h2{flex:1;min-width:0;font-size:17px}
.x{width:40px;height:40px;border-radius:10px;display:grid;place-items:center;color:var(--muted)}
.x:hover{background:var(--soft)}
.sh-b{overflow-y:auto;overscroll-behavior:contain;padding-block:14px;display:flex;flex-direction:column;gap:14px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
.sh-f{border-top:1px solid var(--line);padding:10px 16px calc(10px + env(safe-area-inset-bottom,0px));display:flex;gap:8px}
.sh-f .btn{flex:1}
.btn{min-height:46px;border-radius:12px;border:1.5px solid var(--line);background:var(--card);font-family:var(--fd);font-weight:700;font-size:14.5px;display:inline-flex;align-items:center;justify-content:center;padding:0 12px;text-decoration:none}
.btn.pri{background:var(--gold);border-color:var(--gold)}
.btn.dark{background:var(--ink);border-color:var(--ink);color:#FFFFFF}
.btn.red{color:var(--bad)}
.btn.wa{background:#E9FBF0;border-color:#BDEFD0;color:#146C3A}
.sh-f .btn.ghost{flex:0 0 auto;color:var(--muted)}
.btn.sm{min-height:40px;font-size:13px}
.btn:disabled{opacity:.45;cursor:not-allowed}
.g2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}

.blk{display:grid;gap:8px}
.blk>h3{font-size:14px;color:var(--muted);font-family:var(--fb);font-weight:600}
.facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;background:var(--line);border:1px solid var(--line);border-radius:12px;overflow:hidden}
.facts div{background:var(--card);padding:8px 12px;display:grid;min-width:0}
.facts div.w{grid-column:1/-1}
.facts span{font-size:12px;color:var(--muted)} .facts b{font-variant-numeric:tabular-nums;overflow-wrap:anywhere;font-weight:600}
.photo{width:100%;max-width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:12px;background:var(--soft);display:block}

/* path stepper */
.path{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));position:relative}
.path::before{content:"";position:absolute;top:13px;right:12.5%;left:12.5%;height:2px;background:var(--line)}
.pn{position:relative;display:grid;justify-items:center;gap:3px;text-align:center;min-width:0}
.pn i{width:28px;height:28px;border-radius:50%;background:var(--card);border:2px solid var(--line);display:grid;place-items:center;font-style:normal;font-size:12px;font-weight:700;color:var(--muted)}
.pn b{font-size:12px} .pn span{font-size:11.5px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}
.pn.done i{background:var(--ink);border-color:var(--ink);color:#FFFFFF}
.pn.now i{background:var(--gold);border-color:var(--gold);color:var(--ink);box-shadow:0 0 0 4px var(--gold-bg)}
.pn.fyi i{border-style:dashed}
.dir{font-size:12.5px;color:var(--muted);text-align:center}

/* statuses */
.sts{display:grid;gap:6px}
.st{display:flex;align-items:center;gap:10px;min-height:44px;padding:6px 10px;border:1.5px solid var(--line);border-radius:12px;width:100%}
.st i{width:22px;height:22px;border-radius:7px;border:2px solid var(--line);display:grid;place-items:center;font-style:normal;font-size:13px;flex:none}
.st.on{border-color:#BFDCCB;background:var(--ok-bg)} .st.on i{background:var(--ok);border-color:var(--ok);color:#FFFFFF}
.st small{margin-inline-start:auto;font-size:11.5px;color:var(--muted);font-variant-numeric:tabular-nums}
.st:disabled{cursor:default}

/* log */
.log{display:grid}
.lg{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;padding:8px 0;border-bottom:1px dashed var(--line);width:100%}
.lg:last-child{border:0}
.lg::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--line);margin-top:8px;grid-row:span 3}
.lg.new::before{background:var(--bad)}
.lg b{font-weight:600} .lg time{font-size:11.5px;color:var(--muted)}
.lg q{display:block;quotes:none;background:var(--soft);border-radius:8px;padding:6px 10px;font-size:13.5px}
.lg q.instr{background:var(--gold-bg)}

/* forms */
.fld{display:grid;gap:6px}
.fld>span{font-size:13px;font-weight:600}
textarea,input[type=text],input[type=tel]{width:100%;border:1.5px solid var(--line);border-radius:12px;padding:10px 12px;background:var(--card);font-size:15px}
textarea{min-height:84px;resize:vertical}
.seg{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:4px;background:var(--soft);padding:4px;border-radius:12px}
.seg button{min-height:38px;border-radius:9px;font-size:13px;font-weight:600;color:var(--muted)}
.seg button.on{background:var(--card);color:var(--ink);box-shadow:0 1px 4px rgba(21,33,59,.1)}
.pick{display:grid;gap:6px}
.opt{display:flex;align-items:center;gap:10px;width:100%;min-height:52px;padding:8px 12px;border:1.5px solid var(--line);border-radius:12px}
.opt.on{border-color:var(--gold);background:var(--gold-bg)}
.opt .rd{width:20px;height:20px;border-radius:50%;border:2px solid var(--line);flex:none}
.opt.on .rd{border:6px solid var(--ink)}
.opt .tx{display:grid;flex:1;min-width:0} .opt .tx span{font-size:12.5px;color:var(--muted)}
.opt:disabled{opacity:.5;cursor:not-allowed}
.tag-s{font-size:11px;font-weight:700;background:var(--ok-bg);color:var(--ok);border-radius:99px;padding:1px 8px}

/* mirror + reports */
.team{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.team header{display:flex;align-items:baseline;gap:8px;padding:10px 14px;background:var(--soft)}
.team header b{font-family:var(--fd);font-size:15px}
.mr{display:flex;align-items:center;gap:10px;width:100%;padding:10px 14px;border-top:1px solid var(--line)}
.team header+.mr{border-top:0}
.av{width:34px;height:34px;border-radius:50%;background:var(--blue-bg);color:var(--blue);display:grid;place-items:center;font-weight:700;flex:none;position:relative}
.av.on::after,.av.off::after{content:"";position:absolute;bottom:-1px;left:-1px;width:11px;height:11px;border-radius:50%;border:2px solid var(--card)}
.av.on::after{background:#3AA167} .av.off::after{background:#B9B2A5}
.mr .nm{flex:1;min-width:0;display:grid} .mr .nm span{font-size:12px;color:var(--muted)}
.mr .ct{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
.tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.tl{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px;display:grid}
.tl b{font-family:var(--fd);font-size:22px;font-variant-numeric:tabular-nums}
.tl span{font-size:12px;color:var(--muted)}
.tl.bad b{color:var(--bad)} .tl.ok b{color:var(--ok)}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 14px;display:grid;gap:10px}
.card h3{font-size:15px}
.bar{display:grid;grid-template-columns:92px 1fr auto;gap:10px;align-items:center;font-size:13px}
.bar div{height:10px;border-radius:99px;background:var(--soft);overflow:hidden}
.bar div i{display:block;height:100%;background:var(--ink);border-radius:99px}
.bar b{font-variant-numeric:tabular-nums;font-size:12.5px;min-width:64px;text-align:left}
.tbl{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:13px;font-variant-numeric:tabular-nums}
th{font-weight:600;color:var(--muted);font-size:12px;text-align:right;padding:6px;border-bottom:1px solid var(--line);white-space:nowrap}
td{padding:9px 6px;border-bottom:1px solid var(--line);white-space:nowrap}
tbody tr:last-child td{border:0}
tbody tr{cursor:pointer} tbody tr:hover td{background:#FBF8F3}
td .r{font-size:11.5px;color:var(--muted);display:block}
.kv{display:grid;border:1px solid var(--line);border-radius:12px;overflow:hidden}
.kv div{display:flex;gap:8px;padding:9px 12px;border-top:1px solid var(--line);font-size:13.5px}
.kv div:first-child{border-top:0}
.kv span{color:var(--muted)} .kv b{margin-inline-start:auto;font-variant-numeric:tabular-nums;text-align:left}
.sw{display:flex;align-items:center;gap:10px;min-height:44px;padding:0 4px}
.tg{width:44px;height:26px;border-radius:99px;background:#CFC8BB;position:relative;flex:none;transition:background .15s}
.tg::after{content:"";position:absolute;top:3px;right:3px;width:20px;height:20px;border-radius:50%;background:#FFFFFF;transition:right .15s}
.tg.on{background:#3AA167} .tg.on::after{right:21px}

/* team admin */
.rch{display:flex;flex-wrap:wrap;gap:6px}
.rch button{border:1.5px solid var(--line);background:var(--card);border-radius:99px;padding:6px 12px;min-height:38px;font-size:13px}
.rch button.on{background:var(--ink);border-color:var(--ink);color:#FFFFFF}
.bigcode{font-family:var(--fd);font-size:40px;letter-spacing:6px;direction:ltr;text-align:center}

.toast{position:fixed;z-index:40;left:50%;transform:translateX(-50%);bottom:calc(20px + env(safe-area-inset-bottom,0px));width:min(520px,calc(100% - 32px));background:var(--ink);color:#FFFFFF;border-radius:14px;padding:12px 14px;font-size:13.5px;box-shadow:0 8px 24px rgba(21,33,59,.25)}
@media (max-width:380px){.tiles{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
`;
