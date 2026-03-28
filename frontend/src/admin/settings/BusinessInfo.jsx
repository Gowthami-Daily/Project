const input =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-[#004080] focus:outline-none focus:ring-2 focus:ring-[#004080]/20'
const label = 'block text-xs font-bold uppercase tracking-wide text-slate-500'

export default function BusinessInfo() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Business information</h3>
        <p className="mt-1 text-sm text-slate-600">
          Legal and branding details used on invoices, SMS, and customer communications.
        </p>
      </div>

      <form
        className="max-w-2xl space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
        }}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={label}>Trade / display name</label>
            <input type="text" name="tradeName" defaultValue="Gowthami Daily" className={input} />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Legal registered name</label>
            <input type="text" name="legalName" defaultValue="Gowthami Daily Dairy Pvt. Ltd." className={input} />
          </div>
          <div>
            <label className={label}>GSTIN</label>
            <input type="text" name="gstin" defaultValue="29ABCDE1234F1Z5" className={`${input} font-mono`} />
          </div>
          <div>
            <label className={label}>PAN</label>
            <input type="text" name="pan" defaultValue="ABCDE1234F" className={`${input} font-mono`} />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Registered address</label>
            <textarea name="address" rows={3} defaultValue="Hub & collection desk, Bengaluru Urban, Karnataka — 560001" className={input} />
          </div>
          <div>
            <label className={label}>Support phone</label>
            <input type="tel" name="phone" defaultValue="+91 98765 43210" className={input} />
          </div>
          <div>
            <label className={label}>Billing email</label>
            <input type="email" name="email" defaultValue="accounts@gowthamidaily.example" className={input} />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Logo</label>
            <div className="mt-1.5 flex flex-wrap items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400">
                GD
              </div>
              <button
                type="button"
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Upload image
              </button>
              <span className="text-xs text-slate-500">PNG or SVG, max 2 MB</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-6">
          <button
            type="submit"
            className="rounded-xl bg-[#004080] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#003366]"
          >
            Save changes
          </button>
          <button type="button" className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Reset
          </button>
        </div>
      </form>
    </div>
  )
}
