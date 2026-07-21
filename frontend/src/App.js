import { BrowserRouter, Routes, Route, useLocation, useParams } from "react-router-dom";
import { Toaster } from "sonner";
import "./App.css";
import { AuthProvider } from "./context/AuthContext";
import { LangProvider } from "./context/LangContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";
import HomePage from "./pages/Home";
import {
  AboutPage,
  AILensInfo,
  BlogIndex,
  MarketingHome,
  PricingPage,
  ServiceSeoPage,
  ServicesLanding,
} from "./pages/Marketing";
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
  // Supabase OAuth returns tokens in the URL hash before the client cleans them up.
  if (location.hash?.includes("access_token=")) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route index element={<MarketingHome />} />
      <Route path="/services" element={<ServicesLanding />} />
      <Route path="/services/:slug" element={<ServiceSeoRoute />} />
      <Route path="/ai-diagnosis" element={<AILensInfo />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/blog" element={<BlogIndex />} />
      <Route path="/login" element={<Login />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/technician/login" element={<TechnicianLogin />} />
      <Route path="/technician/signup" element={<TechnicianSignup />} />
      <Route element={<Layout />}>
        <Route path="/app" element={<HomePage />} />
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

function ServiceSeoRoute() {
  const { slug } = useParams();
  return <ServiceSeoPage slug={slug} />;
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
