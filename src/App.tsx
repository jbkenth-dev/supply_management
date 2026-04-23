import { Navigate, Routes, Route } from "react-router-dom";
import Layout from "./layout/Layout";
import Home from "./pages/Home";
import Supplies from "./pages/Supplies";
import ItemDetails from "./pages/ItemDetails";
import About from "./pages/About";
import NotFound from "./pages/NotFound";
import SignUp from "./pages/auth/SignUp";
import Login from "./pages/auth/Login";
import ForgotPassword from "./pages/auth/ForgotPassword";
import AdminCreate from "./pages/admin/AdminCreate";
import CustodianDashboard from "./pages/custodian/CustodianDashboard";
import Dashboard from "./pages/Dashboard";
import NewRequest from "./pages/NewRequest";
import MyRequests from "./pages/MyRequests";
import AdminDashboard from "./pages/admin/AdminDashboard";
import RequestIssuance from "./pages/admin/RequestIssuance";
import CustodianRequestIssuance from "./pages/custodian/RequestIssuance";
import MyAccount from "./pages/admin/MyAccount";
import FacultyMyAccount from "./pages/MyAccount";
import Messages from "./pages/Messages";
import Notification from "./pages/Notification";
import SupplyManagement from "./pages/admin/SupplyManagement";
import StockManagement from "./pages/admin/StockManagement";
import CustodianSupplyManagement from "./pages/custodian/SupplyManagement";
import CustodianStockManagement from "./pages/custodian/StockManagement";
import CustodianMessages from "./pages/custodian/CustodianMessages";
import CustodianMyAccount from "./pages/custodian/CustodianMyAccount";
import CustodianNotification from "./pages/custodian/Notification";
import AdminMessages from "./pages/admin/AdminMessages";
import AdminNotification from "./pages/admin/Notification";
import AdminUsers from "./pages/admin/Users";
import AdminAnnouncements from "./pages/admin/AdminAnnouncements";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="supplies" element={<Supplies />} />
        <Route path="supplies/:code" element={<ItemDetails />} />
        <Route path="about" element={<About />} />
        <Route path="auth/signup" element={<SignUp />} />
        <Route path="auth/login" element={<Login />} />
        <Route path="admin-create" element={<AdminCreate />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/new-request" element={<NewRequest />} />
      <Route path="/my-requests" element={<MyRequests />} />
      <Route path="/notification" element={<Notification />} />
      <Route path="/custodian/dashboard" element={<CustodianDashboard />} />
      <Route path="/custodian/supply" element={<CustodianSupplyManagement />} />
      <Route path="/custodian/stock" element={<CustodianStockManagement />} />
      <Route path="/custodian/request-issuance" element={<CustodianRequestIssuance />} />
      <Route path="/custodian/notification" element={<CustodianNotification />} />
      <Route path="/cusodian/notification" element={<Navigate to="/custodian/notification" replace />} />
      <Route path="/custodian/reports" element={<Navigate to="/custodian/request-issuance" replace />} />
      <Route path="/admin/dashboard" element={<AdminDashboard />} />
      <Route path="/admin/supply" element={<SupplyManagement />} />
      <Route path="/admin/stock" element={<StockManagement />} />
      <Route path="/admin/request-issuance" element={<RequestIssuance />} />
      <Route path="/admin/notification" element={<AdminNotification />} />
      <Route path="/admin/announcements" element={<AdminAnnouncements />} />
      <Route path="/admin/reports" element={<Navigate to="/admin/request-issuance" replace />} />
      <Route path="/admin/users" element={<AdminUsers />} />
      <Route path="/admin/my-account" element={<MyAccount />} />
      <Route path="/my-account" element={<FacultyMyAccount />} />
      <Route path="/custodian/my-account" element={<CustodianMyAccount />} />
      <Route path="/message" element={<Messages />} />
      <Route path="/custodian/message" element={<CustodianMessages />} />
      <Route path="/admin/message" element={<AdminMessages />} />
      <Route path="/messages" element={<Navigate to="/message" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
