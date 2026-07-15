import { createContext, useContext } from "react";

const STRINGS_EN = {
  greeting: "Hi",
  city: "Gurugram",
  hero_1: "What needs fixing",
  hero_2: "today?",
  ai_kicker: "AI Diagnosis",
  ai_title: "Snap. Diagnose. Book.",
  ai_body: "Point your camera at the problem \u2014 get an instant diagnosis and cost estimate.",
  ai_cta: "Start Diagnosis",
  category: "Category",
  coming_soon: "Coming Soon",
  home_appliances: "Home Appliances",
  home_appliances_tag: "Repair \u00b7 Install \u00b7 Service",
  handyman: "Handyman & Odd Jobs",
  handyman_tag: "Booking fee \u20b9100 \u00b7 Save vs market",
  car_bike: "Car & Bike Repair",
  car_bike_tag: "Doorstep vehicle care",
  drivers: "Permanent Drivers",
  drivers_tag: "Monthly \u00b7 Full-time",
  maids: "Domestic Maids",
  maids_tag: "Verified housekeeping",
  booking_fee: "Booking Fee",
  from: "from",
  market: "market",
  save_up_to: "Save up to",
  custom_kicker: "Custom",
  custom_headline: "Can't find your job?",
  custom_sub: "Request custom service \u2192",
};

const LangContext = createContext({ t: (key) => STRINGS_EN[key] || key });

export function LangProvider({ children }) {
  const t = (key) => STRINGS_EN[key] || key;

  return (
    <LangContext.Provider value={{ t }}>
      {children}
    </LangContext.Provider>
  );
}

export const useLang = () => useContext(LangContext);
