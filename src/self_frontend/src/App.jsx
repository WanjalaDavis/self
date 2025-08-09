// Cleaned App.jsx — formatting and minor punctuation fixes only
// No feature changes were made — just consistent semicolons, indentation,
// and small safety guards where accessing nested properties in render.

import React, { useState, useEffect, useRef } from "react";
import { Principal } from "@dfinity/principal";
import { self_backend } from "../../declarations/self_backend";
import "./index.scss";

// Helper functions with BigInt support
const isOk = (res) => res && Object.prototype.hasOwnProperty.call(res, "ok");
const getErr = (res) => (res && res.err) || (res && res["err"]) || null;
const getOk = (res) => (res && res.ok) || (res && res["ok"]) || null;

function arrayBufferToBase64(buffer) {
  if (!buffer) return null;
  const u8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < u8.length; i++) {
    binary += String.fromCharCode(u8[i]);
  }
  return window.btoa(binary);
}

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Helper to safely convert BigInt to Number for display purposes
const safeNumber = (value) => {
  if (typeof value === "bigint") {
    return Number(value);
  }
  return value;
};

export default function App() {
  // Auth & user state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [authMessage, setAuthMessage] = useState("");
  const [activeTab, setActiveTab] = useState("dashboard");

  // Forms state
  const [regForm, setRegForm] = useState({ username: "", email: "", password: "" });
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });

  // Training state
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [answerText, setAnswerText] = useState("");
  const [customQuestionText, setCustomQuestionText] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [customImportance, setCustomImportance] = useState(3);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // Systems state
  const [deployedSystems, setDeployedSystems] = useState([]);
  const [selectedSystem, setSelectedSystem] = useState(null);
  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState([]);

  // Profile settings state
  const [bioText, setBioText] = useState("");
  const [profilePicFile, setProfilePicFile] = useState(null);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef(null);

  // Initialize app
  useEffect(() => {
    const bootstrap = async () => {
      setIsLoading(true);
      try {
        const res = await self_backend.getDashboard();
        if (isOk(res)) {
          const user = getOk(res);
          setUserProfile(user);
          setIsAuthenticated(true);
          setBioText(user?.bio || "");
        }
      } catch (err) {
        console.warn("bootstrap dashboard failed", err);
      }

      await refreshQuestions();
      await fetchDeployedSystems();
      setIsLoading(false);
    };

    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  // ========== AUTHENTICATION HANDLERS ==========
  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthMessage("");
    setIsLoading(true);
    try {
      const res = await self_backend.register(regForm.username, regForm.email, regForm.password);
      if (isOk(res)) {
        const user = getOk(res);
        setUserProfile(user);
        setIsAuthenticated(true);
        setAuthMessage("Registered and logged in.");
      } else {
        setAuthMessage(getErr(res) || "Registration failed");
      }
    } catch (err) {
      console.error(err);
      setAuthMessage(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthMessage("");
    setIsLoading(true);
    try {
      const res = await self_backend.login(loginForm.username, loginForm.password);
      if (isOk(res)) {
        const user = getOk(res);
        setUserProfile(user);
        setIsAuthenticated(true);
        setAuthMessage("Login successful");
      } else {
        setAuthMessage(getErr(res) || "Login failed");
      }
    } catch (err) {
      console.error(err);
      setAuthMessage(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setUserProfile(null);
    setIsAuthenticated(false);
    setAuthMessage("");
    setCurrentQuestion(null);
    setAnswerText("");
    setActiveTab("dashboard");
  };

  // ========== PROFILE HANDLERS ==========
  const refreshDashboard = async () => {
    setIsLoading(true);
    try {
      const res = await self_backend.getDashboard();
      if (isOk(res)) {
        setUserProfile(getOk(res));
      } else {
        console.warn("getDashboard err", getErr(res));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

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
    setIsLoading(true);
    try {
      let pic = null;
      if (profilePicFile) {
        const arrayBuffer = await profilePicFile.arrayBuffer();
        pic = new Uint8Array(arrayBuffer);
      }
      const res = await self_backend.updateProfile(bioText ? bioText : null, pic ? pic : null);
      if (isOk(res)) {
        await refreshDashboard();
        alert("Profile updated successfully");
      } else {
        alert(getErr(res) || "Profile update failed");
      }
    } catch (err) {
      console.error(err);
      alert(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const profilePicToDataUrl = (profilePic) => {
    if (!profilePic) return null;
    try {
      const base64 = arrayBufferToBase64(profilePic);
      return base64 ? `data:image/png;base64,${base64}` : null;
    } catch (e) {
      console.warn("profilePicToDataUrl failed", e);
      return null;
    }
  };

  // ========== TRAINING HANDLERS ==========
  const refreshQuestions = async () => {
    setIsLoading(true);
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
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const getNextQuestion = async () => {
    setIsLoading(true);
    try {
      const res = await self_backend.getNextQuestion();
      if (isOk(res)) {
        setCurrentQuestion(getOk(res));
        setAnswerText("");
      } else {
        alert(getErr(res) || "No next question available");
      }
    } catch (err) {
      console.error(err);
      alert(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const submitAnswer = async (e) => {
    e.preventDefault();
    if (!currentQuestion) return alert("No question selected");
    setIsLoading(true);
    try {
      const res = await self_backend.submitAnswer(safeNumber(currentQuestion.id), answerText);
      if (isOk(res)) {
        alert("Answer submitted successfully");
        await refreshDashboard();
        setCurrentQuestion(null);
      } else {
        alert(getErr(res) || "Submit failed");
      }
    } catch (err) {
      console.error(err);
      alert(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddCustomQuestion = async (e) => {
    e.preventDefault();
    if (!customQuestionText.trim()) return alert("Question text is required");
    setIsLoading(true);
    try {
      const res = await self_backend.addCustomQuestion(customQuestionText, customCategory, Number(customImportance));
      if (isOk(res)) {
        alert("Custom question added successfully");
        setCustomQuestionText("");
        setCustomCategory("");
        setCustomImportance(3);
        await refreshQuestions();
      } else {
        alert(getErr(res) || "Failed to add custom question");
      }
    } catch (err) {
      console.error(err);
      alert("Error adding question: " + (err?.message || String(err)));
    } finally {
      setIsLoading(false);
    }
  };

  // Filter questions based on selected category and search term
  const filteredQuestions = questions.filter((q) => {
    const matchesCategory = selectedCategory === "all" || q.category === selectedCategory;
    const matchesSearch = (q.question || "").toLowerCase().includes((debouncedSearchTerm || "").toLowerCase()) ||
      (q.category && q.category.toLowerCase().includes((debouncedSearchTerm || "").toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  // Get unique categories for filter dropdown
  const categories = ["all", ...new Set(questions.map((q) => q.category).filter(Boolean))];

  // ========== SYSTEMS HANDLERS ==========
  const handleDeploy = async () => {
    if (!window.confirm("Deploying your system will make it available to others. Continue?")) return;
    setIsLoading(true);
    try {
      const res = await self_backend.deploySystem();
      if (isOk(res)) {
        alert("System deployed successfully");
        await refreshDashboard();
        await fetchDeployedSystems();
      } else {
        alert(getErr(res) || "Deploy failed");
      }
    } catch (err) {
      console.error(err);
      alert(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDeployedSystems = async () => {
    setIsLoading(true);
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
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const pickSystem = (system) => {
    setSelectedSystem(system);
    setChatHistory([]);
    setChatMessage("");
  };

  const sendChat = async (e) => {
    e.preventDefault();
    if (!selectedSystem) return alert("Select a deployed system first");
    if (!chatMessage.trim()) return alert("Please enter a message");

    setIsLoading(true);
    try {
      let owner = selectedSystem.ownerId;
      if (typeof owner === "string") {
        try {
          owner = Principal.fromText(owner);
        } catch (e) {
          // keep as string if cannot parse
        }
      }

      const res = await self_backend.chatWithSystem(owner, chatMessage);
      if (isOk(res)) {
        const reply = getOk(res);
        setChatHistory((h) => [
          ...h,
          { fromMe: true, text: chatMessage },
          { fromMe: false, text: reply },
        ]);
        setChatMessage("");
      } else {
        alert(getErr(res) || "Chat failed");
      }
    } catch (err) {
      console.error(err);
      alert(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  // ========== COMPONENTS ==========
  const AuthModal = () => (
    <div className="modal-overlay">
      <div className="auth-modal">
        <div className="auth-header">
          <h1>Welcome to Digital Consciousness</h1>
          <p className="subtitle">Create your unique AI personality</p>
        </div>

        <div className="auth-tabs">
          <div className="tab active">
            <h2>Register</h2>
            <form onSubmit={handleRegister} className="form">
              <div className="form-group">
                <label>Username</label>
                <input
                  value={regForm.username}
                  onChange={(e) => setRegForm({ ...regForm, username: e.target.value })}
                  placeholder="Choose a username"
                  required
                  minLength={3}
                />
              </div>

              <div className="form-group">
                <label>Email</label>
                <input
                  value={regForm.email}
                  onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                  placeholder="Your email address"
                  type="email"
                  required
                />
              </div>

              <div className="form-group">
                <label>Password</label>
                <input
                  value={regForm.password}
                  onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                  placeholder="Create a password"
                  type="password"
                  required
                  minLength={8}
                />
              </div>

              <button className="btn primary" type="submit" disabled={isLoading}>
                {isLoading ? "Registering..." : "Register"}
              </button>
            </form>
          </div>

          <div className="tab">
            <h2>Login</h2>
            <form onSubmit={handleLogin} className="form">
              <div className="form-group">
                <label>Username</label>
                <input
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                  placeholder="Your username"
                  required
                />
              </div>

              <div className="form-group">
                <label>Password</label>
                <input
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  placeholder="Your password"
                  type="password"
                  required
                />
              </div>

              <button className="btn primary" type="submit" disabled={isLoading}>
                {isLoading ? "Logging in..." : "Login"}
              </button>
            </form>
          </div>
        </div>

        {authMessage && (
          <div className={`auth-message ${authMessage.includes("success") ? "success" : "error"}`}>
            {authMessage}
          </div>
        )}
      </div>
    </div>
  );

  const DashboardTab = () => (
    <div className="dashboard-tab">
      <h2>Your Digital Consciousness</h2>

      <div className="profile-summary">
        <div className="profile-pic">
          {userProfile?.profilePic ? (
            <img alt="profile" src={profilePicToDataUrl(userProfile.profilePic)} />
          ) : (
            <div className="placeholder">
              <i className="fas fa-user" />
            </div>
          )}
        </div>

        <div className="profile-info">
          <h3>{userProfile?.username}</h3>
          <p className="bio">{userProfile?.bio || "No bio yet"}</p>
          <div className="stats">
            <div className="stat-item">
              <i className="fas fa-brain" />
              <span>{safeNumber(userProfile?.knowledgeBase?.length) || 0} answers</span>
            </div>
            <div className="stat-item">
              <i className="fas fa-robot" />
              <span>{userProfile?.deployed ? "System Deployed" : "System Not Deployed"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-actions">
        <button className="btn primary" onClick={getNextQuestion} disabled={isLoading}>
          <i className="fas fa-question-circle" /> Train with Next Question
        </button>
        <button
          className={`btn ${userProfile?.deployed ? "secondary" : "primary"}`}
          onClick={handleDeploy}
          disabled={userProfile?.deployed || isLoading || safeNumber(userProfile?.knowledgeBase?.length) < 10}
        >
          <i className="fas fa-rocket" />
          {userProfile?.deployed
            ? "Already Deployed"
            : safeNumber(userProfile?.knowledgeBase?.length) < 10
            ? "Need 10 Answers"
            : "Deploy Your System"}
        </button>
      </div>

      <div className="dashboard-sections">
        <div className="section card">
          <h3>
            <i className="fas fa-user-tag" /> Personality Traits
          </h3>
          {userProfile?.traits?.length > 0 ? (
            <ul className="traits-list">
              {userProfile.traits.map((t, idx) => (
                <li key={idx}>
                  <div className="trait-name">{t.name}</div>
                  <div className="trait-strength">
                    <div className="strength-bar" style={{ width: `${safeNumber(t.strength) * 10}%` }} />
                    <span>{safeNumber(t.strength)}/10</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">No traits yet. Answer personality questions to develop your traits.</p>
          )}
        </div>

        <div className="section card">
          <h3>
            <i className="fas fa-memory" /> Key Memories
          </h3>
          {userProfile?.memories?.length > 0 ? (
            <ul className="memories-list">
              {userProfile.memories.map((m, i) => (
                <li key={i} className="memory-item">
                  <div className="memory-content">"{m.content}"</div>
                  <div className="memory-weight">
                    Emotional weight:
                    <span className={`weight-${Math.min(5, Math.ceil(safeNumber(m.emotionalWeight) / 2))}`}>
                      {safeNumber(m.emotionalWeight)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">No significant memories yet. Answer important questions to create memories.</p>
          )}
        </div>
      </div>
    </div>
  );

  const TrainingTab = () => {
    // Helper function to safely render importance stars
    const renderImportanceStars = (importance) => {
      const numStars = safeNumber(importance);
      return "★".repeat(Math.max(0, Math.min(5, numStars)));
    };

    return (
      <div className="training-tab">
        <div className="training-header">
          <h2>
            <i className="fas fa-graduation-cap" /> Knowledge Training
          </h2>
          <div className="training-controls">
            <button className="btn secondary" onClick={refreshQuestions} disabled={isLoading}>
              <i className="fas fa-sync-alt" /> Refresh
            </button>
            <button className="btn primary" onClick={getNextQuestion} disabled={isLoading}>
              <i className="fas fa-random" /> Random Question
            </button>
          </div>
        </div>

        {currentQuestion ? (
          <div className="current-question-card card">
            <div className="question-meta">
              <span className="category-badge">{currentQuestion.category || "General"}</span>
              <span className="importance-badge">Importance: {renderImportanceStars(currentQuestion.importance)}</span>
            </div>
            <h3>{currentQuestion.question}</h3>
            <form onSubmit={submitAnswer} className="answer-form">
              <div className="form-group">
                <label>Your Answer</label>
                <textarea
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  placeholder="Type your thoughtful answer here..."
                  required
                  rows={5}
                />
              </div>
              <div className="form-actions">
                <button className="btn primary" type="submit" disabled={isLoading || !answerText.trim()}>
                  {isLoading ? "Submitting..." : "Submit Answer"}
                </button>
                <button
                  className="btn secondary"
                  type="button"
                  onClick={() => setCurrentQuestion(null)}
                  disabled={isLoading}
                >
                  Skip Question
                </button>
              </div>
            </form>
          </div>
        ) : (
          <>
            <div className="question-filters card">
              <div className="filter-group">
                <label htmlFor="category-filter">Filter by Category:</label>
                <select id="category-filter" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat === "all" ? "All Categories" : cat}
                    </option>
                  ))}
                </select>
              </div>
              <div className="filter-group">
                <label htmlFor="search-questions">Search Questions:</label>
                <input
                  id="search-questions"
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search questions or categories..."
                />
              </div>
            </div>

            <div className="question-list-container">
              <h3>Available Questions ({filteredQuestions.length})</h3>
              {filteredQuestions.length > 0 ? (
                <div className="questions-grid">
                  {filteredQuestions.map((q) => (
                    <div key={safeNumber(q.id)} className="question-card" onClick={() => setCurrentQuestion(q)}>
                      <div className="question-meta">
                        <span className="category">{q.category || "General"}</span>
                        <span className="importance">{renderImportanceStars(q.importance)}</span>
                      </div>
                      <p className="question-text">{q.question}</p>
                      <button
                        className="btn small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentQuestion(q);
                        }}
                      >
                        Answer This
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state card">
                  <p>No questions match your filters.</p>
                  {searchTerm && (
                    <button
                      className="btn secondary small"
                      onClick={() => {
                        setSearchTerm("");
                        setSelectedCategory("all");
                      }}
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        <div className="custom-question-form card">
          <h3>
            <i className="fas fa-plus-circle" /> Add Your Own Question
          </h3>
          <form onSubmit={handleAddCustomQuestion}>
            <div className="form-group">
              <label>Question Text</label>
              <textarea
                value={customQuestionText}
                onChange={(e) => setCustomQuestionText(e.target.value)}
                placeholder="What would you like to be asked about?"
                required
                rows={3}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Category (optional)</label>
                <input
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="e.g. Philosophy, Technology, Personal"
                />
              </div>

              <div className="form-group">
                <label>Importance: {customImportance}</label>
                <div className="importance-selector">
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={customImportance}
                    onChange={(e) => setCustomImportance(e.target.value)}
                  />
                  <div className="importance-labels">
                    <span>Low</span>
                    <span>High</span>
                  </div>
                </div>
              </div>
            </div>

            <button className="btn primary" type="submit" disabled={isLoading || !customQuestionText.trim()}>
              {isLoading ? "Adding..." : "Add Question"}
            </button>
          </form>
        </div>
      </div>
    );
  };

  const SystemsTab = () => {
    // Helper function to safely display Principal
    const displayPrincipal = (principal) => {
      try {
        if (typeof principal === "string") {
          return principal.slice(0, 8) + "...";
        }
        return principal.toString().slice(0, 8) + "...";
      } catch (e) {
        return "unknown";
      }
    };

    return (
      <div className="systems-tab">
        <div className="systems-header">
          <h2>
            <i className="fas fa-network-wired" /> Digital Consciousness Network
          </h2>
          <button className="btn secondary" onClick={fetchDeployedSystems} disabled={isLoading}>
            <i className="fas fa-sync-alt" /> Refresh
          </button>
        </div>

        <div className="systems-container">
          <div className="systems-list card">
            <h3>Available Systems ({deployedSystems.length})</h3>
            {deployedSystems.length > 0 ? (
              <ul>
                {deployedSystems.map((s, i) => (
                  <li
                    key={i}
                    className={`system-item ${selectedSystem?.ownerId === s.ownerId ? "active" : ""}`}
                    onClick={() => pickSystem(s)}
                  >
                    <div className="system-avatar">{s.username.charAt(0).toUpperCase()}</div>
                    <div className="system-info">
                      <strong>{s.username}</strong>
                      <small>ID: {displayPrincipal(s.ownerId)}</small>
                    </div>
                    <div className="system-action">
                      <i className="fas fa-comments" />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-state">No deployed systems found in the network</p>
            )}
          </div>

          <div className="chat-container">
            {selectedSystem ? (
              <div className="chat-interface card">
                <div className="chat-header">
                  <h3>
                    <i className="fas fa-comment-dots" /> Chat with {selectedSystem.username}
                  </h3>
                  <button className="btn small secondary" onClick={() => setSelectedSystem(null)}>
                    <i className="fas fa-times" />
                  </button>
                </div>

                <div className="chat-history">
                  {chatHistory.length > 0 ? (
                    chatHistory.map((m, i) => (
                      <div key={i} className={`message ${m.fromMe ? "outgoing" : "incoming"}`}>
                        <div className="message-content">{m.text}</div>
                        <div className="message-meta">{m.fromMe ? "You" : selectedSystem.username}</div>
                      </div>
                    ))
                  ) : (
                    <div className="empty-chat">
                      <i className="fas fa-comment-slash" />
                      <p>Start a conversation with this digital consciousness</p>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <form onSubmit={sendChat} className="chat-input">
                  <input
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    placeholder="Type your message here..."
                    required
                    disabled={isLoading}
                  />
                  <button className="btn primary" type="submit" disabled={isLoading || !chatMessage.trim()}>
                    {isLoading ? "Sending..." : "Send"}
                  </button>
                </form>
              </div>
            ) : (
              <div className="chat-placeholder card">
                <div className="placeholder-content">
                  <i className="fas fa-robot" />
                  <h3>Select a System to Chat</h3>
                  <p>Choose from the list of deployed digital consciousnesses to start a conversation</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const SettingsTab = () => (
    <div className="settings-tab">
      <h2>
        <i className="fas fa-user-cog" /> Profile Settings
      </h2>

      <form onSubmit={handleUpdateProfile} className="profile-form card">
        <div className="form-row">
          <div className="form-group">
            <label>Profile Picture</label>
            <div className="profile-pic-upload">
              <div className="profile-pic-preview">
                {profilePicFile ? (
                  <img src={URL.createObjectURL(profilePicFile)} alt="Preview" />
                ) : userProfile?.profilePic ? (
                  <img src={profilePicToDataUrl(userProfile.profilePic)} alt="Current" />
                ) : (
                  <div className="placeholder">
                    <i className="fas fa-user" />
                  </div>
                )}
              </div>
              <label className="file-upload-btn">
                <input type="file" accept="image/*" onChange={handleProfilePicChange} />
                <span className="btn secondary">
                  <i className="fas fa-camera" /> Change Photo
                </span>
              </label>
            </div>
          </div>

          <div className="form-group bio-group">
            <label>Bio</label>
            <textarea
              value={bioText}
              onChange={(e) => setBioText(e.target.value)}
              placeholder="Describe yourself, your interests, and what makes you unique..."
              rows="6"
              maxLength={500}
            />
            <div className="char-count">{bioText.length}/500</div>
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn primary" disabled={isLoading}>
            {isLoading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>

      <div className="account-section card">
        <h3>
          <i className="fas fa-id-card" /> Account Information
        </h3>
        <div className="account-details">
          <div className="detail-item">
            <span className="detail-label">Username:</span>
            <span className="detail-value">{userProfile?.username}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Email:</span>
            <span className="detail-value">{userProfile?.email}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">System ID:</span>
            <span className="detail-value monospace">
              {typeof userProfile?.id === "string"
                ? userProfile.id.slice(0, 12) + "..."
                : userProfile?.id
                ? userProfile.id.toString().slice(0, 12) + "..."
                : "-"}
            </span>
          </div>
        </div>
      </div>

      <div className="danger-zone card">
        <h3>
          <i className="fas fa-exclamation-triangle" /> Danger Zone
        </h3>
        <p>These actions are irreversible. Proceed with caution.</p>

        <div className="danger-actions">
          <button className="btn danger" onClick={handleLogout}>
            <i className="fas fa-sign-out-alt" /> Logout
          </button>
        </div>
      </div>
    </div>
  );

  // ========== MAIN RENDER ==========
  return (
    <div className="app-root">
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner" />
        </div>
      )}

      {!isAuthenticated ? (
        <AuthModal />
      ) : (
        <>
          <header className="app-header">
            <div className="header-left">
              <h1>
                <i className="fas fa-brain" /> Digital Consciousness
              </h1>
              <nav className="main-nav">
                <button className={`nav-btn ${activeTab === "dashboard" ? "active" : ""}`} onClick={() => setActiveTab("dashboard")}>
                  <i className="fas fa-home" /> Dashboard
                </button>
                <button className={`nav-btn ${activeTab === "training" ? "active" : ""}`} onClick={() => setActiveTab("training")}>
                  <i className="fas fa-graduation-cap" /> Training
                </button>
                <button className={`nav-btn ${activeTab === "systems" ? "active" : ""}`} onClick={() => setActiveTab("systems")}>
                  <i className="fas fa-network-wired" /> Systems
                </button>
                <button className={`nav-btn ${activeTab === "settings" ? "active" : ""}`} onClick={() => setActiveTab("settings")}>
                  <i className="fas fa-cog" /> Settings
                </button>
              </nav>
            </div>
            <div className="user-controls">
              <div className="user-info">
                <div className="user-avatar">
                  {userProfile?.profilePic ? (
                    <img src={profilePicToDataUrl(userProfile.profilePic)} alt="Profile" />
                  ) : (
                    <span>{userProfile?.username?.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <span className="username">{userProfile?.username}</span>
              </div>
              <button className="btn small logout-btn" onClick={handleLogout}>
                <i className="fas fa-sign-out-alt" />
              </button>
            </div>
          </header>

          <main className="app-main">
            {activeTab === "dashboard" && <DashboardTab />}
            {activeTab === "training" && <TrainingTab />}
            {activeTab === "systems" && <SystemsTab />}
            {activeTab === "settings" && <SettingsTab />}
          </main>

          <footer className="app-footer">
            <small>
              <i className="fas fa-copyright" /> Digital Consciousness Platform
            </small>
          </footer>
        </>
      )}
    </div>
  );
}
