// App.jsx — FULL file with Ultimate UI
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Principal } from "@dfinity/principal";
import { self_backend } from "../../declarations/self_backend";
import "./index.scss";

// ==================== UTILITIES ====================
const isOk = (res) => res && Object.prototype.hasOwnProperty.call(res, "ok");
const getErr = (res) => (res && res.err) || (res && res["err"]) || null;
const getOk = (res) => (res && res.ok) || (res && res["ok"]) || null;

function arrayBufferToBase64(buffer) {
  if (!buffer) return null;
  if (typeof buffer === "string" && buffer.startsWith("data:")) return buffer;
  let u8;
  if (buffer instanceof Uint8Array) {
    u8 = buffer;
  } else if (buffer.buffer && buffer.byteLength) {
    u8 = new Uint8Array(buffer.buffer || buffer);
  } else if (Array.isArray(buffer)) {
    u8 = new Uint8Array(buffer);
  } else {
    try {
      u8 = new Uint8Array(Object.values(buffer));
    } catch (e) {
      return null;
    }
  }
  let binary = "";
  for (let i = 0; i < u8.length; i++) {
    binary += String.fromCharCode(u8[i]);
  }
  return window.btoa(binary);
}

/* Avatar generation system */
function getInitialFromName(name = "") {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  return parts[0][0].toUpperCase();
}

function hashToColors(str = "") {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue1 = Math.abs(hash % 360);
  const hue2 = (hue1 + 150 + Math.abs(hash % 60)) % 360;
  const sat1 = 70 + (hash % 20);
  const sat2 = 65 + ((hash * 3) % 20);
  const light1 = 55 + (hash % 12);
  const light2 = 45 + ((hash * 7) % 12);
  return [
    `hsl(${hue1}, ${sat1}%, ${light1}%)`,
    `hsl(${hue2}, ${sat2}%, ${light2}%)`,
  ];
}

