import "./index.css"
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import Login from "./pages/Login.jsx"
import Signup from "./pages/Signup"
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard.jsx'
import Records from "./pages/Records.jsx"
import Inventory from "./pages/Inventory.jsx"
import SalesTransaction from "./pages/SalesTransaction.jsx"
import SalesRecord from "./pages/SalesRecord.jsx"
import AddSalesRecord from "./pages/AddSalesRecord.jsx"
import EditSalesRecord from "./pages/EditSalesRecord.jsx"
import PersonnelVisitors from './pages/PersonnelVisitors'
import PersonnelManpower from './pages/Personnelandmanpower'
import FlockProfile from './pages/Flockprofile.jsx'
import AddFlock from './pages/Addflock.jsx'
import EditFlock from './pages/EditFlock.jsx'
import EggRecord from "./pages/EggRecord";
import AddEggRecord from "./pages/AddEggRecord";
import EditEggRecord from "./pages/EditEggRecord";
import HealthRecord from "./pages/HealthRecord";
import AddHealthRecord from "./pages/AddHealthRecord";
import EditHealthRecord from "./pages/EditHealthRecord";
import MortalityRecord from "./pages/MortalityRecord";
import AddMortalityRecord from "./pages/AddMortalityRecord";
import EditMortalityRecord from "./pages/EditMortalityRecord";
import QuarantineIsolation from "./pages/QuarantineandIsolation";
import AddQuarantineIsolation from "./pages/AddQuarantineIsolation";
import EditQuarantineIsolation from "./pages/EditQuarantineandIsolation";
import ManureWasteRecord from "./pages/ManureandWasteRecord.jsx";
import AddManureRecord from "./pages/AddManureRecord.jsx";
import AddWasteRecord from "./pages/AddWasteRecord.jsx";
import EditManureRecord from "./pages/EditManureRecord.jsx";
import EditWasteRecord from "./pages/EditWasteRecord.jsx";
import ExpensesRecord from "./pages/ExpensesRecord.jsx";
import AddExpense from "./pages/AddExpense.jsx";
import EditExpense from "./pages/EditExpense.jsx";
import FeedInventory     from "./pages/FeedInventory.jsx";
import AddFeedInventory  from "./pages/AddFeedInventory.jsx";
import EditFeedInventory from "./pages/EditFeedInventory.jsx";
import FeedConsumption     from "./pages/FeedConsumption.jsx";
import AddFeedConsumption  from "./pages/AddFeedConsumption.jsx";
import EditFeedConsumption from "./pages/EditFeedConsumption.jsx";
import Equipment     from "./pages/Equipment.jsx";
import AddEquipment  from "./pages/AddEquipment.jsx";
import EditEquipment from "./pages/EditEquipment.jsx";
import ViewPersonnel from "./pages/ViewPersonnel";
import EditPersonnel from "./pages/EditPersonnel";
import AddTask from "./pages/AddTask";
import EditTask from "./pages/EditTask";
import Visitors from "./pages/Visitors";
import ViewVisitor from "./pages/ViewVisitor";
import VisitorCheckIn from "./pages/VisitorCheckIn";
import FarmerTodo from "./pages/FarmerTodo";
import AdminTodo from "./pages/AdminTodo";
import Notifications from "./pages/Notifications";
import Settings from "./pages/Settings";
import BatchSummary from "./pages/BatchSummary";
import Archive from "./pages/Archive";
import AuditLogs from "./pages/AuditLogs";
import UsersRoles from "./pages/UsersRoles";
import QRCheckIn from "./pages/QRCheckIn";
import Profile from "./pages/Profile";
import ProtectedRoute from "./components/ProtectedRoute";
import PendingApproval from './pages/PendingApproval';

import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'

