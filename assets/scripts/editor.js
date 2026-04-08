import { toast, confirm, deny } from './message.js';
import { createExplorePanel, createShareModal } from './editorShare.js';
const DB_NAME='indicator-snippets';
const DB_VER=1;
const STORE='snippets';
function openDB(){
  return new Promise((res,rej)=>{
    const req=indexedDB.open(DB_NAME,DB_VER);
    req.onupgradeneeded=e=>{
      const db=e.target.result;
      if(!db.objectStoreNames.contains(STORE)){
        const s=db.createObjectStore(STORE,{keyPath:'id',autoIncrement:true});
        s.createIndex('name','name',{unique:false});
      }
    };
    req.onsuccess=e=>res(e.target.result);
    req.onerror=e=>rej(e.target.error);
  });
}
async function listSnippets(){
  const db=await openDB();
  return new Promise((res,rej)=>{
    const tx=db.transaction(STORE,'readonly');
    const req=tx.objectStore(STORE).getAll();
    req.onsuccess=e=>res(e.target.result||[]);
    req.onerror=e=>rej(e.target.error);
  });
}
async function saveSnippet(name,code){
  const db=await openDB();
  return new Promise((res,rej)=>{
    const tx=db.transaction(STORE,'readwrite');
    const req=tx.objectStore(STORE).add({name,code,updatedAt:Date.now()});
    req.onsuccess=e=>res(e.target.result);
    req.onerror=e=>rej(e.target.error);
  });
}
async function updateSnippet(id,name,code){
  const db=await openDB();
  return new Promise((res,rej)=>{
    const tx=db.transaction(STORE,'readwrite');
    const req=tx.objectStore(STORE).put({id,name,code,updatedAt:Date.now()});
    req.onsuccess=e=>res(e.target.result);
    req.onerror=e=>rej(e.target.error);
  });
}
async function deleteSnippet(id){
  const db=await openDB();
  return new Promise((res,rej)=>{
    const tx=db.transaction(STORE,'readwrite');
    const req=tx.objectStore(STORE).delete(id);
    req.onsuccess=()=>res();
    req.onerror=e=>rej(e.target.error);
  });
}
const HELP_CONTENT=`<div class="editor-help">
<h3>Indicator API</h3>
<p>Your script runs in a sandboxed context. Use the <code>bars</code> array and return series data to plot on the chart. Plotted values are exported with the chart.</p>
<h4>Available</h4>
<ul>
  <li><code>bars</code> — array of <code>{time, open, high, low, close, volume}</code></li>
  <li><code>plot(label, data, opts?)</code> — draw a line series. <code>data</code> is <code>[{time, value}]</code></li>
  <li><code>plotHist(label, data, opts?)</code> — draw a histogram</li>
  <li><code>plotBand(label, upper, lower, opts?)</code> — draw a band between two lines</li>
  <li><code>plotDot(label, data, opts?)</code> — draw points / particles</li>
  <li><code>plotArea(label, data, opts?)</code> — draw a filled area</li>
  <li><code>plotCandle(label, candles, opts?)</code> — draw synthetic candles</li>
  <li><code>buy(time, price?)</code> — record a long entry</li>
  <li><code>sell(time, price?)</code> — record an exit</li>
</ul>
<h4>Example — SMA</h4>
<pre>const period = 20;
const sma = bars.slice(period - 1).map((b, i) => {
  const slice = bars.slice(i, i + period);
  const avg = slice.reduce((s, c) => s + c.close, 0) / period;
  return { time: b.time, value: avg };
});
plot('SMA20', sma, { color: '#f59e0b', lineWidth: 2 });</pre>
<h4>Example — RSI</h4>
<pre>const period = 14;
let gains = 0, losses = 0;
for (let i = 1; i <= period; i++) {
  const d = bars[i].close - bars[i - 1].close;
  d >= 0 ? (gains += d) : (losses -= d);
}
let avgG = gains / period, avgL = losses / period;
const rsi = [];
for (let i = period + 1; i < bars.length; i++) {
  const d = bars[i].close - bars[i - 1].close;
  avgG = (avgG * (period - 1) + Math.max(d, 0)) / period;
  avgL = (avgL * (period - 1) + Math.max(-d, 0)) / period;
  const rs = avgL === 0 ? 100 : avgG / avgL;
  rsi.push({ time: bars[i].time, value: 100 - 100 / (1 + rs) });
}
plotHist('RSI14', rsi, { color: '#3b82f6' });</pre>
<h4>Example — Dots</h4>
<pre>const dots = bars.map((b, i) => ({
  time: b.time,
  value: i ? (b.close > bars[i - 1].close ? 1 : -1) : 0
}));
plotDot('Signals', dots, { color: '#22c55e' });</pre>
<h4>Example — Area</h4>
<pre>const area = bars.map((b, i) => ({
  time: b.time,
  value: i ? b.close - bars[i - 1].close : 0
}));
plotArea('Delta', area, { color: '#a78bfa' });</pre>
<h4>Example — Candles</h4>
<pre>const synthetic = bars.slice(1).map((b, i) => ({
  time: b.time,
  open: bars[i].close,
  high: Math.max(b.high, bars[i].close),
  low: Math.min(b.low, bars[i].close),
  close: b.close
}));
plotCandle('Synthetic', synthetic);</pre>
<h4>plot() opts</h4>
<pre>{ color: '#hex', lineWidth: 1|2|3, lineStyle: 0|1|2, pane: 0|1 }</pre>
<h4>Example — Strategy</h4>
<pre>bars.forEach((b,i)=>{
  if(i===0) return;
  if(b.close < bars[i - 1].close) buy(b.time);
  if(b.close > bars[i - 1].close) sell(b.time);
});</pre>
</div>`;
export class Editor{
  constructor(container,chart){
    this.el=container;
    this.chart=chart;
    this._code='';
    this._snippetId=null;
    this._snippetName='Untitled';
    this._showHelp=false;
    this._overlays=[];
    this._rendered=false;
    this._shareUi=null;
    this._exploreUi=null;
  }
  setHelpVisible(v){
    this._showHelp=v;
    if(this._rendered) this._updateHelpToggle();
  }
  clear(){
    this._clearOverlays(true);
  }
  _updateHelpToggle(){
    const edArea=this.el.querySelector('.ed-code-area');
    const helpArea=this.el.querySelector('.ed-help-area');
    const btn=this.el.querySelector('#ed-help-toggle');
    if(!edArea||!helpArea) return;
    if(this._showHelp){
      edArea.classList.add('hidden');
      helpArea.classList.remove('hidden');
      if(btn) btn.classList.add('active');
    }else{
      edArea.classList.remove('hidden');
      helpArea.classList.add('hidden');
      if(btn) btn.classList.remove('active');
    }
  }
  render(){
    this._rendered=true;
    this.el.innerHTML='';
    const toolbar=document.createElement('div');
    toolbar.className='ed-toolbar';
    toolbar.innerHTML=`
      <div class="ed-top-row">
        <input class="ed-name-in" id="ed-name" value="${this._snippetName}" placeholder="Snippet name">
        <button class="icon-btn ed-help-btn" id="ed-help-toggle" title="Help / Docs">?</button>
        <button class="btn-sm ed-share-btn" id="ed-share">Share</button>
        <button class="btn-sm ed-explore-btn" id="ed-explore">Explore</button>
      </div>
      <div class="ed-bottom-row">
        <select id="ed-snippets" class="ed-select"><option value="">— Load snippet —</option></select>
        <button class="btn-sm" id="ed-new">New</button>
        <button class="btn-sm" id="ed-save">Save</button>
        <button class="btn-sm danger" id="ed-delete">Del</button>
      </div>`;
    this.el.appendChild(toolbar);
    const helpArea=document.createElement('div');
    helpArea.className='ed-help-area hidden';
    helpArea.innerHTML=HELP_CONTENT;
    helpArea.querySelectorAll('pre').forEach(pre=>{
      const w=document.createElement('div');
      w.className='pre-wrap';
      pre.replaceWith(w);
      w.appendChild(pre);
      const b=document.createElement('button');
      b.className='pre-copy-btn';
      b.textContent='Copy';
      b.onclick=()=>navigator.clipboard.writeText(pre.textContent).then(()=>{b.textContent='✓';setTimeout(()=>{b.textContent='Copy'},1500)});
      w.appendChild(b);
    });
    this.el.appendChild(helpArea);
    const codeArea=document.createElement('div');
    codeArea.className='ed-code-area';
    const ta=document.createElement('textarea');
    ta.className='ed-textarea';
    ta.id='ed-code';
    ta.spellcheck=false;
    ta.value=this._code;
    ta.placeholder='// Write indicator logic here\n// Access: bars, plot(), plotHist(), plotBand()';
    codeArea.appendChild(ta);
    this.el.appendChild(codeArea);
    const runRow=document.createElement('div');
    runRow.className='ed-run-row';
    runRow.innerHTML=`<button class="btn-primary ed-run-btn" id="ed-run">▶ Run</button><button class="btn-sm" id="ed-clear">Clear</button>`;
    this.el.appendChild(runRow);
    this._shareUi=createShareModal({getSource:()=>document.querySelector('.tv-lightweight-charts,#chart-wrap')});
    this._exploreUi=createExplorePanel({onLoad:item=>this._loadSharedItem(item)});
    this.el.appendChild(this._shareUi.root);
    this.el.appendChild(this._exploreUi.root);
    this._populateSnippets();
    this._bindEvents(ta);
    this._updateHelpToggle();
  }
  _loadSharedItem(item){
    this._snippetId=null;
    this._snippetName=item.name||'Untitled';
    this._code=item.code||'';
    const ta=this.el.querySelector('#ed-code');
    const name=this.el.querySelector('#ed-name');
    const sel=this.el.querySelector('#ed-snippets');
    if(ta) ta.value=this._code;
    if(name) name.value=this._snippetName;
    if(sel) sel.value='';
    toast(item.description||item.name||'Untitled','info',6000);
  }
  async _populateSnippets(){
    const sel=this.el.querySelector('#ed-snippets');
    if(!sel) return;
    const items=await listSnippets().catch(()=>[]);
    sel.innerHTML='<option value="">— Load snippet —</option>';
    items.forEach(s=>{
      const o=document.createElement('option');
      o.value=s.id;
      o.textContent=s.name;
      if(s.id===this._snippetId) o.selected=true;
      sel.appendChild(o);
    });
  }
  _bindEvents(ta){
    ta.oninput=()=>{this._code=ta.value};
    ta.onkeydown=e=>{
      if(e.key==='Tab'){
        e.preventDefault();
        const s=ta.selectionStart,end=ta.selectionEnd;
        ta.value=ta.value.substring(0,s)+'  '+ta.value.substring(end);
        ta.selectionStart=ta.selectionEnd=s+2;
        this._code=ta.value;
      }
    };
    this.el.querySelector('#ed-name').oninput=e=>{this._snippetName=e.target.value};
    this.el.querySelector('#ed-help-toggle').onclick=()=>{this._showHelp=!this._showHelp;this._updateHelpToggle()};
    this.el.querySelector('#ed-share').onclick=()=>{this._shareUi.open({name:this._snippetName,code:this._code})};
    this.el.querySelector('#ed-explore').onclick=()=>{this._exploreUi.open()};
    this.el.querySelector('#ed-new').onclick=()=>{
      this._code='';this._snippetId=null;this._snippetName='Untitled';
      ta.value='';
      this.el.querySelector('#ed-name').value='Untitled';
      this.el.querySelector('#ed-snippets').value='';
    };
    this.el.querySelector('#ed-save').onclick=async()=>{
      const name=this._snippetName.trim()||'Untitled';
      try{
        if(this._snippetId){
          await updateSnippet(this._snippetId,name,this._code);
          toast('Snippet updated','success');
        }else{
          this._snippetId=await saveSnippet(name,this._code);
          toast('Snippet saved','success');
        }
        await this._populateSnippets();
      }catch(e){
        deny('Failed to save snippet: '+e.message);
      }
    };
    this.el.querySelector('#ed-delete').onclick=async()=>{
      if(!this._snippetId) return;
      const ok=await confirm(`Delete "${this._snippetName}"?`);
      if(!ok) return;
      try{
        await deleteSnippet(this._snippetId);
        this._snippetId=null;this._code='';this._snippetName='Untitled';
        ta.value='';
        this.el.querySelector('#ed-name').value='Untitled';
        await this._populateSnippets();
        toast('Snippet deleted','info');
      }catch(e){
        deny('Failed to delete snippet: '+e.message);
      }
    };
    this.el.querySelector('#ed-snippets').onchange=async e=>{
      const id=parseInt(e.target.value);
      if(!id) return;
      try{
        const db=await openDB();
        const tx=db.transaction(STORE,'readonly');
        const req=tx.objectStore(STORE).get(id);
        req.onsuccess=ev=>{
          const s=ev.target.result;
          if(!s) return;
          this._snippetId=s.id;
          this._snippetName=s.name;
          this._code=s.code;
          ta.value=s.code;
          this.el.querySelector('#ed-name').value=s.name;
          toast(`Loaded "${s.name}"`,'info');
        };
        req.onerror=()=>deny('Failed to load snippet');
      }catch(e){
        deny('Failed to load snippet: '+e.message);
      }
    };
    this.el.querySelector('#ed-run').onclick=()=>this._run();
    this.el.querySelector('#ed-clear').onclick=()=>this._clearOverlays();
  }
  _clearOverlays(silent=false){
    this._overlays.forEach(s=>{
      try{this.chart._chart.removeSeries(s)}catch(e){}
    });
    this._overlays=[];
    this.chart.clearIndicators();
    if(typeof this.chart.clearTrades==='function') this.chart.clearTrades();
    if(!silent) toast('Overlays cleared','info');
  }
  _run(){
    const bars=this.chart.getCurrentData();
    if(!bars.length){
      deny('No chart data available');
      return;
    }
    this._clearOverlays(true);
    const plotFns=[];
    const trades=[];
    const findBar=time=>bars.find(b=>b.time===time)||null;
    const normTrade=(type,time,price)=>{
      const bar=findBar(time);
      const px=price!=null?price:(bar?bar.close:null);
      if(time==null||px==null) return;
      trades.push({type,time,price:px});
    };
    const plot=(label,data,opts={})=>plotFns.push({type:'line',label,data,opts});
    const plotHist=(label,data,opts={})=>plotFns.push({type:'hist',label,data,opts});
    const plotBand=(label,upper,lower,opts={})=>plotFns.push({type:'band',label,upper,lower,opts});
    const plotDot=(label,data,opts={})=>plotFns.push({type:'dot',label,data,opts});
    const plotArea=(label,data,opts={})=>plotFns.push({type:'area',label,data,opts});
    const plotCandle=(label,data,opts={})=>plotFns.push({type:'candle',label,data,opts});
    const buy=(time,price)=>normTrade('buy',time,price);
    const sell=(time,price)=>normTrade('sell',time,price);
    try{
      const fn=new Function('bars','plot','plotHist','plotBand','plotDot','plotArea','plotCandle','buy','sell',this._code);
      fn(bars,plot,plotHist,plotBand,plotDot,plotArea,plotCandle,buy,sell);
    }catch(err){
      deny('Error: '+err.message);
      return;
    }
    this.chart.setIndicators(plotFns);
    if(typeof this.chart.setTrades==='function') this.chart.setTrades(trades);
    let count=0;
    plotFns.forEach(pf=>{
      try{
        if(pf.type==='line'){
          const s=this.chart._chart.addSeries(LightweightCharts.LineSeries,{
            color:pf.opts.color||'#a78bfa',
            lineWidth:pf.opts.lineWidth||2,
            lineStyle:pf.opts.lineStyle||0,
            title:pf.label
          },pf.opts.pane||0);
          s.setData(pf.data);
          this._overlays.push(s);
          count++;
        }else if(pf.type==='hist'){
          const s=this.chart._chart.addSeries(LightweightCharts.HistogramSeries,{
            color:pf.opts.color||'#3b82f6',
            title:pf.label
          },pf.opts.pane!=null?pf.opts.pane:1);
          s.setData(pf.data);
          this._overlays.push(s);
          count++;
        }else if(pf.type==='band'){
          const c=pf.opts.color||'#a78bfa';
          const su=this.chart._chart.addSeries(LightweightCharts.LineSeries,{color:c,lineWidth:1,title:pf.label+' U'},pf.opts.pane||0);
          const sl=this.chart._chart.addSeries(LightweightCharts.LineSeries,{color:c,lineWidth:1,title:pf.label+' L'},pf.opts.pane||0);
          su.setData(pf.upper);
          sl.setData(pf.lower);
          this._overlays.push(su,sl);
          count++;
        }else if(pf.type==='dot'){
          const s=this.chart._chart.addSeries(LightweightCharts.LineSeries,{
            color:pf.opts.color||'#f59e0b',
            lineVisible:false,
            pointMarkersVisible:true,
            lastValueVisible:false,
            priceLineVisible:false,
            crosshairMarkerVisible:false,
            title:pf.label
          },pf.opts.pane!=null?pf.opts.pane:1);
          s.setData(pf.data);
          this._overlays.push(s);
          count++;
        }else if(pf.type==='area'){
          const s=this.chart._chart.addSeries(LightweightCharts.AreaSeries,{
            lineColor:pf.opts.color||'#a78bfa',
            topColor:pf.opts.topColor||'rgba(167,139,250,0.35)',
            bottomColor:pf.opts.bottomColor||'rgba(167,139,250,0.02)',
            lineWidth:pf.opts.lineWidth||2,
            title:pf.label
          },pf.opts.pane||0);
          s.setData(pf.data);
          this._overlays.push(s);
          count++;
        }else if(pf.type==='candle'){
          const s=this.chart._chart.addSeries(LightweightCharts.CandlestickSeries,{
            upColor:pf.opts.upColor||'#22c55e',
            downColor:pf.opts.downColor||'#ef4444',
            borderUpColor:pf.opts.upColor||'#22c55e',
            borderDownColor:pf.opts.downColor||'#ef4444',
            wickUpColor:pf.opts.upColor||'#22c55e',
            wickDownColor:pf.opts.downColor||'#ef4444',
            title:pf.label
          },pf.opts.pane||0);
          s.setData(pf.data);
          this._overlays.push(s);
          count++;
        }
      }catch(e){
        deny('Plot error ('+pf.label+'): '+e.message);
      }
    });
    if(count>0) toast(`Plotted ${count} series`,'success');
    if(trades.length) toast(`Recorded ${trades.length} trades`,'success');
  }
}