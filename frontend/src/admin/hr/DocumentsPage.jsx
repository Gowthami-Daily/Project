import { theadRow, tableScroll, tableWrap } from './tableStyles.js'

const rows = [
  { staff: 'Raju K.', docType: 'Driving license', id: 'DL-KA-2019-88421', expiry: '12 Aug 2027', stored: 'Vault' },
  { staff: 'Sridevi M.', docType: 'Lab certification', id: 'FSSAI-TR-4421', expiry: '01 Jan 2028', stored: 'Vault' },
  { staff: 'Ramesh Kumar', docType: 'Aadhaar (masked)', id: 'XXXX-XXXX-1024', expiry: '—', stored: 'Encrypted' },
  { staff: 'Lakshmi P.', docType: 'PAN', id: 'ABCDE1234F', expiry: '—', stored: 'Vault' },
  { staff: 'Anil Kumar', docType: 'Medical fitness', id: 'MF-2026-0092', expiry: '30 Jun 2026', stored: 'HR file' },
]

export default function DocumentsPage() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Aadhaar, licenses, contracts — store references only; files in secure object storage (<code className="rounded bg-slate-100 px-1">staff_documents</code>).
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="rounded-xl bg-[#004080] px-4 py-2 text-sm font-semibold text-white hover:bg-[#003366]">
          Upload document
        </button>
        <button type="button" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Expiry report
        </button>
      </div>
      <div className={tableWrap}>
        <div className={tableScroll}>
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className={theadRow}>
                <th className="px-4 py-3">Staff</th>
                <th className="px-4 py-3">Document type</th>
                <th className="px-4 py-3">Reference / ID</th>
                <th className="px-4 py-3">Expiry</th>
                <th className="px-4 py-3">Storage</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-medium">{r.staff}</td>
                  <td className="px-4 py-3 text-slate-700">{r.docType}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.id}</td>
                  <td className="px-4 py-3 text-slate-600">{r.expiry}</td>
                  <td className="px-4 py-3 text-slate-600">{r.stored}</td>
                  <td className="px-4 py-3">
                    <button type="button" className="text-sm font-semibold text-[#004080] hover:underline">
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
