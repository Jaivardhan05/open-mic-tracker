"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "../../src/context/AuthContext";
import {
  signInUser,
  signUpComedian,
  signUpVenueProducer,
  type AuthUser,
} from "../../src/lib/auth";
import styles from "./auth.module.css";

type Mode = "login" | "signup";
type SignupRole = "comedian" | "venue_producer";

function getRedirectPath(role: AuthUser["role"]): string {
  switch (role) {
    case "comedian":
      return "/home";
    case "venue_producer":
      return "/venue-dashboard";
    case "admin":
      return "/admin-dashboard";
    default:
      return "/auth";
  }
}

export default function AuthPage() {
  const { user, isLoading: isAuthLoading, login } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("login");
  const [role, setRole] = useState<SignupRole>("comedian");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [comedianName, setComedianName] = useState("");
  const [comedianUsername, setComedianUsername] = useState("");
  const [comedianEmail, setComedianEmail] = useState("");
  const [comedianPhone, setComedianPhone] = useState("");
  const [comedianCity, setComedianCity] = useState("Delhi");
  const [comedianPassword, setComedianPassword] = useState("");

  const [venueName, setVenueName] = useState("");
  const [venueProducerName, setVenueProducerName] = useState("");
  const [venueProducerEmail, setVenueProducerEmail] = useState("");
  const [venueProducerPhone, setVenueProducerPhone] = useState("");
  const [venueProducerPassword, setVenueProducerPassword] = useState("");

  useEffect(() => {
    if (isAuthLoading || !user) {
      return;
    }

    router.push(getRedirectPath(user.role));
  }, [user, isAuthLoading, router]);

  async function handleLogin() {
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setError("Please enter email and password");
      return;
    }

    setIsLoading(true);
    setError("");

    const { user: authUser, error: authError } = await signInUser(loginEmail.trim(), loginPassword);

    if (authError || !authUser) {
      setError(authError ?? "Invalid email or password");
      setIsLoading(false);
      return;
    }

    login(authUser);

    switch (authUser.role) {
      case "comedian":
        router.push("/home");
        break;
      case "venue_producer":
        router.push("/venue-dashboard");
        break;
      case "admin":
        router.push("/admin-dashboard");
        break;
      default:
        router.push("/home");
    }

    setIsLoading(false);
  }

  async function handleSignup() {
    setIsLoading(true);
    setError("");

    const activeEmail = role === "comedian" ? comedianEmail.trim() : venueProducerEmail.trim();
    const activePhone = role === "comedian" ? comedianPhone.trim() : venueProducerPhone.trim();
    const activePassword = role === "comedian" ? comedianPassword : venueProducerPassword;

    if (role === "comedian") {
      if (
        !comedianName.trim() ||
        !comedianUsername.trim() ||
        !comedianEmail.trim() ||
        !comedianPhone.trim() ||
        !comedianPassword
      ) {
        setError("Please fill all required comedian fields");
        setIsLoading(false);
        return;
      }
    }

    if (role === "venue_producer") {
      if (
        !venueName.trim() ||
        !venueProducerName.trim() ||
        !venueProducerEmail.trim() ||
        !venueProducerPhone.trim() ||
        !venueProducerPassword
      ) {
        setError("Please fill all required venue producer fields");
        setIsLoading(false);
        return;
      }
    }

    if (!activeEmail.includes("@")) {
      setError("Please enter a valid email address");
      setIsLoading(false);
      return;
    }

    if (activePhone.replace(/\D/g, "").length < 10) {
      setError("Phone number must be at least 10 digits");
      setIsLoading(false);
      return;
    }

    if (activePassword.length < 6) {
      setError("Password must be at least 6 characters");
      setIsLoading(false);
      return;
    }

    if (role === "comedian") {
      const { user: authUser, error: authError } = await signUpComedian({
        name: comedianName.trim(),
        username: comedianUsername.trim(),
        email: comedianEmail.trim(),
        phone: comedianPhone.trim(),
        city: comedianCity,
        password: comedianPassword,
      });

      if (authError || !authUser) {
        setError(authError ?? "Signup failed");
        setIsLoading(false);
        return;
      }

      login(authUser);
      router.push("/home");
      setIsLoading(false);
      return;
    }

    const { user: authUser, error: authError } = await signUpVenueProducer({
      venueName: venueName.trim(),
      name: venueProducerName.trim(),
      email: venueProducerEmail.trim(),
      phone: venueProducerPhone.trim(),
      password: venueProducerPassword,
    });

    if (authError || !authUser) {
      setError(authError ?? "Signup failed");
      setIsLoading(false);
      return;
    }

    login(authUser);
    router.push("/venue-dashboard");
    setIsLoading(false);
  }

  const inputClassName = `${styles.fieldInput} mb-0`;
  const labelClassName = styles.fieldLabel;
  const tabButtonClassName = (active: boolean) => `${styles.modeTab} ${active ? styles.modeTabActive : ""}`;
  const roleCardClassName = (active: boolean) => `${styles.roleCard} ${active ? styles.roleCardActive : ""}`;

  return (
    <main className={styles.authPage}>
      <section className={styles.cardShell}>
        <div className={styles.brandBlock}>
          <h1 className={styles.brandTitle}>
            <span className={styles.brandOpenMic}>OPENMIC</span>
            <span className={styles.brandTilde} aria-hidden="true">
              ~
            </span>
            <span className={styles.brandDelhi}>Delhi</span>
          </h1>
          <p className={styles.brandSubtitle}>Take a stand, and find your spot.</p>
        </div>

        <div className={styles.modeTabs}>
          <button
            type="button"
              onClick={() => {
                setMode("login");
                setError("");
                setShowLoginPassword(false);
              }}
            className={tabButtonClassName(mode === "login")}
          >
            Log In
          </button>
          <button
            type="button"
              onClick={() => {
                setMode("signup");
                setError("");
              }}
            className={tabButtonClassName(mode === "signup")}
          >
            Sign Up
          </button>
        </div>

        {mode === "signup" ? (
          <div className={styles.roleGrid}>
            <button type="button" onClick={() => setRole("comedian")} className={roleCardClassName(role === "comedian")}>
              <span className={`${styles.roleIcon} ${role === "comedian" ? styles.roleIconActive : ""}`}>
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                  <line x1="8" y1="22" x2="16" y2="22" />
                </svg>
              </span>
              <p className={styles.roleTitle}>Comedian</p>
              <p className={styles.roleText}>Find and book open mic spots</p>
            </button>
            <button type="button" onClick={() => setRole("venue_producer")} className={roleCardClassName(role === "venue_producer")}>
              <span className={`${styles.roleIcon} ${role === "venue_producer" ? styles.roleIconActive : ""}`}>
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </span>
              <p className={styles.roleTitle}>Venue Producer</p>
              <p className={styles.roleText}>List and manage your venue</p>
            </button>
          </div>
        ) : null}

        {mode === "login" ? (
          <div className={styles.formStack}>
            <form
              className={styles.formStack}
              onSubmit={(e) => {
                e.preventDefault();
                void handleLogin();
              }}
            >
              <div className={styles.fieldGroup}>
                <label className={labelClassName} htmlFor="login-email">
                  Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className={inputClassName}
                  placeholder="username@gmail.com"
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={labelClassName} htmlFor="login-password">
                  Password
                </label>
                <div className={styles.inputShell}>
                  <input
                    id="login-password"
                    type={showLoginPassword ? "text" : "password"}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className={`${inputClassName} ${styles.passwordInput}`}
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    className={styles.passwordToggle}
                    onClick={() => setShowLoginPassword((current) => !current)}
                    aria-label={showLoginPassword ? "Hide password" : "Show password"}
                  >
                    {showLoginPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M3 3l18 18" />
                        <path d="M10.58 10.58a2 2 0 1 0 2.83 2.83" />
                        <path d="M9.88 5.1A10.92 10.92 0 0 1 12 5c5.5 0 9.5 7 9.5 7a20.17 20.17 0 0 1-4.18 4.82" />
                        <path d="M6.61 6.61A20.15 20.15 0 0 0 2.5 12s4 7 9.5 7a11.2 11.2 0 0 0 5.7-1.57" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M2.5 12s4-7 9.5-7 9.5 7 9.5 7-4 7-9.5 7S2.5 12 2.5 12Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className={styles.linkRow}>
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={(event) => {
                    event.preventDefault();
                  }}
                >
                  Forgot Password?
                </button>
              </div>

              {error ? <div className={styles.errorBox}>{error}</div> : null}

              <button type="submit" disabled={isLoading} className={styles.submitButton}>
                {isLoading ? "Signing in..." : "Sign in"}
              </button>
            </form>

            <div className={styles.divider}>
              <span className={styles.dividerLine} />
              <span className={styles.dividerText}>or continue with</span>
              <span className={styles.dividerLine} />
            </div>

            <div className={styles.googleButtonWrap}>
              <button type="button" className={styles.googleButton}>
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.655 32.659 29.382 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.938 3.047l5.657-5.657C34.142 6.053 29.327 4 24 4 12.954 4 4 12.954 4 24s8.954 20 20 20 20-8.954 20-20c0-1.341-.138-2.65-.389-3.917z" />
                  <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.938 3.047l5.657-5.657C34.142 6.053 29.327 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
                  <path fill="#4CAF50" d="M24 44c5.204 0 9.915-1.99 13.454-5.221l-6.196-5.238C29.26 35.091 26.813 36 24 36c-5.361 0-9.621-3.317-11.292-8.027l-6.52 5.024C9.496 40.556 16.113 44 24 44z" />
                  <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-1.561 4.659-5.792 8-11.303 8-3.355 0-6.435-1.13-8.708-3.026l-6.522 5.022C11.011 40.135 17.041 44 24 44c10.996 0 20-8.954 20-20 0-1.341-.138-2.65-.389-3.917z" />
                </svg>
                <span>Google</span>
              </button>
            </div>

            <p className={styles.footerNote}>
              Don&apos;t have an account yet?{" "}
              <button
                type="button"
                className={styles.footerAction}
                onClick={() => {
                  setMode("signup");
                  setError("");
                  setShowLoginPassword(false);
                }}
              >
                Register for free
              </button>
            </p>
          </div>
        ) : role === "comedian" ? (
          <form
            className={styles.formStack}
            onSubmit={(e) => {
              e.preventDefault();
              void handleSignup();
            }}
          >
            <div className={styles.fieldGroup}>
              <label className={labelClassName} htmlFor="comedian-name">
                Full name
              </label>
              <input
                id="comedian-name"
                value={comedianName}
                onChange={(e) => setComedianName(e.target.value)}
                className={inputClassName}
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={labelClassName} htmlFor="comedian-username">
                Username
              </label>
              <input
                id="comedian-username"
                value={comedianUsername}
                onChange={(e) => setComedianUsername(e.target.value)}
                className={inputClassName}
                placeholder="@yourname"
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={labelClassName} htmlFor="comedian-email">
                Email
              </label>
              <input
                id="comedian-email"
                type="email"
                value={comedianEmail}
                onChange={(e) => setComedianEmail(e.target.value)}
                className={inputClassName}
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={labelClassName} htmlFor="comedian-phone">
                Phone number
              </label>
              <input
                id="comedian-phone"
                value={comedianPhone}
                onChange={(e) => setComedianPhone(e.target.value)}
                className={inputClassName}
                placeholder="10-digit mobile number"
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={labelClassName} htmlFor="comedian-city">
                City
              </label>
              <select
                id="comedian-city"
                value={comedianCity}
                onChange={(e) => setComedianCity(e.target.value)}
                className={`${inputClassName} ${styles.selectField}`}
              >
                <option value="Delhi">Delhi</option>
                <option value="Mumbai">Mumbai</option>
                <option value="Bangalore">Bangalore</option>
                <option value="Pune">Pune</option>
              </select>
            </div>

            <div className={styles.fieldGroup}>
              <label className={labelClassName} htmlFor="comedian-password">
                Password
              </label>
              <input
                id="comedian-password"
                type="password"
                value={comedianPassword}
                onChange={(e) => setComedianPassword(e.target.value)}
                className={inputClassName}
              />
            </div>

            {error ? <div className={styles.errorBox}>{error}</div> : null}

            <button type="submit" disabled={isLoading} className={styles.submitButton}>
              {isLoading ? "Creating account..." : "Sign Up"}
            </button>
          </form>
        ) : (
          <form
            className={styles.formStack}
            onSubmit={(e) => {
              e.preventDefault();
              void handleSignup();
            }}
          >
            <div className={styles.fieldGroup}>
              <label className={labelClassName} htmlFor="venue-name">
                Venue name
              </label>
              <input
                id="venue-name"
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                className={inputClassName}
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={labelClassName} htmlFor="venue-producer-name">
                Your full name
              </label>
              <input
                id="venue-producer-name"
                value={venueProducerName}
                onChange={(e) => setVenueProducerName(e.target.value)}
                className={inputClassName}
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={labelClassName} htmlFor="venue-producer-email">
                Email
              </label>
              <input
                id="venue-producer-email"
                type="email"
                value={venueProducerEmail}
                onChange={(e) => setVenueProducerEmail(e.target.value)}
                className={inputClassName}
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={labelClassName} htmlFor="venue-producer-phone">
                Phone number
              </label>
              <input
                id="venue-producer-phone"
                value={venueProducerPhone}
                onChange={(e) => setVenueProducerPhone(e.target.value)}
                className={inputClassName}
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={labelClassName} htmlFor="venue-producer-password">
                Password
              </label>
              <input
                id="venue-producer-password"
                type="password"
                value={venueProducerPassword}
                onChange={(e) => setVenueProducerPassword(e.target.value)}
                className={inputClassName}
              />
            </div>

            {error ? <div className={styles.errorBox}>{error}</div> : null}

            <button type="submit" disabled={isLoading} className={styles.submitButton}>
              {isLoading ? "Creating account..." : "Sign Up"}
            </button>

            <p className={styles.supportText}>Your venue will be reviewed by our team before going live.</p>
          </form>
        )}
      </section>
    </main>
  );
}