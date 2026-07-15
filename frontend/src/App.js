import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import "./App.css";
import { AuthProvider } from "./context/AuthContext";
import { LangProvider } from "./context/LangContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";
import HomePage from "./pages/Home";
import Category from "./pages/Category";
import ServiceDetail from "./pages/ServiceDetail";
import Booking from "./pages/Booking";
import AIDiagnosis from "./pages/AIDiagnosis";
import Bookings from "./pages/Bookings";
import BookingDetail from "./pages/BookingDetail";
import Profile from "./pages/Profile";
import Admin from "./pages/Admin";
import Technician from "./pages/Technician";
import AdminLogin from "./pages/AdminLogin";
import TechnicianLogin from "./pages/TechnicianLogin";
import TechnicianSignup from "./pages/TechnicianSignup";

function AppRouter() {
  const location = useLocation();
  // Detect session_id synchronously during render, before any protected routes check auth.
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/technician/login" element={<TechnicianLogin />} />
      <Route path="/technician/signup" element={<TechnicianSignup />} />
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="/category/:categoryId" element={<Category />} />
        <Route path="/service/:serviceId" element={<ServiceDetail />} />
        <Route path="/book/:serviceId" element={<Booking />} />
        <Route path="/diagnose" element={<AIDiagnosis />} />
        <Route path="/bookings" element={<Bookings />} />
        <Route path="/bookings/:bookingId" element={<BookingDetail />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/technician" element={<Technician />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <LangProvider>
          <AuthProvider>
            <AppRouter />
            <Toaster
              theme="dark"
              position="top-center"
              toastOptions={{
                style: {
                  background: "#121217",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#fff",
                },
              }}
            />
          </AuthProvider>
        </LangProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
