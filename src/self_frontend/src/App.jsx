import React, { useState, useEffect } from 'react';
import { AuthClient } from '@dfinity/auth-client';
// import { Actor, HttpAgent } from '@dfinity/agent';
import { UserSystem } from '../../declarations/UserSystem';
import './index.scss';

const App = () => {
  // Authentication state
  const [authClient, setAuthClient] = useState(null);
  const [principal, setPrincipal] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Application state
  const [activeView, setActiveView] = useState('dashboard');
  const [userProfile, setUserProfile] = useState(null);
  const [trainingQuestions, setTrainingQuestions] = useState([]);
  const [deployedSystems, setDeployedSystems] = useState([]);
  const [chatPartner, setChatPartner] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [newQuestion, setNewQuestion] = useState({ text: '', category: 'personality', importance: 3 });
  const [profileEdit, setProfileEdit] = useState({ bio: '', profilePic: null });

  // Initialize auth client
  useEffect(() => {
    const initAuth = async () => {
      const client = await AuthClient.create();
      setAuthClient(client);

      if (await client.isAuthenticated()) {
        const identity = client.getIdentity();
        setPrincipal(identity.getPrincipal());
        setIsAuthenticated(true);
        await loadUserData(identity.getPrincipal());
      }
      setIsLoading(false);
    };
    initAuth();
  }, []);

  // Load user data when authenticated
  const loadUserData = async (principal) => {
    try {
      const profile = await UserSystem.getDashboard();
      if (profile.ok) {
        setUserProfile(profile.ok);
        setProfileEdit({ bio: profile.ok.bio || '', profilePic: null });
      }

      const questions = await UserSystem.getQuestions();
      setTrainingQuestions(questions);

      const systems = await UserSystem.getDeployedSystems();
      setDeployedSystems(systems);
    } catch (error) {
      showNotification('Failed to load user data', 'error');
    }
  };

  // Authentication handlers
  const handleLogin = async (username, password) => {
    try {
      const result = await UserSystem.login(username, password);
      if (result.ok) {
        setUserProfile(result.ok);
        setIsAuthenticated(true);
        showNotification('Login successful!', 'success');
        setActiveView('dashboard');
      } else {
        showNotification(result.err, 'error');
      }
    } catch (error) {
      showNotification('Login failed', 'error');
    }
  };

  const handleRegister = async (username, email, password) => {
    try {
      const result = await UserSystem.register(username, email, password);
      if (result.ok) {
        setUserProfile(result.ok);
        setIsAuthenticated(true);
        showNotification('Registration successful!', 'success');
        setActiveView('dashboard');
      } else {
        showNotification(result.err, 'error');
      }
    } catch (error) {
      showNotification('Registration failed', 'error');
    }
  };

  const handleLogout = async () => {
    await authClient.logout();
    setIsAuthenticated(false);
    setPrincipal(null);
    setUserProfile(null);
    setActiveView('login');
    showNotification('Logged out successfully', 'success');
  };

  // Profile management
  const updateProfile = async () => {
    try {
      const result = await UserSystem.updateProfile(
        profileEdit.bio !== '' ? profileEdit.bio : null,
        profileEdit.profilePic
      );
      if (result.ok) {
        const updatedProfile = await UserSystem.getDashboard();
        setUserProfile(updatedProfile.ok);
        showNotification('Profile updated!', 'success');
        setActiveView('dashboard');
      } else {
        showNotification(result.err, 'error');
      }
    } catch (error) {
      showNotification('Failed to update profile', 'error');
    }
  };

  // Training system
  const submitAnswer = async (questionId, answer) => {
    try {
      const result = await UserSystem.submitAnswer(questionId, answer);
      if (result.ok) {
        const updatedProfile = await UserSystem.getDashboard();
        setUserProfile(updatedProfile.ok);
        showNotification('Answer submitted!', 'success');
      } else {
        showNotification(result.err, 'error');
      }
    } catch (error) {
      showNotification('Failed to submit answer', 'error');
    }
  };

  const addCustomQuestion = async () => {
    try {
      const result = await UserSystem.addCustomQuestion(
        newQuestion.text,
        newQuestion.category,
        parseInt(newQuestion.importance)
      );
      if (result.ok) {
        const questions = await UserSystem.getQuestions();
        setTrainingQuestions(questions);
        setNewQuestion({ text: '', category: 'personality', importance: 3 });
        showNotification('Question added!', 'success');
      } else {
        showNotification(result.err, 'error');
      }
    } catch (error) {
      showNotification('Failed to add question', 'error');
    }
  };

  // Deployment
  const deploySystem = async () => {
    try {
      const result = await UserSystem.deploySystem();
      if (result.ok) {
        const updatedProfile = await UserSystem.getDashboard();
        setUserProfile(updatedProfile.ok);
        
        const systems = await UserSystem.getDeployedSystems();
        setDeployedSystems(systems);
        
        showNotification('System deployed successfully!', 'success');
      } else {
        showNotification(result.err, 'error');
      }
    } catch (error) {
      showNotification('Deployment failed', 'error');
    }
  };

  // Chat system
  const startChat = (userId, username) => {
    setChatPartner({ id: userId, username });
    setActiveView('chat');
    setChatMessages([]);
  };

  const sendMessage = async (message) => {
    try {
      const result = await UserSystem.chatWithSystem(chatPartner.id, message);
      if (result.ok) {
        setChatMessages(prev => [
          ...prev,
          { sender: 'user', content: message },
          { sender: 'ai', content: result.ok }
        ]);
      } else {
        showNotification(result.err, 'error');
      }
    } catch (error) {
      showNotification('Failed to send message', 'error');
    }
  };

  // UI Helpers
  const showNotification = (message, type) => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: '' }), 5000);
  };

  const getUnansweredQuestions = () => {
    if (!userProfile) return [];
    
    const answeredIds = userProfile.knowledgeBase.map(answer => {
      const parts = answer.split('|||');
      return parts.length > 0 ? parseInt(parts[0]) : null;
    }).filter(id => id !== null);

    return trainingQuestions.filter(q => !answeredIds.includes(q.id));
  };

  // Render loading state
  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
        <p>Initializing AI Personality System...</p>
      </div>
    );
  }

  // Render authentication views
  if (!isAuthenticated) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h1 className="logo">AI Personality System</h1>
          {activeView === 'login' ? (
            <div className="login-form">
              <h2>Login</h2>
              <form onSubmit={(e) => {
                e.preventDefault();
                const form = e.target;
                handleLogin(form.username.value, form.password.value);
              }}>
                <div className="form-group">
                  <label>Username</label>
                  <input type="text" name="username" required />
                </div>
                <div className="form-group">
                  <label>Password</label>
                  <input type="password" name="password" required />
                </div>
                <button type="submit" className="primary-btn">Login</button>
              </form>
              <p className="switch-auth">
                Don't have an account?{' '}
                <button onClick={() => setActiveView('register')} className="text-btn">
                  Register
                </button>
              </p>
            </div>
          ) : (
            <div className="register-form">
              <h2>Register</h2>
              <form onSubmit={(e) => {
                e.preventDefault();
                const form = e.target;
                handleRegister(form.username.value, form.email.value, form.password.value);
              }}>
                <div className="form-group">
                  <label>Username</label>
                  <input type="text" name="username" required minLength="3" />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" name="email" required />
                </div>
                <div className="form-group">
                  <label>Password</label>
                  <input type="password" name="password" required minLength="8" />
                </div>
                <button type="submit" className="primary-btn">Register</button>
              </form>
              <p className="switch-auth">
                Already have an account?{' '}
                <button onClick={() => setActiveView('login')} className="text-btn">
                  Login
                </button>
              </p>
            </div>
          )}
        </div>
        
        {notification.show && (
          <div className={`notification ${notification.type}`}>
            {notification.message}
          </div>
        )}
      </div>
    );
  }

  // Main application layout
  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>AI Personality</h2>
          <p>{userProfile?.username}</p>
          <div className="profile-pic">
            {userProfile?.profilePic ? (
              <img src={URL.createObjectURL(userProfile.profilePic)} alt="Profile" />
            ) : (
              <div className="initials">
                {userProfile?.username?.substring(0, 2).toUpperCase()}
              </div>
            )}
          </div>
        </div>
        
        <nav className="nav-menu">
          <button 
            className={activeView === 'dashboard' ? 'active' : ''}
            onClick={() => setActiveView('dashboard')}
          >
            <i className="icon">🏠</i> Dashboard
          </button>
          
          <button 
            className={activeView === 'profile' ? 'active' : ''}
            onClick={() => setActiveView('profile')}
          >
            <i className="icon">👤</i> My Profile
          </button>
          
          <button 
            className={activeView === 'training' ? 'active' : ''}
            onClick={() => setActiveView('training')}
          >
            <i className="icon">🎓</i> Training
          </button>
          
          <button 
            className={activeView === 'personality' ? 'active' : ''}
            onClick={() => setActiveView('personality')}
          >
            <i className="icon">🧠</i> Personality
          </button>
          
          <button 
            className={activeView === 'memories' ? 'active' : ''}
            onClick={() => setActiveView('memories')}
          >
            <i className="icon">📚</i> Memories
          </button>
          
          <button 
            className={activeView === 'deploy' ? 'active' : ''}
            onClick={() => setActiveView('deploy')}
          >
            <i className="icon">🚀</i> Deployment
          </button>
          
          <button 
            className={activeView === 'explore' ? 'active' : ''}
            onClick={() => setActiveView('explore')}
          >
            <i className="icon">🔍</i> Explore AIs
          </button>
        </nav>
        
        <div className="sidebar-footer">
          <button onClick={handleLogout} className="logout-btn">
            <i className="icon">🚪</i> Logout
          </button>
        </div>
      </div>
      
      {/* Main Content Area */}
      <div className="main-content">
        {notification.show && (
          <div className={`notification ${notification.type}`}>
            {notification.message}
          </div>
        )}
        
        {activeView === 'dashboard' && (
          <div className="dashboard-view">
            <h1>Welcome back, {userProfile?.username}</h1>
            
            <div className="stats-grid">
              <div className="stat-card">
                <h3>Training Progress</h3>
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${(userProfile?.knowledgeBase.length / trainingQuestions.length) * 100}%` }}
                  ></div>
                </div>
                <p>{userProfile?.knowledgeBase.length} of {trainingQuestions.length} questions answered</p>
              </div>
              
              <div className="stat-card">
                <h3>Personality Traits</h3>
                <div className="traits-preview">
                  {userProfile?.traits.slice(0, 3).map(trait => (
                    <span key={trait.name} className="trait-badge">
                      {trait.name} ({trait.strength}/10)
                    </span>
                  ))}
                </div>
                <button 
                  onClick={() => setActiveView('personality')}
                  className="text-btn"
                >
                  View all traits
                </button>
              </div>
              
              <div className="stat-card">
                <h3>System Status</h3>
                <p className={`status ${userProfile?.deployed ? 'deployed' : 'not-deployed'}`}>
                  {userProfile?.deployed ? 'Deployed 🚀' : 'Not Deployed'}
                </p>
                <button 
                  onClick={() => setActiveView('deploy')}
                  className="primary-btn"
                >
                  {userProfile?.deployed ? 'Manage' : 'Deploy Now'}
                </button>
              </div>
              
              <div className="stat-card">
                <h3>Quick Actions</h3>
                <div className="action-buttons">
                  <button 
                    onClick={() => setActiveView('training')}
                    className="secondary-btn"
                  >
                    Answer Questions
                  </button>
                  <button 
                    onClick={() => setActiveView('explore')}
                    className="secondary-btn"
                  >
                    Explore AIs
                  </button>
                </div>
              </div>
            </div>
            
            <div className="recent-memories">
              <h3>Recent Memories</h3>
              {userProfile?.memories.length > 0 ? (
                <div className="memory-list">
                  {userProfile.memories.slice(0, 3).map(memory => (
                    <div key={memory.id} className="memory-card">
                      <p>{memory.content.length > 100 
                        ? memory.content.substring(0, 100) + '...' 
                        : memory.content}</p>
                      <div className="memory-meta">
                        <span className="weight">Weight: {memory.emotionalWeight}/10</span>
                        <span className="date">
                          {new Date(Number(memory.lastAccessed)).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No memories yet. Answer more questions to create memories.</p>
              )}
              <button 
                onClick={() => setActiveView('memories')}
                className="text-btn"
              >
                View all memories
              </button>
            </div>
          </div>
        )}
        
        {activeView === 'profile' && (
          <div className="profile-view">
            <h1>Edit Profile</h1>
            
            <div className="profile-form">
              <div className="profile-pic-edit">
                <div className="pic-preview">
                  {profileEdit.profilePic ? (
                    <img src={URL.createObjectURL(profileEdit.profilePic)} alt="Preview" />
                  ) : userProfile?.profilePic ? (
                    <img src={URL.createObjectURL(userProfile.profilePic)} alt="Current" />
                  ) : (
                    <div className="initials">
                      {userProfile?.username?.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <input 
                  type="file" 
                  id="profile-pic-upload"
                  onChange={(e) => {
                    if (e.target.files.length > 0) {
                      setProfileEdit({ ...profileEdit, profilePic: e.target.files[0] });
                    }
                  }}
                />
                <label htmlFor="profile-pic-upload" className="upload-btn">
                  Change Photo
                </label>
              </div>
              
              <div className="form-group">
                <label>Bio</label>
                <textarea
                  value={profileEdit.bio}
                  onChange={(e) => setProfileEdit({ ...profileEdit, bio: e.target.value })}
                  placeholder="Tell us about yourself..."
                  rows="5"
                ></textarea>
              </div>
              
              <div className="form-actions">
                <button 
                  onClick={() => {
                    setActiveView('dashboard');
                    setProfileEdit({ bio: userProfile?.bio || '', profilePic: null });
                  }}
                  className="secondary-btn"
                >
                  Cancel
                </button>
                <button 
                  onClick={updateProfile}
                  className="primary-btn"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}
        
        {activeView === 'training' && (
          <div className="training-view">
            <h1>Training Questions</h1>
            <p>Answer questions to help your AI personality learn about you.</p>
            
            <div className="training-container">
              <div className="questions-list">
                <h3>Unanswered Questions</h3>
                {getUnansweredQuestions().length > 0 ? (
                  <div className="question-cards">
                    {getUnansweredQuestions()
                      .sort((a, b) => b.importance - a.importance)
                      .slice(0, 5)
                      .map(question => (
                        <QuestionCard 
                          key={question.id}
                          question={question}
                          onSubmit={submitAnswer}
                        />
                      ))}
                  </div>
                ) : (
                  <p>You've answered all available questions!</p>
                )}
                
                <div className="add-question">
                  <h3>Add Custom Question</h3>
                  <div className="form-group">
                    <label>Question</label>
                    <input
                      type="text"
                      value={newQuestion.text}
                      onChange={(e) => setNewQuestion({ ...newQuestion, text: e.target.value })}
                      placeholder="Enter your question..."
                    />
                  </div>
                  <div className="form-group">
                    <label>Category</label>
                    <select
                      value={newQuestion.category}
                      onChange={(e) => setNewQuestion({ ...newQuestion, category: e.target.value })}
                    >
                      <option value="personality">Personality</option>
                      <option value="values">Values</option>
                      <option value="habits">Habits</option>
                      <option value="cognition">Cognition</option>
                      <option value="relationships">Relationships</option>
                      <option value="experiences">Experiences</option>
                      <option value="future">Future</option>
                      <option value="creativity">Creativity</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Importance: {newQuestion.importance}</label>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={newQuestion.importance}
                      onChange={(e) => setNewQuestion({ ...newQuestion, importance: e.target.value })}
                    />
                  </div>
                  <button 
                    onClick={addCustomQuestion}
                    disabled={!newQuestion.text}
                    className="primary-btn"
                  >
                    Add Question
                  </button>
                </div>
              </div>
              
              <div className="progress-section">
                <h3>Your Progress</h3>
                <div className="progress-chart">
                  <div className="chart">
                    <div 
                      className="chart-fill"
                      style={{ height: `${(userProfile?.knowledgeBase.length / trainingQuestions.length) * 100}%` }}
                    ></div>
                  </div>
                  <div className="chart-labels">
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                </div>
                <p className="progress-text">
                  {Math.round((userProfile?.knowledgeBase.length / trainingQuestions.length) * 100)}% Complete
                </p>
                <p>{userProfile?.knowledgeBase.length} of {trainingQuestions.length} questions answered</p>
                
                <button 
                  onClick={() => setActiveView('dashboard')}
                  className="secondary-btn"
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          </div>
        )}
        
        {activeView === 'personality' && (
          <div className="personality-view">
            <h1>Your Personality Traits</h1>
            <p>These traits were extracted from your answers to personality questions.</p>
            
            {userProfile?.traits.length > 0 ? (
              <div className="traits-container">
                <div className="traits-chart">
                  {userProfile.traits.map(trait => (
                    <div key={trait.name} className="trait-bar">
                      <div className="trait-label">{trait.name}</div>
                      <div className="trait-strength">
                        <div 
                          className="strength-fill"
                          style={{ width: `${(trait.strength / 10) * 100}%` }}
                        ></div>
                        <span className="strength-value">{trait.strength}/10</span>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="traits-cloud">
                  {userProfile.traits.map(trait => (
                    <span 
                      key={trait.name}
                      className="trait-tag"
                      style={{
                        fontSize: `${12 + (trait.strength * 3)}px`,
                        opacity: `${0.5 + (trait.strength / 20)}`
                      }}
                    >
                      {trait.name}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p>No personality traits detected yet. Answer more personality questions.</p>
            )}
            
            <button 
              onClick={() => setActiveView('training')}
              className="primary-btn"
            >
              Answer More Questions
            </button>
          </div>
        )}
        
        {activeView === 'memories' && (
          <div className="memories-view">
            <h1>Your Memories</h1>
            <p>Important moments and answers that shape your AI personality.</p>
            
            {userProfile?.memories.length > 0 ? (
              <div className="memory-grid">
                {userProfile.memories
                  .sort((a, b) => b.emotionalWeight - a.emotionalWeight)
                  .map(memory => (
                    <div key={memory.id} className="memory-card">
                      <div className="memory-content">
                        <p>{memory.content}</p>
                      </div>
                      <div className="memory-footer">
                        <span className="weight-badge">
                          Emotional Weight: {memory.emotionalWeight}/10
                        </span>
                        <span className="memory-date">
                          {new Date(Number(memory.lastAccessed)).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <p>No memories yet. Answer more questions to create memories.</p>
            )}
          </div>
        )}
        
        {activeView === 'deploy' && (
          <div className="deploy-view">
            <h1>System Deployment</h1>
            
            <div className="deploy-card">
              {userProfile?.deployed ? (
                <>
                  <div className="deploy-status deployed">
                    <i className="icon">🚀</i>
                    <h2>Your AI System is Deployed!</h2>
                    <p>Others can now chat with your AI personality.</p>
                  </div>
                  
                  <div className="deploy-stats">
                    <div className="stat">
                      <h3>Questions Answered</h3>
                      <p>{userProfile.knowledgeBase.length}</p>
                    </div>
                    <div className="stat">
                      <h3>Personality Traits</h3>
                      <p>{userProfile.traits.length}</p>
                    </div>
                    <div className="stat">
                      <h3>Memories Stored</h3>
                      <p>{userProfile.memories.length}</p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="deploy-status not-deployed">
                    <i className="icon">⏳</i>
                    <h2>Ready to Deploy Your AI?</h2>
                    <p>Deploy your AI personality to make it available for others to chat with.</p>
                  </div>
                  
                  <div className="requirements">
                    <h3>Deployment Requirements</h3>
                    <ul>
                      <li className={userProfile?.knowledgeBase.length >= 10 ? 'met' : ''}>
                        {userProfile?.knowledgeBase.length >= 10 ? '✓' : '✗'} At least 10 questions answered
                        <span>({userProfile?.knowledgeBase.length}/10)</span>
                      </li>
                      <li className={userProfile?.traits.length >= 3 ? 'met' : ''}>
                        {userProfile?.traits.length >= 3 ? '✓' : '✗'} At least 3 personality traits identified
                        <span>({userProfile?.traits.length}/3)</span>
                      </li>
                    </ul>
                  </div>
                  
                  <button
                    onClick={deploySystem}
                    disabled={userProfile?.knowledgeBase.length < 10 || userProfile?.traits.length < 3}
                    className="primary-btn deploy-btn"
                  >
                    Deploy My AI System
                  </button>
                </>
              )}
            </div>
            
            <button 
              onClick={() => setActiveView('dashboard')}
              className="secondary-btn"
            >
              Back to Dashboard
            </button>
          </div>
        )}
        
        {activeView === 'explore' && (
          <div className="explore-view">
            <h1>Explore AI Systems</h1>
            <p>Discover and chat with other deployed AI personalities.</p>
            
            {deployedSystems.length > 0 ? (
              <div className="systems-grid">
                {deployedSystems.map(([username, userId]) => (
                  <div key={userId.toString()} className="system-card">
                    <div className="system-avatar">
                      {username.substring(0, 2).toUpperCase()}
                    </div>
                    <h3>{username}</h3>
                    <button
                      onClick={() => startChat(userId, username)}
                      className="primary-btn"
                    >
                      Chat with {username}'s AI
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p>No deployed systems found. Be the first to deploy your AI!</p>
            )}
          </div>
        )}
        
        {activeView === 'chat' && chatPartner && (
          <div className="chat-view">
            <div className="chat-header">
              <button 
                onClick={() => setActiveView('explore')}
                className="back-btn"
              >
                ← Back
              </button>
              <h2>Chatting with {chatPartner.username}'s AI</h2>
            </div>
            
            <div className="chat-messages">
              {chatMessages.length > 0 ? (
                chatMessages.map((msg, index) => (
                  <div key={index} className={`message ${msg.sender}`}>
                    <div className="message-content">
                      <p>{msg.content}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-chat">
                  <p>Start a conversation with {chatPartner.username}'s AI personality</p>
                </div>
              )}
            </div>
            
            <div className="chat-input">
              <form onSubmit={(e) => {
                e.preventDefault();
                const input = e.target.message;
                if (input.value.trim()) {
                  sendMessage(input.value);
                  input.value = '';
                }
              }}>
                <input
                  type="text"
                  name="message"
                  placeholder="Type your message..."
                  autoComplete="off"
                />
                <button type="submit">
                  <i className="icon">✉️</i>
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper component for question cards
const QuestionCard = ({ question, onSubmit }) => {
  const [answer, setAnswer] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={`question-card ${isExpanded ? 'expanded' : ''}`}>
      <div className="question-header" onClick={() => setIsExpanded(!isExpanded)}>
        <h4>{question.question}</h4>
        <span className="category-badge">{question.category}</span>
        <span className="importance-badge">Importance: {question.importance}/5</span>
      </div>
      
      {isExpanded && (
        <div className="question-body">
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type your answer here..."
            rows="4"
          ></textarea>
          <button
            onClick={() => {
              if (answer.trim()) {
                onSubmit(question.id, answer);
                setAnswer('');
                setIsExpanded(false);
              }
            }}
            className="primary-btn"
            disabled={!answer.trim()}
          >
            Submit Answer
          </button>
        </div>
      )}
    </div>
  );
};



// Inject styles into the document head
const styleElement = document.createElement('style');
styleElement.textContent = styles;
document.head.appendChild(styleElement);

export default App;