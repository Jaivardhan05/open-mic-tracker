export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  city?: string;
  role: "comedian" | "venue_producer" | "admin";
  venueName?: string;
  bio?: string;
  contactEmail?: string;
  youtubeUrl?: string;
  xUrl?: string;
  instagramUrl?: string;
  createdAt: string;
}

export interface StoredAuthUser extends AuthUser {
  password: string;
}

import { supabase } from "./supabaseClient";

export function getCurrentUser(): AuthUser | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = localStorage.getItem("openmic_user");
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setCurrentUser(user: AuthUser): void {
  localStorage.setItem("openmic_user", JSON.stringify(user));
}

export function clearCurrentUser(): void {
  localStorage.removeItem("openmic_user");
}

export function generateMockId(): string {
  return "mock_" + Math.random().toString(36).substring(2, 15);
}

export function isAuthenticated(): boolean {
  return getCurrentUser() !== null;
}

export function getStoredUsers(): StoredAuthUser[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = localStorage.getItem("openmic_users");
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as StoredAuthUser[]) : [];
  } catch {
    return [];
  }
}

export function setStoredUsers(users: StoredAuthUser[]): void {
  localStorage.setItem("openmic_users", JSON.stringify(users));
}

export async function signUpComedian(params: {
  name: string;
  email: string;
  phone: string;
  password: string;
}): Promise<{
  user: AuthUser | null;
  error: string | null;
}> {
  const { data, error } = await supabase.auth.signUp({
    email: params.email,
    password: params.password,
    options: {
      data: {
        full_name: params.name,
        role: "comedian",
      },
    },
  });

  if (error) {
    return { user: null, error: error.message };
  }

  if (!data.user) {
    return { user: null, error: "Signup failed" };
  }

  // Update additional profile fields that the trigger doesn't capture.
  const { error: updateError } = await supabase
    .from("users")
    .update({
      phone: params.phone,
    })
    .eq("id", data.user.id);

  if (updateError) {
    console.error("Profile update error:", updateError);
  }

  const authUser: AuthUser = {
    id: data.user.id,
    name: params.name,
    email: params.email,
    phone: params.phone,
    role: "comedian",
    createdAt: new Date().toISOString(),
  };

  return { user: authUser, error: null };
}

export async function signUpVenueProducer(params: {
  venueName: string;
  name: string;
  email: string;
  phone: string;
  password: string;
}): Promise<{
  user: AuthUser | null;
  error: string | null;
}> {
  const { data, error } = await supabase.auth.signUp({
    email: params.email,
    password: params.password,
    options: {
      data: {
        full_name: params.name,
        role: "venue_producer",
        city: "Delhi",
      },
    },
  });

  if (error) {
    return { user: null, error: error.message };
  }

  if (!data.user) {
    return { user: null, error: "Signup failed" };
  }

  // Create venue with default pending moderation fields.
  const { error: venueError } = await supabase.from("venues").insert({
    owner_id: data.user.id,
    name: params.venueName,
    address: "To be updated",
    city: "Delhi",
    state: "Delhi",
    country: "India",
    photos: [],
    description: "",
    verified: false,
    admin_approved: false,
    is_active: true,
  });

  if (venueError) {
    console.error("Venue creation error:", venueError);
    return {
      user: null,
      error:
        "Account created but venue registration failed. Please contact support.",
    };
  }

  // Update phone in users table.
  await supabase.from("users").update({ phone: params.phone }).eq("id", data.user.id);

  const authUser: AuthUser = {
    id: data.user.id,
    name: params.name,
    email: params.email,
    phone: params.phone,
    city: "Delhi",
    role: "venue_producer",
    venueName: params.venueName,
    createdAt: new Date().toISOString(),
  };

  return { user: authUser, error: null };
}

export async function signInUser(email: string, password: string): Promise<{
  user: AuthUser | null;
  error: string | null;
}> {
  // Admin bypasses Supabase Auth entirely.
  if (email === "admin@openmic.delhi" && password === "OpenMic@Admin2024") {
    const adminUser: AuthUser = {
      id: "admin_root",
      name: "Admin",
      email: "admin@openmic.delhi",
      phone: "",
      city: "Delhi",
      role: "admin",
      createdAt: new Date().toISOString(),
    };
    return { user: adminUser, error: null };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { user: null, error: error.message };
  }

  if (!data.user) {
    return { user: null, error: "Login failed" };
  }

  // Fetch canonical profile from public.users.
  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("*")
    .eq("id", data.user.id)
    .single();

  if (profileError || !profile) {
    return { user: null, error: "Profile not found. Please try again." };
  }

  let venueName: string | undefined;

  if (profile.role === "venue_producer") {
    const { data: venueData } = await supabase
      .from("venues")
      .select("name")
      .eq("owner_id", data.user.id)
      .single();

    venueName = venueData?.name;
  }

  const authUser: AuthUser = {
    id: data.user.id,
    name: profile.name,
    email: profile.email,
    phone: profile.phone ?? "",
    role: profile.role as AuthUser["role"],
    venueName,
    ...(profile.role !== "comedian" ? { city: profile.city ?? "Delhi" } : {}),
    bio: profile.bio ?? undefined,
    contactEmail: profile.contact_email ?? undefined,
    youtubeUrl: profile.youtube_url ?? undefined,
    xUrl: profile.x_url ?? undefined,
    instagramUrl: profile.instagram_url ?? undefined,
    createdAt: profile.created_at,
  };

  return { user: authUser, error: null };
}

export async function signOutUser(): Promise<void> {
  await supabase.auth.signOut();
}