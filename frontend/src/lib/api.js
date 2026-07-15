import axios from "axios";
import { isSupabaseConfigured } from "./supabase";
import { supabaseApi } from "./supabaseApi";

const envBackendUrl = process.env.REACT_APP_BACKEND_URL;
const localBackendUrl =
  typeof window !== "undefined" &&
  ["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? `http://${window.location.hostname}:8000`
    : "";

export const BACKEND_URL = localBackendUrl || envBackendUrl;
export const API = `${BACKEND_URL}/api`;

const backendApi = axios.create({
  baseURL: API,
  withCredentials: true,
});

export const api = isSupabaseConfigured ? supabaseApi : backendApi;
