
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const API =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Invalid email or password.");
        }

        if (response.status === 403) {
          throw new Error(
            "Your account is awaiting administrator approval."
          );
        }

        throw new Error(
          "Unable to sign in. Please try again."
        );
      }

      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to sign in."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="fg-login">
      {/* Left Branding Panel */}
      <section className="fg-login-brand">
        <div className="fg-brand-logo">✈</div>

        <div className="fg-brand-label">
          FLIGHTGUARD AI
        </div>

        <h1>
          Aviation intelligence.
          <br />
          <span>One secure platform.</span>
        </h1>

        <p>
          Monitor aviation operations, explore flight analytics,
          and access AI-powered operational insights.
        </p>

        <div className="fg-brand-footer">
          ENTERPRISE AVIATION INTELLIGENCE PLATFORM
        </div>
      </section>

      {/* Right Login Panel */}
      <section className="fg-login-panel">
        <div className="fg-login-card">
          <div className="fg-mobile-brand">
            ✈ FLIGHTGUARD AI
          </div>

          <div className="fg-security-tag">
            <span className="fg-status-dot" />
            RESTRICTED ENTERPRISE ACCESS
          </div>

          <h2>Welcome back</h2>

          <p className="fg-login-subtitle">
            Sign in to your FlightGuard AI account.
          </p>

          {/* Login Form */}
          <form onSubmit={handleSubmit}>
            <label htmlFor="email">
              Email address
            </label>

            <input
              id="email"
              type="email"
              autoComplete="username"
              placeholder="name@organization.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <div className="fg-password-label">
              <label htmlFor="password">
                Password
              </label>
            </div>

            <div className="fg-password-field">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword(!showPassword)
                }
                aria-label={
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            {error && (
              <div
                className="fg-login-error"
                role="alert"
              >
                {error}
              </div>
            )}

            <button
              className="fg-signin-button"
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Signing in..."
                : "Sign in to FlightGuard →"}
            </button>
          </form>

          {/* Create Account */}
          <div
            style={{
              textAlign: "center",
              marginTop: 30,
              paddingTop: 24,
              borderTop: "1px solid #e2e8f0",
            }}
          >
            <p
              style={{
                color: "#64748b",
                fontSize: 14,
                marginBottom: 14,
              }}
            >
              Don't have an account?
            </p>

            <Link
              href="/signup"
              style={{
                display: "block",
                width: "100%",
                padding: "14px 20px",
                background: "#ffffff",
                color: "#155ad7",
                border: "1px solid #155ad7",
                borderRadius: 9,
                textAlign: "center",
                fontWeight: 700,
                textDecoration: "none",
                fontSize: 14,
              }}
            >
              Create a New Account →
            </Link>
          </div>

          {/* Security Notice */}
          <div className="fg-login-note">
            New accounts require administrator approval.
            <br />
            Access is limited to authorized users.
          </div>
        </div>

        <div className="fg-panel-footer">
          © 2026 FlightGuard AI · Secure Enterprise Portal
        </div>
      </section>
    </main>
  );
}