function RouteGate({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const hasToken = !!localStorage.getItem('token')
  const [ready, setReady] = useState(location.pathname === '/' || hasToken)

  useEffect(() => {
    if (location.pathname !== '/' && !hasToken) {
      sessionStorage.setItem('pb_intended_path', location.pathname + location.search)
      navigate('/', { replace: true })
    }
    if (!ready) {
      setReady(true)
    }
  }, [])

  if (!ready) return null

  return children
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <RouteGate>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/records" element={<Records />} />
        <Route path="/records/flock" element={<FlockProfile />} />
        <Route path="/records/flock/add" element={<ProtectedRoute allow={["Owner"]}><AddFlock /></ProtectedRoute>} />
        <Route path="/records/flock/edit/:id" element={<ProtectedRoute allow={["Owner"]}><EditFlock /></ProtectedRoute>} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/sales-transactions" element={<SalesTransaction />} />
        <Route path="/sales-transactions/sales" element={<ProtectedRoute allow={["Owner"]}><SalesRecord /></ProtectedRoute>} />
        <Route path="/sales-transactions/sales/add" element={<ProtectedRoute allow={["Owner"]}><AddSalesRecord /></ProtectedRoute>} />
        <Route path="/sales-transactions/sales/edit/:id" element={<ProtectedRoute allow={["Owner"]}><EditSalesRecord /></ProtectedRoute>} />
        <Route path="/personnel-visitors" element={<ProtectedRoute allow={["Owner"]}><PersonnelVisitors /></ProtectedRoute>} />
        <Route path="/personnel-visitors/personnel" element={<ProtectedRoute allow={["Owner"]}><PersonnelManpower /></ProtectedRoute>} />
        <Route path="/personnel-visitors/personnel/view/:id" element={<ProtectedRoute allow={["Owner"]}><ViewPersonnel /></ProtectedRoute>} />
        <Route path="/personnel-visitors/personnel/edit/:id" element={<ProtectedRoute allow={["Owner"]}><EditPersonnel /></ProtectedRoute>} />
        <Route path="/personnel-visitors/personnel/:id/tasks/add" element={<ProtectedRoute allow={["Owner"]}><AddTask /></ProtectedRoute>} />
        <Route path="/personnel-visitors/personnel/:id/tasks/edit/:taskId" element={<ProtectedRoute allow={["Owner"]}><EditTask /></ProtectedRoute>} />
        <Route path="/personnel-visitors/visitors" element={<ProtectedRoute allow={["Owner"]}><Visitors /></ProtectedRoute>} />
        <Route path="/personnel-visitors/visitors/view/:id" element={<ProtectedRoute allow={["Owner"]}><ViewVisitor /></ProtectedRoute>} />
        <Route path="/visitor/register" element={<VisitorCheckIn />} />
        <Route path="/records/egg" element={<EggRecord />} />
        <Route path="/records/egg/add" element={<AddEggRecord />} />
        <Route path="/records/egg/edit/:id" element={<EditEggRecord />} />
        <Route path="/records/health" element={<HealthRecord />} />
        <Route path="/records/health/add" element={<AddHealthRecord />} />
        <Route path="/records/health/edit/:id" element={<EditHealthRecord />} />
        <Route path="/records/mortality" element={<MortalityRecord />} />
        <Route path="/records/mortality/add" element={<AddMortalityRecord />} />
        <Route path="/records/mortality/edit/:id" element={<EditMortalityRecord />} />
        <Route path="/records/quarantine" element={<QuarantineIsolation />} />
        <Route path="/records/quarantine/add" element={<AddQuarantineIsolation />} />
        <Route path="/records/quarantine/edit/:id" element={<EditQuarantineIsolation />} />
        <Route path="/records/manure" element={<ManureWasteRecord />} />
        <Route path="/records/manure/add" element={<AddManureRecord />} />
        <Route path="/records/waste/add" element={<AddWasteRecord />} />
        <Route path="/records/manure/edit/:id" element={<EditManureRecord />} />
        <Route path="/records/waste/edit/:id" element={<EditWasteRecord />} />
        <Route path="/sales-transactions/expenses" element={<ProtectedRoute allow={["Owner"]}><ExpensesRecord /></ProtectedRoute>} />
        <Route path="/sales-transactions/expenses/add" element={<ProtectedRoute allow={["Owner"]}><AddExpense /></ProtectedRoute>} />
        <Route path="/sales-transactions/expenses/edit/:id" element={<ProtectedRoute allow={["Owner"]}><EditExpense /></ProtectedRoute>} />
        <Route path="/inventory/feed-inventory"          element={<FeedInventory />} />
        <Route path="/inventory/feed-inventory/add"      element={<AddFeedInventory />} />
        <Route path="/inventory/feed-inventory/edit/:id" element={<EditFeedInventory />} />
        <Route path="/inventory/feed-consumption"          element={<FeedConsumption />} />
        <Route path="/inventory/feed-consumption/add"      element={<AddFeedConsumption />} />
        <Route path="/inventory/feed-consumption/edit/:id" element={<EditFeedConsumption />} />
        <Route path="/inventory/equipment"          element={<Equipment />} />
        <Route path="/inventory/equipment/add"      element={<AddEquipment />} />
        <Route path="/inventory/equipment/edit/:id" element={<EditEquipment />} />
        <Route path="/todo" element={<FarmerTodo />} />
        <Route path="/owner/todo" element={<ProtectedRoute allow={["Owner"]}><AdminTodo /></ProtectedRoute>} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/batch-summary/:batchId" element={<BatchSummary />} />
        <Route path="/pending-approval" element={<PendingApproval />} />


        <Route path="/settings/archive" element={<ProtectedRoute allow={["Owner"]}><Archive /></ProtectedRoute>} />
        <Route path="/audit-logs" element={<ProtectedRoute allow={["Owner"]}><AuditLogs /></ProtectedRoute>} />
        <Route path="/users-roles" element={<ProtectedRoute allow={["Owner"]}><UsersRoles /></ProtectedRoute>} />
        <Route path="/attendance/check-in" element={<QRCheckIn />} />
        <Route path="/profile" element={<Profile />} />

      </Routes>
      </RouteGate>
    </BrowserRouter>
  </React.StrictMode>,
)