import {
  BanknotesIcon,
  BuildingLibraryIcon,
  ChartBarIcon,
  ChartPieIcon,
  CreditCardIcon,
  HomeIcon,
  ReceiptPercentIcon,
  TableCellsIcon,
  WalletIcon,
} from '@heroicons/react/24/solid'
import { NavLink } from 'react-router-dom'

const linkBase =
  'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition sm:gap-2.5 sm:px-3.5 sm:py-2.5'
const inactive = 'text-slate-600 hover:bg-sky-50/90'
const active = 'bg-[#004080]/10 text-[#004080]'

function Item({ to, end, icon: Icon, children }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `${linkBase} ${isActive ? active : inactive}`}
    >
      <Icon className="h-5 w-5 shrink-0 opacity-90" />
      <span>{children}</span>
    </NavLink>
  )
}

export default function PfSidebar() {
  return (
    <aside className="shrink-0 border-b border-sky-200/60 bg-white/90 md:w-56 md:border-b-0 md:border-r md:bg-white/95">
      <nav className="flex gap-1 overflow-x-auto px-2 py-3 md:flex-col md:gap-0.5 md:px-3 md:py-4" aria-label="Personal finance">
        <Item to="/personal-finance" end icon={HomeIcon}>
          Dashboard
        </Item>
        <Item to="/personal-finance/monthly-statements" icon={TableCellsIcon}>
          Financial statement
        </Item>
        <Item to="/personal-finance/accounts" icon={WalletIcon}>
          Accounts
        </Item>
        <Item to="/personal-finance/income" icon={BanknotesIcon}>
          Income
        </Item>
        <Item to="/personal-finance/expenses" icon={CreditCardIcon}>
          Expenses
        </Item>
        <Item to="/personal-finance/reports" icon={ChartBarIcon}>
          Reports
        </Item>
        <Item to="/personal-finance/investments" icon={ChartPieIcon}>
          Investments
        </Item>
        <Item to="/personal-finance/assets" icon={BuildingLibraryIcon}>
          Fixed assets
        </Item>
        <Item to="/personal-finance/liabilities" icon={ReceiptPercentIcon}>
          Liabilities
        </Item>
        <Item to="/personal-finance/loans" icon={CreditCardIcon}>
          Loans
        </Item>
      </nav>
    </aside>
  )
}
