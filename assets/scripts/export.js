export class Exporter {
  constructor(chart) {
    this._chart = chart;
    this.timeFmt = 'unix';
    this.timezone = 'UTC';
  }
  _getData() {
    return this._chart.getCurrentData();
  }
  _cols() {
    if (this._chart.mode === 'line') return ['time', this._chart.field];
    return ['time', 'open', 'high', 'low', 'close', 'volume'];
  }
  _formatTime(unix) {
    if (this.timeFmt === 'iso') {
        return new Date(unix * 1000).toLocaleString('sv-SE', {
        timeZone: this.timezone
        }).replace(' ', 'T');
    }
    if (this.timeFmt === 'datetime') {
        return new Date(unix * 1000).toLocaleString('en-US', {
        timeZone: this.timezone,
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit', second: '2-digit'
        });
    }
    return unix;
  }
  _row(r, cols) {
    return cols.map(c => c === 'time' ? this._formatTime(r.time) : (r[c] ?? ''));
  }
  _filename(ext) {
    const sym = this._chart.currentSymbol || 'data';
    const int = this._chart.currentInterval || '';
    return `${sym}_${int}.${ext}`;
  }
  _download(content, filename, mime) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type: mime }));
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  exportCSV() {
    const rows = this._getData();
    if (!rows.length) return;
    const cols = this._cols();
    const body = rows.map(r => this._row(r, cols).join(',')).join('\n');
    this._download(cols.join(',') + '\n' + body, this._filename('csv'), 'text/csv');
  }
  exportJSON() {
    const cols = this._cols();
    const rows = this._getData().map(r => Object.fromEntries(cols.map(c => [c, c === 'time' ? this._formatTime(r.time) : (r[c] ?? null)])));
    this._download(JSON.stringify(rows, null, 2), this._filename('json'), 'application/json');
  }
  exportTXT() {
    const rows = this._getData();
    if (!rows.length) return;
    const cols = this._cols();
    const lines = rows.map(r => this._row(r, cols).join('\t'));
    this._download(cols.join('\t') + '\n' + lines.join('\n'), this._filename('txt'), 'text/plain');
  }
  showTable() {
    const rows = this._getData();
    const cols = this._cols();
    const overlay = document.createElement('div');
    overlay.id = 'export-table-overlay';
    const thead = cols.map(c => `<th>${c}</th>`).join('');
    const tbody = rows.map(r =>
      `<tr>${this._row(r, cols).map(v => `<td>${v}</td>`).join('')}</tr>`
    ).join('');
    overlay.innerHTML = `
      <div id="export-table-wrap">
        <div id="export-table-toolbar">
          <span id="export-table-title">${this._chart.currentSymbol} ${this._chart.currentInterval} — ${rows.length} bars</span>
          <div id="export-table-actions">
            <button id="export-copy-btn">Copy</button>
            <button id="export-close-btn">✕</button>
          </div>
        </div>
        <div id="export-table-scroll">
          <table id="export-table">
            <thead><tr>${thead}</tr></thead>
            <tbody>${tbody}</tbody>
          </table>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#export-close-btn').onclick = () => overlay.remove();
    overlay.querySelector('#export-copy-btn').onclick = () => {
      const tsv = [cols.join('\t'), ...rows.map(r => this._row(r, cols).join('\t'))].join('\n');
      navigator.clipboard.writeText(tsv).then(() => {
        const btn = overlay.querySelector('#export-copy-btn');
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
      });
    };
  }
}