function generateInitialAvatar(name = "", size = 256) {
  const initial = getInitialFromName(name || "");
  const [c1, c2] = hashToColors(name || initial);
  const svg = `
    <svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}'>
      <defs>
        <linearGradient id='g' x1='0%' y1='0%' x2='100%' y2='100%'>
          <stop offset='0%' stop-color='${c1}' />
          <stop offset='100%' stop-color='${c2}' />
        </linearGradient>
      </defs>
      <rect width='100%' height='100%' rx='${size/2}' fill="url(#g)" />
      <text x='50%' y='50%' text-anchor='middle' dominant-baseline='middle' 
            font-family='system-ui, -apple-system, "Segoe UI", Roboto, Arial' 
            font-size='${size * 0.5}' font-weight='700' fill='rgba(255,255,255,0.95)'>
        ${initial}
      </text>
    </svg>
  `;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function createEchosoulLogo(size = 80) {
  const svg = `
    <svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size * 0.6}' viewBox='0 0 200 120'>
      <style>
        .logo-text {
          font-family: 'Arial', sans-serif;
          font-weight: bold;
          font-size: 60px;
          fill: none;
          stroke: #4a6bff;
          stroke-width: 2;
          stroke-linejoin: round;
        }
        .logo-text-shadow {
          font-family: 'Arial', sans-serif;
          font-weight: bold;
          font-size: 60px;
          fill: none;
          stroke: #2a4bdf;
          stroke-width: 6;
          stroke-linejoin: round;
        }
      </style>
      <text x="100" y="80" class="logo-text-shadow" text-anchor="middle">EchoSoul</text>
      <text x="100" y="80" class="logo-text" text-anchor="middle">EchoSoul</text>
    </svg>
  `;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const profilePicToDataUrl = (profilePic, fallbackName = "") => {
  if (!profilePic) return generateInitialAvatar(fallbackName || "User");
  if (typeof profilePic === "string") {
    if (profilePic.startsWith("data:")) return profilePic;
    if (/^[A-Za-z0-9+/=]+$/.test(profilePic)) return `data:image/png;base64,${profilePic}`;
  }
  try {
    const base64 = arrayBufferToBase64(profilePic);
    return base64 ? `data:image/png;base64,${base64}` : generateInitialAvatar(fallbackName || "User");
  } catch (e) {
    console.warn("profilePicToDataUrl failed:", e);
    return generateInitialAvatar(fallbackName || "User");
  }
};

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debouncedValue;
}

const safeNumber = (value) => {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  return value;
};

// ==================== MAIN APPLICATION ====================
export default function App() {
  // --- Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [authMessage, setAuthMessage] = useState("");
  const [activeTab, setActiveTab] = useState("dashboard");

  // --- Loading states
  const [initialLoading, setInitialLoading] = useState(true);
  const [authOperationLoading, setAuthOperationLoading] = useState(false);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [deployLoading, setDeployLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [addingQuestionLoading, setAddingQuestionLoading] = useState(false);
  const [submitAnswerLoading, setSubmitAnswerLoading] = useState(false);

  // --- Training state
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [answerText, setAnswerText] = useState("");
  const [customQuestionText, setCustomQuestionText] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [customImportance, setCustomImportance] = useState(3);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 450);

  // --- Systems/chat state
  const [deployedSystems, setDeployedSystems] = useState([]);
  const [selectedSystem, setSelectedSystem] = useState(null);
  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const chatEndRef = useRef(null);

  // --- Profile settings
  const [bioText, setBioText] = useState("");
  const [profilePicFile, setProfilePicFile] = useState(null);
  const [profilePreviewUrl, setProfilePreviewUrl] = useState(null);

  // Profile picture preview effect
  useEffect(() => {
    if (!profilePicFile) {
      setProfilePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(profilePicFile);
    setProfilePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [profilePicFile]);

  // Computed profile image
  const profilePicSrc = useMemo(() => {
    if (profilePreviewUrl) return profilePreviewUrl;
    return profilePicToDataUrl(userProfile?.profilePic, userProfile?.username || "User");
  }, [profilePreviewUrl, userProfile]);

  // ==================== EFFECTS ====================
  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      setInitialLoading(true);
      try {
        const res = await self_backend.getDashboard();
        if (isOk(res)) {
          const user = getOk(res);
          if (!mounted) return;
          setUserProfile(user);
          setIsAuthenticated(true);
          setBioText(user?.bio || "");
        }
        await refreshQuestions();
        await fetchDeployedSystems();
      } catch (err) {
        console.warn("bootstrap failed", err);
      } finally {
        if (mounted) setInitialLoading(false);
      }
    };
    bootstrap();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [chatHistory]);

  // ==================== AUTHENTICATION ====================
  const registerUser = useCallback(async ({ username, email, password }) => {
    try {
      const res = await self_backend.register(username, email, password);
      if (isOk(res)) {
        const user = getOk(res);
        setUserProfile(user);
        setIsAuthenticated(true);
        setBioText(user?.bio || "");
        setAuthMessage("Registered and logged in successfully!");
        return { ok: true, user };
      } else {
        const err = getErr(res) || "Registration failed";
        return { ok: false, err };
      }
    } catch (e) {
      console.error("registerUser error", e);
      return { ok: false, err: "An unexpected error occurred during registration." };
    }
  }, []);

  const loginUser = useCallback(async ({ username, password }) => {
    try {
      const res = await self_backend.login(username, password);
      if (isOk(res)) {
        const user = getOk(res);
        setUserProfile(user);
        setIsAuthenticated(true);
        setBioText(user?.bio || "");
        setAuthMessage("Login successful! Welcome back.");
        return { ok: true, user };
      } else {
        const err = getErr(res) || "Login failed";
        return { ok: false, err };
      }
    } catch (e) {
      console.error("loginUser error", e);
      return { ok: false, err: "An error occurred during login." };
    }
  }, []);

  const handleLogout = () => {
    setUserProfile(null);
    setIsAuthenticated(false);
    setAuthMessage("");
    setCurrentQuestion(null);
    setAnswerText("");
    setActiveTab("dashboard");
    setChatHistory([]);
    setSelectedSystem(null);
  };

  // ==================== PROFILE ====================
  const refreshDashboard = useCallback(async () => {
    try {
      const res = await self_backend.getDashboard();
      if (isOk(res)) {
        setUserProfile(getOk(res));
      } else {
        console.warn("refreshDashboard warn", getErr(res));
      }
    } catch (err) {
      console.error("refreshDashboard error", err);
    }
  }, []);

  const handleProfilePicChange = (e) => {
    const f = e.target.files && e.target.files[0];
    if (f && f.size > 2 * 1024 * 1024) {
      alert("Please select an image smaller than 2MB");
      return;
    }
    setProfilePicFile(f || null);
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileLoading(true);
    try {
      let pic = null;
      if (profilePicFile) {
        const arrayBuffer = await profilePicFile.arrayBuffer();
        pic = new Uint8Array(arrayBuffer);
      }
      const res = await self_backend.updateProfile(bioText ? bioText : null, pic ? pic : null);
      if (isOk(res)) {
        await refreshDashboard();
        setAuthMessage("Profile updated successfully!");
      } else {
        setAuthMessage(getErr(res) || "Profile update failed.");
      }
    } catch (err) {
      console.error("handleUpdateProfile error", err);
      setAuthMessage("Failed to update profile. Please try again.");
    } finally {
      setProfileLoading(false);
    }
  };

  // ==================== TRAINING ====================
  const refreshQuestions = useCallback(async () => {
    setQuestionsLoading(true);
    try {
      const res = await self_backend.getQuestions();
      if (isOk(res)) {
        setQuestions(getOk(res));
      } else if (Array.isArray(res)) {
        setQuestions(res);
      } else {
        console.warn("getQuestions unexpected", res);
      }
    } catch (err) {
      console.error("refreshQuestions error", err);
    } finally {
      setQuestionsLoading(false);
    }
  }, []);

  const getNextQuestion = useCallback(async () => {
    setQuestionsLoading(true);
    try {
      const res = await self_backend.getNextQuestion();
      if (isOk(res)) {
        setCurrentQuestion(getOk(res));
        setAnswerText("");
      } else {
        setAuthMessage(getErr(res) || "No questions available. Try adding some!");
      }
    } catch (err) {
      console.error("getNextQuestion error", err);
      setAuthMessage("Failed to get next question.");
    } finally {
      setQuestionsLoading(false);
    }
  }, []);

  const submitAnswer = async (e) => {
    e.preventDefault();
    if (!currentQuestion) {
      setAuthMessage("Please select a question first.");
      return;
    }
    setSubmitAnswerLoading(true);
    try {
      const res = await self_backend.submitAnswer(safeNumber(currentQuestion.id), answerText);
      if (isOk(res)) {
        setAuthMessage("Answer submitted successfully!");
        await refreshDashboard();
        setCurrentQuestion(null);
      } else {
        setAuthMessage(getErr(res) || "Failed to submit answer.");
      }
    } catch (err) {
      console.error("submitAnswer error", err);
      setAuthMessage("Error submitting answer.");
    } finally {
      setSubmitAnswerLoading(false);
    }
  };

  const handleAddCustomQuestion = async (e) => {
    e.preventDefault();
    if (!customQuestionText.trim()) {
      setAuthMessage("Question text is required.");
      return;
    }
    setAddingQuestionLoading(true);
    try {
      const res = await self_backend.addCustomQuestion(
        customQuestionText,
        customCategory,
        Number(customImportance)
      );
      if (isOk(res)) {
        setAuthMessage("Custom question added successfully!");
        setCustomQuestionText("");
        setCustomCategory("");
        setCustomImportance(3);
        await refreshQuestions();
      } else {
        setAuthMessage(getErr(res) || "Failed to add custom question.");
      }
    } catch (err) {
      console.error("handleAddCustomQuestion error", err);
      setAuthMessage("Error adding question.");
    } finally {
      setAddingQuestionLoading(false);
    }
  };

  const filteredQuestions = questions.filter((q) => {
    const matchesCategory = selectedCategory === "all" || q.category === selectedCategory;
    const matchesSearch =
      (q.question || "").toLowerCase().includes((debouncedSearchTerm || "").toLowerCase()) ||
      (q.category && q.category.toLowerCase().includes((debouncedSearchTerm || "").toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const categories = useMemo(() => ["all", ...new Set(questions.map((q) => q.category).filter(Boolean))], [questions]);

  // ==================== SYSTEMS ====================
  const handleDeploy = async () => {
    if (!window.confirm("Deploying your system will make it available to others. Continue?")) return;
    setDeployLoading(true);
    try {
      const res = await self_backend.deploySystem();
      if (isOk(res)) {
        setAuthMessage("System deployed successfully!");
        await refreshDashboard();
        await fetchDeployedSystems();
      } else {
        setAuthMessage(getErr(res) || "Deployment failed.");
      }
    } catch (err) {
      console.error("handleDeploy error", err);
      setAuthMessage("Error deploying system.");
    } finally {
      setDeployLoading(false);
    }
  };

  const fetchDeployedSystems = useCallback(async () => {
    try {
      const res = await self_backend.getDeployedSystems();
      if (Array.isArray(res)) {
        setDeployedSystems(res.map((t) => ({ username: t[0], ownerId: t[1] })));
      } else if (isOk(res)) {
        setDeployedSystems(getOk(res).map((t) => ({ username: t[0], ownerId: t[1] })));
      } else {
        console.warn("getDeployedSystems unexpected", res);
      }
    } catch (err) {
      console.error("fetchDeployedSystems error", err);
    }
  }, []);

  const pickSystem = (system) => {
    setSelectedSystem(system);
    setChatHistory([]);
    setChatMessage("");
  };

  const sendChat = async (e) => {
    e.preventDefault();
    if (!selectedSystem) {
      setAuthMessage("Please select a system first.");
      return;
    }
    if (!chatMessage.trim()) {
      setAuthMessage("Please enter a message.");
      return;
    }

    setChatLoading(true);
    try {
      let owner = selectedSystem.ownerId;
      if (typeof owner === "string") {
        try {
          owner = Principal.fromText(owner);
        } catch (e) {
          // leave as string if not parsable
        }
      }

      const res = await self_backend.chatWithSystem(owner, chatMessage);
      if (isOk(res)) {
        const reply = getOk(res);
        setChatHistory((h) => [
          ...h,
          { fromMe: true, text: chatMessage, timestamp: new Date().toISOString() },
          { fromMe: false, text: reply, timestamp: new Date().toISOString() },
        ]);
        setChatMessage("");
      } else {
        setAuthMessage(getErr(res) || "Chat failed.");
      }
    } catch (err) {
      console.error("sendChat error", err);
      setAuthMessage("Error sending message.");
    } finally {
      setChatLoading(false);
    }
  };

  // ==================== UI COMPONENTS ====================
  function AuthModal({ onRegister, onLogin }) {
    const [localTab, setLocalTab] = useState("register");
    const [regValues, setRegValues] = useState({ username: "", email: "", password: "" });
    const [loginValues, setLoginValues] = useState({ username: "", password: "" });
    const [submitting, setSubmitting] = useState(false);
    const [localMessage, setLocalMessage] = useState("");

    const submitRegister = async (ev) => {
      ev.preventDefault();
      setLocalMessage("");
      setSubmitting(true);
      try {
        const res = await onRegister(regValues);
        if (!res.ok) {
          setLocalMessage(res.err || "Registration failed");
        }
      } catch (err) {
        console.error("AuthModal.register error", err);
        setLocalMessage("Registration error");
      } finally {
        setSubmitting(false);
      }
    };

    const submitLogin = async (ev) => {
      ev.preventDefault();
      setLocalMessage("");
      setSubmitting(true);
      try {
        const res = await onLogin(loginValues);
        if (!res.ok) {
          setLocalMessage(res.err || "Login failed");
        }
      } catch (err) {
        console.error("AuthModal.login error", err);
        setLocalMessage("Login error");
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <div className="auth-modal-container">
        <div className="auth-modal-glass">
          <div className="auth-modal-content">
            <div className="auth-modal-header">
              <div className="auth-logo">
                <img 
                  src={createEchosoulLogo(80)} 
                  alt="logo" 
                  className="auth-logo-image"
                />
                <div className="auth-logo-text">
                  <h1>EchoSoul- MindVault</h1>
                  <p className="auth-subtitle">Shape your AI personality</p>
                </div>
              </div>
            </div>

            <div className="auth-tabs-container">
              <div className="auth-tabs-header">
                <button 
                  className={`auth-tab ${localTab === "register" ? "active" : ""}`}
                  onClick={() => setLocalTab("register")}
                >
                  Create Account
                </button>
                <button 
                  className={`auth-tab ${localTab === "login" ? "active" : ""}`}
                  onClick={() => setLocalTab("login")}
                >
                  Sign In
                </button>
              </div>

              <div className="auth-form-container">
                {localTab === "register" ? (
                  <form onSubmit={submitRegister} className="auth-form">
                    <div className="form-group floating">
                      <input
                        id="reg-username"
                        type="text"
                        value={regValues.username}
                        onChange={(e) => setRegValues((s) => ({ ...s, username: e.target.value }))}
                        required
                        minLength={3}
                      />
                      <label htmlFor="reg-username">Username</label>
                    </div>

                    <div className="form-group floating">
                      <input
                        id="reg-email"
                        type="email"
                        value={regValues.email}
                        onChange={(e) => setRegValues((s) => ({ ...s, email: e.target.value }))}
                        required
                      />
                      <label htmlFor="reg-email">Email</label>
                    </div>

                    <div className="form-group floating">
                      <input
                        id="reg-password"
                        type="password"
                        value={regValues.password}
                        onChange={(e) => setRegValues((s) => ({ ...s, password: e.target.value }))}
                        required
                        minLength={8}
                      />
                      <label htmlFor="reg-password">Password</label>
                    </div>

                    <button type="submit" className="auth-submit-btn" disabled={submitting}>
                      {submitting ? (
                        <span className="auth-spinner"></span>
                      ) : (
                        "Create Account"
                      )}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={submitLogin} className="auth-form">
                    <div className="form-group floating">
                      <input
                        id="login-username"
                        type="text"
                        value={loginValues.username}
                        onChange={(e) => setLoginValues((s) => ({ ...s, username: e.target.value }))}
                        required
                      />
                      <label htmlFor="login-username">Username</label>
                    </div>

                    <div className="form-group floating">
                      <input
                        id="login-password"
                        type="password"
                        value={loginValues.password}
                        onChange={(e) => setLoginValues((s) => ({ ...s, password: e.target.value }))}
                        required
                      />
                      <label htmlFor="login-password">Password</label>
                    </div>

                    <button type="submit" className="auth-submit-btn" disabled={submitting}>
                      {submitting ? (
                        <span className="auth-spinner"></span>
                      ) : (
                        "Sign In"
                      )}
                    </button>
                  </form>
                )}

                {(localMessage || authMessage) && (
                  <div className={`auth-message ${localMessage.includes("success") || authMessage.includes("success") ? "success" : "error"}`}>
                    {localMessage || authMessage}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==================== TAB COMPONENTS ====================
  const DashboardTab = () => {
    return (
      <div className="dashboard-container">
        <div className="dashboard-header">
          <h2 className="dashboard-title">EchoSoul- Digital Consciousness</h2>
          <div className="dashboard-stats">
            <div className="stat-card">
              <div className="stat-icon knowledge">
                <svg viewBox="0 0 24 24">
                  <path d="M12 3L1 9l11 6 9-4.91V17h2V9M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z"/>
                </svg>
              </div>
              <div className="stat-content">
                <span className="stat-value">{safeNumber(userProfile?.knowledgeBase?.length) || 0}</span>
                <span className="stat-label">Knowledge Items</span>
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon deployment">
                <svg viewBox="0 0 24 24">
                  <path d="M12 2L4 7v10l8 5 8-5V7L12 2m0 2.5L18 9v6l-6 3.5L6 15V9l6-3.5M12 6L6 9l6 3 6-3-6-3z"/>
                </svg>
              </div>
              <div className="stat-content">
                <span className="stat-value">{userProfile?.deployed ? "Active" : "Inactive"}</span>
                <span className="stat-label">Deployment Status</span>
              </div>
            </div>
          </div>
        </div>

        <div className="profile-card">
          <div className="profile-avatar-container">
            <div className="profile-avatar">
              <img src={profilePicSrc} alt="Profile" className="avatar-image" />
              <label className="avatar-edit">
                <input type="file" accept="image/*" onChange={handleProfilePicChange} />
                <svg viewBox="0 0 24 24">
                  <path d="M20.71 7.04c.39-.39.39-1.04 0-1.41l-2.34-2.34c-.37-.39-1.02-.39-1.41 0l-1.84 1.83 3.75 3.75M3 17.25V21h3.75L17.81 9.93l-3.75-3.75L3 17.25z"/>
                </svg>
              </label>
            </div>
          </div>

          <div className="profile-info">
            <h3 className="profile-name">{userProfile?.username}</h3>
            <p className="profile-bio">{userProfile?.bio || "No bio yet. Add one in Settings."}</p>
            
            <div className="profile-actions">
              <button 
                className="action-btn primary" 
                onClick={getNextQuestion} 
                disabled={questionsLoading}
              >
                <svg viewBox="0 0 24 24" className="btn-icon">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                </svg>
                Train Now
              </button>

              <button
                className={`action-btn ${userProfile?.deployed ? "secondary" : "primary"}`}
                onClick={handleDeploy}
                disabled={userProfile?.deployed || deployLoading || safeNumber(userProfile?.knowledgeBase?.length) < 10}
                title={userProfile?.deployed ? "Already deployed" : undefined}
              >
                <svg viewBox="0 0 24 24" className="btn-icon">
                  <path d="M13 19v-4h3l-4-5-4 5h3v4h2m3-15v3h-1V5H9v2H8V4h8m-.9 15.5c0 .28.22.5.5.5s.5-.22.5-.5-.22-.5-.5-.5-.5.22-.5.5M13 10h-2V9h2v1m3-3h-8v11h8V7z"/>
                </svg>
                {userProfile?.deployed
                  ? "Deployed"
                  : safeNumber(userProfile?.knowledgeBase?.length) < 10
                    ? "Need 10 Answers"
                    : "Deploy System"}
              </button>
            </div>
          </div>
        </div>

        <div className="dashboard-grid">
          <div className="traits-card">
            <div className="card-header">
              <h3 className="card-title">
                <svg viewBox="0 0 24 24" className="card-icon">
                  <path d="M12 3a9 9 0 0 0-9 9c0 1.5.4 3 1.1 4.3.1.2.1.5 0 .8-.1.2-.3.4-.5.5l-2.5 2.5c-.4.4-.4 1 0 1.4.4.4 1 .4 1.4 0l2.5-2.5c.2-.2.4-.3.5-.5.3-.1.5-.1.8 0 1.3.8 2.8 1.1 4.3 1.1 5 0 9-4 9-9s-4-9-9-9m0 4c-.6 0-1 .4-1 1s.4 1 1 1 1-.4 1-1-.4-1-1-1m-4 0c-.6 0-1 .4-1 1s.4 1 1 1 1-.4 1-1-.4-1-1-1m8 0c-.6 0-1 .4-1 1s.4 1 1 1 1-.4 1-1-.4-1-1-1M7 12c-.6 0-1 .4-1 1s.4 1 1 1 1-.4 1-1-.4-1-1-1m10 0c-.6 0-1 .4-1 1s.4 1 1 1 1-.4 1-1-.4-1-1-1m-4 4c-.6 0-1 .4-1 1s.4 1 1 1 1-.4 1-1-.4-1-1-1z"/>
                </svg>
                Personality Traits
              </h3>
            </div>
            
            {userProfile?.traits?.length > 0 ? (
              <div className="traits-grid">
                {userProfile.traits.map((t, idx) => (
                  <div key={idx} className="trait-item">
                    <div className="trait-header">
                      <span className="trait-name">{t.name}</span>
                      <span className="trait-value">{safeNumber(t.strength)}/10</span>
                    </div>
                    <div className="progress-container">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${safeNumber(t.strength) * 10}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <svg viewBox="0 0 24 24" className="empty-icon">
                  <path d="M11 15h2v2h-2zm0-8h2v6h-2zm.99-5C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/>
                </svg>
                <p>Answer personality questions to develop your traits.</p>
              </div>
            )}
          </div>

          <div className="memories-card">
            <div className="card-header">
              <h3 className="card-title">
                <svg viewBox="0 0 24 24" className="card-icon">
                  <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15l-5-2.18L7 18V5h10v13z"/>
                </svg>
                Key Memories
              </h3>
            </div>
            
            {userProfile?.memories?.length > 0 ? (
              <div className="memories-list">
                {userProfile.memories.slice(0, 3).map((m, i) => (
                  <div key={i} className="memory-item">
                    <div className="memory-content">"{m.content}"</div>
                    <div className="memory-meta">
                      <span className={`memory-intensity intensity-${Math.min(5, Math.ceil(safeNumber(m.emotionalWeight) / 2))}`}>
                        <svg viewBox="0 0 24 24">
                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                        </svg>
                        {safeNumber(m.emotionalWeight)} intensity
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <svg viewBox="0 0 24 24" className="empty-icon">
                  <path d="M11 15h2v2h-2zm0-8h2v6h-2zm.99-5C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/>
                </svg>
                <p>Answer important questions to create memories.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const TrainingTab = () => {
    const renderImportanceStars = (importance) => {
      const numStars = safeNumber(importance) || 0;
      return (
        <span className="stars">
          {Array.from({ length: 5 }).map((_, i) => (
            <svg
              key={i}
              viewBox="0 0 24 24"
              className={`star ${i < numStars ? "filled" : ""}`}
            >
              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
            </svg>
          ))}
        </span>
      );
    };

    return (
      <div className="training-container">
        <div className="training-header">
          <h2 className="training-title">
            <svg viewBox="0 0 24 24" className="title-icon">
              <path d="M12 3L1 9l11 6 9-4.91V17h2V9M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z"/>
            </svg>
            Knowledge Training
          </h2>
          
          <div className="training-controls">
            <div className="search-container">
              <svg viewBox="0 0 24 24" className="search-icon">
                <path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 0 0 1.48-5.34c-.47-2.78-2.79-5-5.59-5.34a6.505 6.505 0 0 0-7.27 7.27c.34 2.8 2.56 5.12 5.34 5.59a6.5 6.5 0 0 0 5.34-1.48l.27.28v.79l4.25 4.25c.41.41 1.08.41 1.49 0 .41-.41.41-1.08 0-1.49L15.5 14zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
              </svg>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search questions..."
                className="search-input"
              />
            </div>

            <div className="select-container">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="category-select"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === "all" ? "All Categories" : cat}
                  </option>
                ))}
              </select>
              <svg viewBox="0 0 24 24" className="select-arrow">
                <path d="M7 10l5 5 5-5z"/>
              </svg>
            </div>

            <button
              className="random-question-btn"
              onClick={getNextQuestion}
              disabled={questionsLoading}
            >
              <svg viewBox="0 0 24 24" className="btn-icon">
                <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
              </svg>
              Random Question
            </button>
          </div>
        </div>

        {currentQuestion ? (
          <div className="question-card active">
            <div className="question-meta">
              <span className="category-badge">{currentQuestion.category || "General"}</span>
              <span className="importance-badge">
                Importance: {renderImportanceStars(currentQuestion.importance)}
              </span>
            </div>
            
            <h3 className="question-text">{currentQuestion.question}</h3>

            <form onSubmit={submitAnswer} className="answer-form">
              <div className="form-group floating">
                <textarea
                  id="answer-text"
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  required
                  rows={6}
                />
                <label htmlFor="answer-text">Your Answer</label>
              </div>

              <div className="form-actions">
                <button
                  className="submit-btn primary"
                  type="submit"
                  disabled={submitAnswerLoading || !answerText.trim()}
                >
                  {submitAnswerLoading ? (
                    <span className="btn-spinner"></span>
                  ) : (
                    "Submit Answer"
                  )}
                </button>

                <button
                  className="submit-btn secondary"
                  type="button"
                  onClick={() => setCurrentQuestion(null)}
                  disabled={submitAnswerLoading}
                >
                  Skip Question
                </button>
              </div>
            </form>
          </div>
        ) : (
          <>
            <div className="questions-container">
              <h3 className="questions-header">Available Questions ({filteredQuestions.length})</h3>
              
              {filteredQuestions.length > 0 ? (
                <div className="questions-grid">
                  {filteredQuestions.map((q) => (
                    <div
                      key={String(safeNumber(q.id)) + q.question}
                      className="question-card"
                      onClick={() => setCurrentQuestion(q)}
                    >
                      <div className="question-meta">
                        <span className="category">{q.category || "General"}</span>
                        <span className="importance">{renderImportanceStars(q.importance)}</span>
                      </div>
                      <p className="question-text">{q.question}</p>
                      <div className="question-actions">
                        <button
                          className="answer-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentQuestion(q);
                          }}
                        >
                          <svg viewBox="0 0 24 24">
                            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                          </svg>
                          Answer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <svg viewBox="0 0 24 24" className="empty-icon">
                    <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
                  </svg>
                  <p>No questions match your filters.</p>
                  <button
                    className="clear-filters-btn"
                    onClick={() => {
                      setSearchTerm("");
                      setSelectedCategory("all");
                    }}
                  >
                    Clear Filters
                  </button>
                </div>
              )}
            </div>

            <div className="custom-question-card">
              <h3 className="custom-question-header">
                <svg viewBox="0 0 24 24" className="header-icon">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
                Add Custom Question
              </h3>
              
              <form onSubmit={handleAddCustomQuestion} className="custom-question-form">
                <div className="form-group floating">
                  <textarea
                    id="custom-question"
                    value={customQuestionText}
                    onChange={(e) => setCustomQuestionText(e.target.value)}
                    required
                    rows={3}
                  />
                  <label htmlFor="custom-question">Question Text</label>
                </div>

                <div className="form-row">
                  <div className="form-group floating">
                    <input
                      id="custom-category"
                      type="text"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                    />
                    <label htmlFor="custom-category">Category (optional)</label>
                  </div>

                  <div className="form-group">
                    <label className="importance-label">Importance</label>
                    <div className="importance-selector">
                      <input
                        type="range"
                        min="1"
                        max="5"
                        value={customImportance}
                        onChange={(e) => setCustomImportance(e.target.value)}
                        className="importance-slider"
                      />
                      {/* <div className="importance-value">
                        {renderImportanceStars(customImportance)}
                      </div> */}
                    </div>
                  </div>
                </div>

                <button
                  className="add-question-btn"
                  type="submit"
                  disabled={addingQuestionLoading || !customQuestionText.trim()}
                >
                  {addingQuestionLoading ? (
                    <span className="btn-spinner"></span>
                  ) : (
                    "Add Question"
                  )}
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    );
  };

  const SystemsTab = () => {
    const displayPrincipal = (principal) => {
      try {
        if (!principal) return "unknown";
        if (typeof principal === "string") return principal.slice(0, 8) + "...";
        return principal.toString().slice(0, 8) + "...";
      } catch (e) {
        return "unknown";
      }
    };

    const formatTime = (timestamp) => {
      if (!timestamp) return "";
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
      <div className="systems-container">
        <div className="systems-header">
          <h2 className="systems-title">
            <svg viewBox="0 0 24 24" className="title-icon">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm4.59-12.42L10 14.17l-2.59-2.58L6 13l4 4 8-8z"/>
            </svg>
            Digital Consciousness Network
          </h2>
          
          <button
            className="refresh-btn"
            onClick={fetchDeployedSystems}
            disabled={deployLoading}
          >
            <svg viewBox="0 0 24 24" className="btn-icon">
              <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
            </svg>
            Refresh
          </button>
        </div>

        <div className="systems-content">
          <div className="systems-list">
            <div className="list-header">
              <h3>Available Systems ({deployedSystems.length})</h3>
            </div>
            
            {deployedSystems.length > 0 ? (
              <div className="systems-grid">
                {deployedSystems.map((s, i) => (
                  <div
                    key={i}
                    className={`system-card ${selectedSystem?.ownerId === s.ownerId ? "active" : ""}`}
                    onClick={() => pickSystem(s)}
                  >
                    <div className="system-avatar">
                      <img src={generateInitialAvatar(s.username, 48)} alt={s.username} />
                    </div>
                    <div className="system-info">
                      <h4 className="system-name">{s.username}</h4>
                      <p className="system-id">ID: {displayPrincipal(s.ownerId)}</p>
                    </div>
                    <div className="system-action">
                      <svg viewBox="0 0 24 24">
                        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <svg viewBox="0 0 24 24" className="empty-icon">
                  <path d="M23 12l-2.44-2.79.34-3.69-3.61-.82-1.89-3.2L12 2.96 8.6 1.5 6.71 4.69 3.1 5.5l.34 3.7L1 12l2.44 2.79-.34 3.7 3.61.82 1.89 3.2L12 21.04l3.4 1.47 1.89-3.2 3.61-.82-.34-3.7L23 12zm-12.91 4.72l-3.8-3.81 1.48-1.48 2.32 2.33 5.85-5.87 1.48 1.48-7.33 7.35z"/>
                </svg>
                <p>No deployed systems found in the network</p>
              </div>
            )}
          </div>

          <div className="chat-interface">
            {selectedSystem ? (
              <>
                <div className="chat-header">
                  <div className="chat-partner">
                    <div className="partner-avatar">
                      <img src={generateInitialAvatar(selectedSystem.username, 48)} alt={selectedSystem.username} />
                    </div>
                    <div className="partner-info">
                      <h3 className="partner-name">{selectedSystem.username}</h3>
                      <p className="partner-id">ID: {displayPrincipal(selectedSystem.ownerId)}</p>
                    </div>
                  </div>
                  <button
                    className="close-chat-btn"
                    onClick={() => setSelectedSystem(null)}
                  >
                    <svg viewBox="0 0 24 24">
                      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                  </button>
                </div>

                <div className="chat-messages">
                  {chatHistory.length > 0 ? (
                    chatHistory.map((m, i) => (
                      <div
                        key={i}
                        className={`message ${m.fromMe ? "outgoing" : "incoming"}`}
                      >
                        <div className="message-content">
                          <div className="message-text">{m.text}</div>
                          <div className="message-time">{formatTime(m.timestamp)}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="empty-chat">
                      <svg viewBox="0 0 24 24" className="empty-icon">
                        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
                      </svg>
                      <p>Start a conversation with this digital consciousness</p>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <form onSubmit={sendChat} className="chat-input-container">
                  <input
                    type="text"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    placeholder="Type your message here..."
                    required
                    disabled={chatLoading}
                    className="chat-input"
                  />
                  <button
                    type="submit"
                    className="send-btn"
                    disabled={chatLoading || !chatMessage.trim()}
                  >
                    {chatLoading ? (
                      <span className="btn-spinner"></span>
                    ) : (
                      <svg viewBox="0 0 24 24">
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                      </svg>
                    )}
                  </button>
                </form>
              </>
            ) : (
              <div className="chat-placeholder">
                <svg viewBox="0 0 24 24" className="placeholder-icon">
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
                </svg>
                <h3>Select a System to Chat</h3>
                <p>Choose from the list of deployed digital consciousnesses to start a conversation</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const SettingsTab = () => (
    <div className="settings-container">
      <h2 className="settings-title">
        <svg viewBox="0 0 24 24" className="title-icon">
          <path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/>
        </svg>
        Profile Settings
      </h2>

      <form onSubmit={handleUpdateProfile} className="profile-form">
        <div className="form-section">
          <div className="avatar-section">
            <label className="avatar-label">Profile Picture</label>
            <div className="avatar-container">
              <div className="avatar-preview">
                <img src={profilePicSrc} alt="Current" className="avatar-image" />
              </div>
              <label className="avatar-upload-btn">
                <input type="file" accept="image/*" onChange={handleProfilePicChange} />
                <svg viewBox="0 0 24 24" className="upload-icon">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
                Change Photo
              </label>
            </div>
          </div>

          <div className="bio-section">
            <div className="form-group floating">
              <textarea
                id="bio-text"
                value={bioText}
                onChange={(e) => setBioText(e.target.value)}
                rows="6"
                maxLength={500}
              />
              <label htmlFor="bio-text">Bio</label>
              <div className="char-counter">{bioText.length}/500</div>
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="save-btn" disabled={profileLoading}>
            {profileLoading ? (
              <span className="btn-spinner"></span>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </form>

      <div className="account-info">
        <h3 className="info-title">
          <svg viewBox="0 0 24 24" className="title-icon">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
          </svg>
          Account Information
        </h3>
        
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">Username:</span>
            <span className="info-value">{userProfile?.username}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Email:</span>
            <span className="info-value">{userProfile?.email}</span>
          </div>
          <div className="info-item">
            <span className="info-label">System ID:</span>
            <span className="info-value">
              {typeof userProfile?.id === "string"
                ? userProfile.id.slice(0, 12) + "..."
                : userProfile?.id
                  ? userProfile.id.toString().slice(0, 12) + "..."
                  : "-"}
            </span>
          </div>
        </div>
      </div>

      <div className="danger-zone">
        <h3 className="danger-title">
          <svg viewBox="0 0 24 24" className="title-icon">
            <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3zm-1.06 13.54L7.4 12l1.41-1.41 2.12 2.12 4.24-4.24 1.41 1.41-5.64 5.66z"/>
          </svg>
          Danger Zone
        </h3>
        <p className="danger-warning">These actions are irreversible. Proceed with caution.</p>
        
        <div className="danger-actions">
          <button className="logout-btn" onClick={handleLogout}>
            <svg viewBox="0 0 24 24" className="btn-icon">
              <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
            </svg>
            Logout
          </button>
        </div>
      </div>
    </div>
  );

  // ==================== MAIN RENDER ====================
  return (
    <div className="app-container">
      {/* Loading overlay */}
      {initialLoading && (
        <div className="loading-overlay">
          <div className="loading-content">
            <div className="loading-spinner">
              <div className="spinner-circle"></div>
            </div>
            <p>Initializing Digital Consciousness...</p>
          </div>
        </div>
      )}

      {/* Authentication modal */}
      {!isAuthenticated ? (
        <AuthModal
          onRegister={async ({ username, email, password }) => {
            setAuthOperationLoading(true);
            const res = await registerUser({ username, email, password });
            setAuthOperationLoading(false);
            return res;
          }}
          onLogin={async ({ username, password }) => {
            setAuthOperationLoading(true);
            const res = await loginUser({ username, password });
            setAuthOperationLoading(false);
            return res;
          }}
        />
      ) : (
        <>
          {/* Main app layout */}
          <header className="app-header">
            <div className="header-content">
              <div className="logo-container">
                <img 
                  src={createEchosoulLogo(40)} 
                  alt="logo" 
                  className="logo-image"
                />
                <h1 className="logo-text">Digital Consciousness</h1>
              </div>

              <nav className="main-nav">


<button 
  className={`nav-btn ${activeTab === "dashboard" ? "active" : ""}`}
  onClick={() => setActiveTab("dashboard")}
>
  <svg viewBox="0 0 24 24" className="nav-icon">
    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
  </svg>
  Dashboard
</button>

<button 
  className={`nav-btn ${activeTab === "training" ? "active" : ""}`}
  onClick={() => setActiveTab("training")}
>
  <svg viewBox="0 0 24 24" className="nav-icon">
    <path d="M12 3L1 9l11 6 9-4.91V17h2V9M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z"/>
  </svg>
  Training
</button>

<button 
  className={`nav-btn ${activeTab === "systems" ? "active" : ""}`}
  onClick={() => setActiveTab("systems")}
>
  <svg viewBox="0 0 24 24" className="nav-icon">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm4.59-12.42L10 14.17l-2.59-2.58L6 13l4 4 8-8z"/>
  </svg>
  Systems
</button>

<button 
  className={`nav-btn ${activeTab === "ai" ? "active" : ""}`}
  onClick={() => setActiveTab("ai")}
  disabled
  title="Coming soon"
>
  <svg viewBox="0 0 24 24" className="nav-icon">
    <path d="M21 11.5c0 4.14-3.36 7.5-7.5 7.5-1.04 0-2.04-.21-2.95-.6l-4.16 2.37.35-4.14C5.3 14.78 5 13.17 5 11.5 5 7.36 8.36 4 12.5 4c3.09 0 5.72 1.93 6.8 4.64l2.2-.84C20.2 4.85 16.66 2 12.5 2 6.98 2 2.5 6.48 2.5 12S6.98 22 12.5 22c1.5 0 2.92-.3 4.21-.85l2.94 1.67-.75-4.67c1.6-1.39 2.6-3.41 2.6-5.65z"/>
  </svg>
  Echosoul AI
  <span className="coming-soon-badge">Soon</span>
</button>

<button 
  className={`nav-btn ${activeTab === "savings" ? "active" : ""}`}
  onClick={() => setActiveTab("savings")}
  disabled
  title="Coming soon"
>
  <svg viewBox="0 0 24 24" className="nav-icon">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H10.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.39-2.1 1.39-1.6 0-2.23-.72-2.32-1.64H8.04c.1 1.7 1.36 2.66 2.86 2.97V19h2.34v-1.67c1.52-.29 2.72-1.16 2.73-2.77-.01-2.2-1.9-2.96-3.66-3.42z"/>
  </svg>
  Savings
  <span className="coming-soon-badge">Soon</span>
</button>

<button 
  className={`nav-btn ${activeTab === "settings" ? "active" : ""}`}
  onClick={() => setActiveTab("settings")}
>
  <svg viewBox="0 0 24 24" className="nav-icon">
    <path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/>
  </svg>
  Settings
</button>

              </nav>

              <div className="user-controls">
                <div className="user-profile">
                  <div className="user-avatar">
                    <img src={profilePicSrc} alt="Profile" />
                  </div>
                  <span className="user-name">{userProfile?.username}</span>
                </div>
                <button className="logout-btn" onClick={handleLogout}>
                  <svg viewBox="0 0 24 24">
                    <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
                  </svg>
                </button>
              </div>
            </div>
          </header>

          <main className="app-main">
            {authMessage && (
              <div className={`global-message ${authMessage.includes("success") ? "success" : "error"}`}>
                <div className="message-content">
                  {authMessage}
                  <button className="close-btn" onClick={() => setAuthMessage("")}>
                    <svg viewBox="0 0 24 24">
                      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {activeTab === "dashboard" && <DashboardTab />}
            {activeTab === "training" && <TrainingTab />}
            {activeTab === "systems" && <SystemsTab />}
            {activeTab === "settings" && <SettingsTab />}
          </main>

      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <span className="footer-icon">♾️</span>
            <span>Echosoul • Digital Consciousness</span>
          </div>
          <div className="footer-links">
            <a href="#privacy" className="footer-link">Privacy</a>
            <span className="footer-divider">|</span>
            <a href="#terms" className="footer-link">Terms</a>
            <span className="footer-divider">|</span>
            <a href="#contact" className="footer-link">Contact</a>
          </div>
        </div>
      </footer>


        </>
      )}
    </div>
  );
}