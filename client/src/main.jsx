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
import PersonnelManpower from './pages/PersonnelandManpower'
import FlockProfile from './pages/FlockProfile.jsx'
import AddFlock from './pages/AddFlock.jsx'
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

import { BrowserRouter, Routes, Route } from 'react-router-dom'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/records" element={<Records />} />
        <Route path="/records/flock" element={<FlockProfile />} />
        <Route path="/records/flock/add" element={<AddFlock />} />
        <Route path="/records/flock/edit/:id" element={<EditFlock />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/sales-transactions" element={<SalesTransaction />} />
        <Route path="/sales-transactions/sales" element={<SalesRecord />} />
        <Route path="/sales-transactions/sales/add" element={<AddSalesRecord />} />
        <Route path="/sales-transactions/sales/edit/:id" element={<EditSalesRecord />} />
        <Route path="/personnel-visitors" element={<PersonnelVisitors />} />
        <Route path="/personnel-visitors/personnel" element={<PersonnelManpower />} />
        <Route path="/personnel-visitors/personnel/view/:id" element={<ViewPersonnel />} />
        <Route path="/personnel-visitors/personnel/edit/:id" element={<EditPersonnel />} />
        <Route path="/personnel-visitors/personnel/:id/tasks/add" element={<AddTask />} />
        <Route path="/personnel-visitors/personnel/:id/tasks/edit/:taskId" element={<EditTask />} />
        <Route path="/personnel-visitors/visitors" element={<Visitors />} />
        <Route path="/personnel-visitors/visitors/view/:id" element={<ViewVisitor />} />
        <Route path="/visitor/check-in" element={<VisitorCheckIn />} />
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
        <Route path="/sales-transactions/expenses" element={<ExpensesRecord />} />
        <Route path="/sales-transactions/expenses/add" element={<AddExpense />} />
        <Route path="/sales-transactions/expenses/edit/:id" element={<EditExpense />} />
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
        <Route path="/admin/todo" element={<AdminTodo />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)