
"use client";

import { useState } from "react";
import Link from "next/link";

const API =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [organization, setOrganization] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 12) {
      setError("Password must contain at least 12 characters.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          organization: organization.trim(),
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Registration unavailable. Please try again."
        );
      }

      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to register."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="fg-login">
      <section className="fg-login-brand">
        <div className="fg-brand-logo">✈</div>
        <div className="fg-brand-label">FLIGHTGUARD AI</div>

        <h1>
          Start your journey.
          <br />
          <span>Smarter aviation.</span>
        </h1>

        <p>
          Join FlightGuard AI Enterprise to access aviation analytics,
          aircraft monitoring, and AI-powered operational intelligence.
        </p>

        <div className="fg-brand-footer">
          ENTERPRISE AVIATION INTELLIGENCE PLATFORM
        </div>
      </section>

      <section className="fg-login-panel">
        <div className="fg-login-card">
          <div className="fg-mobile-brand">✈ FLIGHTGUARD AI</div>

          <div className="fg-security-tag">
            <span className="fg-status-dot" />
            NEW CUSTOMER REGISTRATION
          </div>

          {success ? (
            <>
              <h2>Request submitted!</h2>
              <p className="fg-login-subtitle">
                Your account request has been received.
                An administrator must approve it before you can sign in.
              </p>

              <Link
                href="/login"
                className="fg-signin-button"
                style={{
                  display: "block",
                  textAlign: "center",
                  textDecoration: "none",
                }}
              >
                Return to Sign In →
              </Link>
            </>
          ) : (
            <>
              <h2>Create your account</h2>
              <p className="fg-login-subtitle">
                Register your details to request enterprise access.
              </p>

              <form onSubmit={handleSubmit}>
                <label htmlFor="signup-name">Full name</label>
                <input
                  id="signup-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your full name"
                  autoComplete="name"
                  required
                />

                <label htmlFor="signup-org">Organization name</label>
                <input
                  id="signup-org"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="Airline or company name"
                  required
                />

                <label htmlFor="signup-email">Work email address</label>
                <input
                  id="signup-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@organization.com"
                  autoComplete="email"
                  required
                />

                <label htmlFor="signup-password">Password</label>
                <div className="fg-password-field">
                  <input
                    id="signup-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 12 characters"
                    autoComplete="new-password"
                    minLength={12}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>

                <label htmlFor="signup-confirm">Confirm password</label>
                <input
                  id="signup-confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                  required
                />

                {error && (
                  <div className="fg-login-error" role="alert">
                    {error}
                  </div>
                )}

                <button
                  className="fg-signin-button"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? "Submitting..." : "Create Account →"}
                </button>
              </form>

              <div className="fg-login-note">
                Already have an account?{" "}
                <Link
                  href="/login"
                  style={{ color: "#155ad7", fontWeight: 700 }}
                >
                  Sign In
                </Link>
              </div>
            </>
          )}
        </div>

        <div className="fg-panel-footer">
          © 2026 FlightGuard AI · Secure Enterprise Portal
        </div>
      </section>
    </main>
  );
}
