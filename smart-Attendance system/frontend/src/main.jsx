import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "../../static/style.css";
import RoleWorkspace from "./RoleWorkspace";
import { apiRequest } from "./services/api";

function App() {
  const [session, setSession] = useState(null);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const expire = () => setSession(null);
    window.addEventListener("attendance:session-expired", expire);
    return () => window.removeEventListener("attendance:session-expired", expire);
  }, []);

  async function signIn(event) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      setSession(await apiRequest("/api/login", { method: "POST", body: form }));
    } catch (loginError) {
      setError(loginError.message || "Invalid username or password.");
    }
  }

  if (!session) {
    return <main className="page-shell"><section className="login-page"><div className="login-shell"><aside className="login-intro"><div className="login-image-credit">CLASSROOM / LIVE</div><div className="login-brand-row"><div className="login-logo">SA</div><span className="live-pill"><span className="live-dot" />System online</span></div><div className="eyebrow">Smart Attendance / Control room</div><h1>Every presence<br /><em>counts.</em></h1><p>One calm workspace for your class list, daily marking, and attendance insights.</p><div className="login-metrics"><div><strong>01</strong><span>Admin workspace</span></div><div><strong>24/7</strong><span>Secure access</span></div></div><div className="intro-rule" /><div className="intro-note"><span className="shield-mark">+</span><span>Attendance workspace<br /><strong>Ready for today</strong></span></div><div className="login-image-caption"><span className="caption-line" /><span>One clear view of every class.</span></div></aside><div className="login-box"><div className="login-topline"><div className="form-kicker">Admin sign in</div><span className="secure-label">Encrypted session</span></div><h2>Welcome back</h2><p className="muted">Sign in to manage today&apos;s attendance.</p>{error && <div className="flash error">{error}</div>}<form onSubmit={signIn}><div className="field-row"><label htmlFor="username">Username</label><span className="field-tag">Admin ID</span></div><div className="input-wrap"><span className="field-icon">@</span><input id="username" type="text" name="username" autoComplete="username" placeholder="Enter your username" required /></div><div className="field-row"><label htmlFor="password">Password</label><span className="field-tag">Secure</span></div><div className="input-wrap"><span className="field-icon">*</span><input id="password" type={showPassword ? "text" : "password"} name="password" autoComplete="current-password" placeholder="Enter your password" required /><button className="password-toggle" type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? "Hide" : "Show"}</button></div><div className="field-row"><label htmlFor="role">Role</label><span className="field-tag">Access</span></div><div className="input-wrap select-wrap"><select id="role" name="role" defaultValue="admin"><option value="admin">Admin</option><option value="teacher">Teacher</option><option value="student">Student</option></select></div><div className="login-options"><span className="session-status"><span className="status-dot" />Protected sign-in</span><span className="session-chip">30 min session</span></div><button className="btn login-submit" type="submit"><span>Sign in to dashboard</span><span aria-hidden="true">-&gt;</span></button></form><div className="login-security"><strong>Protected session</strong><span>Sessions expire after 30 minutes of inactivity. Always log out when you are finished.</span></div></div></div></section></main>;
  }

  return <RoleWorkspace session={session} onLogout={() => { apiRequest("/api/logout", { method: "POST" }).catch(() => {}); setSession(null); }} />;
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
