export interface ReceiptOrder {
  id: string
  productName: string
  amount: string | number
  status: string
  paymentRef?: string | null
  createdAt: string
  userId?: string
}

function dt(iso: string): string {
  const d = new Date(iso)
  return (
    d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  )
}

export function printReceipt(o: ReceiptOrder): void {
  const w = window.open('', '_blank')
  if (!w) return
  const no = o.id.slice(0, 8).toUpperCase()
  const amt = 'Rp ' + Number(o.amount).toLocaleString('id-ID')
  const customerRow = o.userId
    ? `<div><span>PELANGGAN</span><b>${o.userId.slice(0, 8).toUpperCase()}</b></div>`
    : ''
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Struk ${no}</title><style>*{box-sizing:border-box}body{margin:0;background:#f4f4f5;color:#18181b;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px}.wrap{max-width:520px;margin:32px auto;background:#fff;border:1px solid #e4e4e7}.band{background:#18181b;color:#fff;padding:20px 24px;display:flex;justify-content:space-between;align-items:center}.band h1{margin:0;font-size:20px;letter-spacing:.08em}.band .sub{font-size:11px;color:#C5FE37;letter-spacing:.2em;margin-top:4px}.band .no{text-align:right;font-size:12px}.band .no b{font-size:15px}.body{padding:20px 24px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;margin-bottom:16px}.meta div span{display:block;font-size:10px;color:#71717a;letter-spacing:.08em}.meta div b{font-size:13px}table{width:100%;border-collapse:collapse;margin-top:8px}th{font-size:10px;letter-spacing:.12em;color:#71717a;text-align:left;padding:8px 0;border-bottom:2px solid #18181b}td{padding:10px 0;border-bottom:1px dashed #d4d4d8}.r{text-align:right}.total td{border-bottom:none;border-top:2px solid #18181b;font-weight:700;font-size:15px;padding-top:12px}.foot{padding:16px 24px 24px;text-align:center;font-size:11px;color:#71717a}@media print{body{background:#fff}.wrap{margin:0;max-width:none;border:none}}</style></head><body><div class="wrap"><div class="band"><div><h1>ST.ZEN</h1><div class="sub">STRUK PEMBAYARAN</div></div><div class="no">No<br><b>${no}</b></div></div><div class="body"><div class="meta"><div><span>TANGGAL</span><b>${dt(o.createdAt)}</b></div><div><span>STATUS</span><b>${o.status}</b></div>${customerRow}<div><span>REF</span><b>${o.paymentRef ?? '-'}</b></div></div><table><thead><tr><th>DESKRIPSI</th><th class="r">HARGA</th></tr></thead><tbody><tr><td>${o.productName}</td><td class="r">${amt}</td></tr><tr class="total"><td>TOTAL</td><td class="r">${amt}</td></tr></tbody></table></div><div class="foot">Simpan struk ini sebagai bukti pembayaran<br>Dicetak ${dt(new Date().toISOString())}</div></div><script>window.onload=function(){window.print()}<\/script></body></html>`
  w.document.open()
  w.document.write(html)
  w.document.close()
  w.focus()
}
