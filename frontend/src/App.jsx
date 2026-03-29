import { lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AdminLayout from './admin/AdminLayout.jsx'
import DashboardPage from './admin/DashboardPage.jsx'
import AdvancesFinancePage from './admin/finance/AdvancesFinancePage.jsx'
import BalanceSheetPage from './admin/finance/BalanceSheetPage.jsx'
import CashFlowPage from './admin/finance/CashFlowPage.jsx'
import CustomerWalletPage from './admin/finance/CustomerWalletPage.jsx'
import FinanceDashboard from './admin/finance/FinanceDashboard.jsx'
import FinanceExpensesPage from './admin/finance/FinanceExpensesPage.jsx'
import FinanceLayout from './admin/finance/FinanceLayout.jsx'
import FinancePLPage from './admin/finance/FinancePLPage.jsx'
import FinanceReportsPage from './admin/finance/FinanceReportsPage.jsx'
import FarmerLedgerPage from './admin/finance/FarmerLedgerPage.jsx'
import IncomePage from './admin/finance/IncomePage.jsx'
import PaymentsPage from './admin/finance/PaymentsPage.jsx'
import DispatchDashboard from './admin/dispatch/DispatchDashboard.jsx'
import DispatchEntryPage from './admin/dispatch/DispatchEntryPage.jsx'
import DispatchLayout from './admin/dispatch/DispatchLayout.jsx'
import DispatchReportsPage from './admin/dispatch/DispatchReportsPage.jsx'
import DispatchSchedulePage from './admin/dispatch/DispatchSchedulePage.jsx'
import LiveTrackingPage from './admin/dispatch/LiveTrackingPage.jsx'
import MissedDeliveriesPage from './admin/dispatch/MissedDeliveriesPage.jsx'
import ProofOfDeliveryPage from './admin/dispatch/ProofOfDeliveryPage.jsx'
import ReturnsSpoilagePage from './admin/dispatch/ReturnsSpoilagePage.jsx'
import RoutePlanningPage from './admin/dispatch/RoutePlanningPage.jsx'
import CratesPage from './admin/outflow/CratesPage.jsx'
import CrmPage from './admin/outflow/CrmPage.jsx'
import DispatchBoardPage from './admin/outflow/DispatchBoardPage.jsx'
import ExceptionsPage from './admin/outflow/ExceptionsPage.jsx'
import FleetPage from './admin/outflow/FleetPage.jsx'
import BusinessInfo from './admin/settings/BusinessInfo.jsx'
import MilkRateChart from './admin/settings/MilkRateChart.jsx'
import Notifications from './admin/settings/Notifications.jsx'
import ProductPricing from './admin/settings/ProductPricing.jsx'
import RoutesSettings from './admin/settings/Routes.jsx'
import SettingsLayout from './admin/settings/SettingsLayout.jsx'
import SystemConfig from './admin/settings/SystemConfig.jsx'
import UserRoles from './admin/settings/UserRoles.jsx'
import CentersPage from './admin/inflow/CentersPage.jsx'
import FarmerManagementPage from './admin/inflow/FarmerManagementPage.jsx'
import InflowDashboard from './admin/inflow/InflowDashboard.jsx'
import InflowLayout from './admin/inflow/InflowLayout.jsx'
import InflowQualityPage from './admin/inflow/InflowQualityPage.jsx'
import InflowReportsPage from './admin/inflow/InflowReportsPage.jsx'
import LabPage from './admin/inflow/LabPage.jsx'
import MilkCollectionEntryPage from './admin/inflow/MilkCollectionEntryPage.jsx'
import MilkTransferPage from './admin/inflow/MilkTransferPage.jsx'
import TanksPage from './admin/inflow/TanksPage.jsx'
import MarketingSite from './pages/MarketingSite.jsx'
import AssetsLayout from './admin/assets/AssetsLayout.jsx'
import AssetsTanksPage from './admin/assets/AssetsTanksPage.jsx'
import FuelLogsPage from './admin/assets/FuelLogsPage.jsx'
import MachineryPage from './admin/assets/MachineryPage.jsx'
import MaintenancePage from './admin/assets/MaintenancePage.jsx'
import ServiceSchedulePage from './admin/assets/ServiceSchedulePage.jsx'
import VehiclesPage from './admin/assets/VehiclesPage.jsx'
import AdvancesPage from './admin/hr/AdvancesPage.jsx'
import AttendancePage from './admin/hr/AttendancePage.jsx'
import DocumentsPage from './admin/hr/DocumentsPage.jsx'
import HrDashboard from './admin/hr/HrDashboard.jsx'
import HrLayout from './admin/hr/HrLayout.jsx'
import LeavesPage from './admin/hr/LeavesPage.jsx'
import PayrollPage from './admin/hr/PayrollPage.jsx'
import RolesPermissionsPage from './admin/hr/RolesPermissionsPage.jsx'
import ShiftsPage from './admin/hr/ShiftsPage.jsx'
import StaffDirectory from './admin/hr/StaffDirectory.jsx'
import StaffProfile from './admin/hr/StaffProfile.jsx'
import ComplaintsPage from './admin/customers/ComplaintsPage.jsx'
import CrmWalletPage from './admin/customers/CrmWalletPage.jsx'
import CustomerDirectory from './admin/customers/CustomerDirectory.jsx'
import CustomerNotificationsPage from './admin/customers/CustomerNotificationsPage.jsx'
import CustomerProfile from './admin/customers/CustomerProfile.jsx'
import CustomerReportsPage from './admin/customers/CustomerReportsPage.jsx'
import CustomersDashboard from './admin/customers/CustomersDashboard.jsx'
import CustomersLayout from './admin/customers/CustomersLayout.jsx'
import DeliverySchedulePage from './admin/customers/DeliverySchedulePage.jsx'
import MicroOrdersPage from './admin/customers/MicroOrdersPage.jsx'
import SubscriptionsPage from './admin/customers/SubscriptionsPage.jsx'
import InventoryDashboard from './admin/inventory/InventoryDashboard.jsx'
import InventoryLayout from './admin/inventory/InventoryLayout.jsx'
import InventoryReportsPage from './admin/inventory/InventoryReportsPage.jsx'
import InventorySpoilagePage from './admin/inventory/InventorySpoilagePage.jsx'
import InventoryTransactionsPage from './admin/inventory/InventoryTransactionsPage.jsx'
import MilkTanksPage from './admin/inventory/MilkTanksPage.jsx'
import ProcessingWipPage from './admin/inventory/ProcessingWipPage.jsx'
import ProductStockPage from './admin/inventory/ProductStockPage.jsx'
import StockAdjustmentPage from './admin/inventory/StockAdjustmentPage.jsx'
import StockTransferPage from './admin/inventory/StockTransferPage.jsx'
import BatchTrackingPage from './admin/production/BatchTrackingPage.jsx'
import PackedInventoryPage from './admin/production/PackedInventoryPage.jsx'
import PackingPage from './admin/production/PackingPage.jsx'
import PasteurizationPage from './admin/production/PasteurizationPage.jsx'
import ProductionDashboard from './admin/production/ProductionDashboard.jsx'
import ProductionLayout from './admin/production/ProductionLayout.jsx'
import ProductionLossPage from './admin/production/ProductionLossPage.jsx'
import ProductionReportsPage from './admin/production/ProductionReportsPage.jsx'
import AnimalExpensesPage from './admin/cattle/AnimalExpensesPage.jsx'
import AnimalRegisterPage from './admin/cattle/AnimalRegisterPage.jsx'
import BreedingPage from './admin/cattle/BreedingPage.jsx'
import CattleDashboard from './admin/cattle/CattleDashboard.jsx'
import CattleLayout from './admin/cattle/CattleLayout.jsx'
import CattleReportsPage from './admin/cattle/CattleReportsPage.jsx'
import FarmExpensesPage from './admin/cattle/FarmExpensesPage.jsx'
import FeedInventoryPage from './admin/cattle/FeedInventoryPage.jsx'
import FeedManagementPage from './admin/cattle/FeedManagementPage.jsx'
import HealthDoctorPage from './admin/cattle/HealthDoctorPage.jsx'
import MilkYieldPage from './admin/cattle/MilkYieldPage.jsx'
import ProfitReportPage from './admin/cattle/ProfitReportPage.jsx'
import VaccinationPage from './admin/cattle/VaccinationPage.jsx'
import ModulePlaceholder from './admin/ModulePlaceholder.jsx'
import PersonalFinanceShell from './admin/personalFinance/PersonalFinanceShell.jsx'
import SuperAdminApp from './admin/superAdmin/SuperAdminApp.jsx'

const PersonalFinanceDashboardPage = lazy(() => import('./admin/personalFinance/PersonalFinanceDashboardPage.jsx'))

const PfAccountsPage = lazy(() => import('./admin/personalFinance/pfPages/PfAccountsPage.jsx'))
const PfAssetsPage = lazy(() => import('./admin/personalFinance/pfPages/PfAssetsPage.jsx'))
const PfExpensesPage = lazy(() => import('./admin/personalFinance/pfPages/PfExpensesPage.jsx'))
const PfIncomePage = lazy(() => import('./admin/personalFinance/pfPages/PfIncomePage.jsx'))
const PfInvestmentsPage = lazy(() => import('./admin/personalFinance/pfPages/PfInvestmentsPage.jsx'))
const PfLiabilitiesPage = lazy(() => import('./admin/personalFinance/pfPages/PfLiabilitiesPage.jsx'))
const PfLoansPage = lazy(() => import('./admin/personalFinance/pfPages/PfLoansPage.jsx'))
const PfMonthlyStatementsPage = lazy(() => import('./admin/personalFinance/pfPages/PfMonthlyStatementsPage.jsx'))
const PfReportsHubPage = lazy(() => import('./admin/personalFinance/pfPages/PfReportsHubPage.jsx'))
const PfMorePage = lazy(() => import('./admin/personalFinance/PfMorePage.jsx'))
const PfSettingsPage = lazy(() => import('./admin/personalFinance/PfSettingsPage.jsx'))

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MarketingSite />} />
        <Route path="/personal-finance/*" element={<PersonalFinanceShell />}>
          <Route index element={<PersonalFinanceDashboardPage />} />
          <Route path="monthly-statements" element={<PfMonthlyStatementsPage />} />
          <Route path="accounts" element={<PfAccountsPage />} />
          <Route path="income" element={<PfIncomePage />} />
          <Route path="expenses" element={<PfExpensesPage />} />
          <Route path="investments" element={<PfInvestmentsPage />} />
          <Route path="assets" element={<PfAssetsPage />} />
          <Route path="liabilities" element={<PfLiabilitiesPage />} />
          <Route path="loans" element={<PfLoansPage />} />
          <Route path="reports" element={<PfReportsHubPage />} />
          <Route path="more" element={<PfMorePage />} />
          <Route path="settings" element={<PfSettingsPage />} />
        </Route>
        <Route path="/admin/personal-finance" element={<Navigate to="/personal-finance" replace />} />
        <Route path="/super-admin/*" element={<SuperAdminApp />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="cattle" element={<CattleLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<CattleDashboard />} />
            <Route path="animals" element={<AnimalRegisterPage />} />
            <Route path="milk" element={<MilkYieldPage />} />
            <Route path="feed" element={<FeedManagementPage />} />
            <Route path="feed-inventory" element={<FeedInventoryPage />} />
            <Route path="health" element={<HealthDoctorPage />} />
            <Route path="vaccination" element={<VaccinationPage />} />
            <Route path="breeding" element={<BreedingPage />} />
            <Route path="expenses" element={<AnimalExpensesPage />} />
            <Route path="farm-expenses" element={<FarmExpensesPage />} />
            <Route path="profit" element={<ProfitReportPage />} />
            <Route path="reports" element={<CattleReportsPage />} />
          </Route>
          <Route path="inflow" element={<InflowLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<InflowDashboard />} />
            <Route path="farmers" element={<FarmerManagementPage />} />
            <Route path="collection" element={<MilkCollectionEntryPage />} />
            <Route path="quality" element={<InflowQualityPage />} />
            <Route path="transfer" element={<MilkTransferPage />} />
            <Route path="reports" element={<InflowReportsPage />} />
            <Route path="lab" element={<LabPage />} />
            <Route path="centers" element={<CentersPage />} />
            <Route path="tanks" element={<TanksPage />} />
          </Route>
          <Route path="production" element={<ProductionLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<ProductionDashboard />} />
            <Route path="pasteurization" element={<PasteurizationPage />} />
            <Route path="packing" element={<PackingPage />} />
            <Route path="packed" element={<PackedInventoryPage />} />
            <Route path="loss" element={<ProductionLossPage />} />
            <Route path="tracking" element={<BatchTrackingPage />} />
            <Route path="reports" element={<ProductionReportsPage />} />
          </Route>
          <Route path="inventory" element={<InventoryLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<InventoryDashboard />} />
            <Route path="tanks" element={<MilkTanksPage />} />
            <Route path="processing" element={<ProcessingWipPage />} />
            <Route path="products" element={<ProductStockPage />} />
            <Route path="transactions" element={<InventoryTransactionsPage />} />
            <Route path="spoilage" element={<InventorySpoilagePage />} />
            <Route path="adjustments" element={<StockAdjustmentPage />} />
            <Route path="transfers" element={<StockTransferPage />} />
            <Route path="reports" element={<InventoryReportsPage />} />
          </Route>
          <Route path="customers" element={<CustomersLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<CustomersDashboard />} />
            <Route path="directory" element={<CustomerDirectory />} />
            <Route path="directory/:customerId" element={<CustomerProfile />} />
            <Route path="subscriptions" element={<SubscriptionsPage />} />
            <Route path="wallet" element={<CrmWalletPage />} />
            <Route path="orders" element={<MicroOrdersPage />} />
            <Route path="delivery" element={<DeliverySchedulePage />} />
            <Route path="complaints" element={<ComplaintsPage />} />
            <Route path="notifications" element={<CustomerNotificationsPage />} />
            <Route path="reports" element={<CustomerReportsPage />} />
          </Route>
          <Route path="hr" element={<HrLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<HrDashboard />} />
            <Route path="staff" element={<StaffDirectory />} />
            <Route path="staff/:staffId" element={<StaffProfile />} />
            <Route path="attendance" element={<AttendancePage />} />
            <Route path="shifts" element={<ShiftsPage />} />
            <Route path="payroll" element={<PayrollPage />} />
            <Route path="advances" element={<AdvancesPage />} />
            <Route path="leaves" element={<LeavesPage />} />
            <Route path="roles" element={<RolesPermissionsPage />} />
            <Route path="documents" element={<DocumentsPage />} />
          </Route>
          <Route path="assets" element={<AssetsLayout />}>
            <Route index element={<Navigate to="vehicles" replace />} />
            <Route path="vehicles" element={<VehiclesPage />} />
            <Route path="maintenance" element={<MaintenancePage />} />
            <Route path="fuel" element={<FuelLogsPage />} />
            <Route path="machinery" element={<MachineryPage />} />
            <Route path="tanks" element={<AssetsTanksPage />} />
            <Route path="schedule" element={<ServiceSchedulePage />} />
          </Route>
          <Route path="reports" element={<ModulePlaceholder title="Reports" description="Exports, scheduled reports, and analytics." />} />
          <Route path="outflow" element={<DispatchLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DispatchDashboard />} />
            <Route path="routes" element={<RoutePlanningPage />} />
            <Route path="schedule" element={<DispatchSchedulePage />} />
            <Route path="entry" element={<DispatchEntryPage />} />
            <Route path="tracking" element={<LiveTrackingPage />} />
            <Route path="proof" element={<ProofOfDeliveryPage />} />
            <Route path="missed" element={<MissedDeliveriesPage />} />
            <Route path="returns" element={<ReturnsSpoilagePage />} />
            <Route path="reports" element={<DispatchReportsPage />} />
            <Route path="board" element={<DispatchBoardPage />} />
            <Route path="dispatch" element={<Navigate to="dashboard" replace />} />
            <Route path="crm" element={<CrmPage />} />
            <Route path="crates" element={<CratesPage />} />
            <Route path="fleet" element={<FleetPage />} />
            <Route path="exceptions" element={<ExceptionsPage />} />
          </Route>
          <Route path="ledger" element={<FinanceLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<FinanceDashboard />} />
            <Route path="wallet" element={<CustomerWalletPage />} />
            <Route path="farmer-ledger" element={<FarmerLedgerPage />} />
            <Route path="expenses" element={<FinanceExpensesPage />} />
            <Route path="income" element={<IncomePage />} />
            <Route path="advances" element={<AdvancesFinancePage />} />
            <Route path="payments" element={<PaymentsPage />} />
            <Route path="pl" element={<FinancePLPage />} />
            <Route path="balance-sheet" element={<BalanceSheetPage />} />
            <Route path="cash-flow" element={<CashFlowPage />} />
            <Route path="reports" element={<FinanceReportsPage />} />
            <Route path="wallets" element={<Navigate to="/admin/ledger/wallet" replace />} />
            <Route path="opex" element={<Navigate to="/admin/ledger/expenses" replace />} />
            <Route path="analytics" element={<Navigate to="/admin/ledger/reports" replace />} />
          </Route>
          <Route path="settings" element={<SettingsLayout />}>
            <Route index element={<Navigate to="business" replace />} />
            <Route path="business" element={<BusinessInfo />} />
            <Route path="milk-rates" element={<MilkRateChart />} />
            <Route path="pricing" element={<ProductPricing />} />
            <Route path="routes" element={<RoutesSettings />} />
            <Route path="users" element={<UserRoles />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="system" element={<SystemConfig />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
