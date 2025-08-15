import Array "mo:base/Array";
import Blob "mo:base/Blob";
import Buffer "mo:base/Buffer";
import HashMap "mo:base/HashMap";
import Iter "mo:base/Iter";
import Nat "mo:base/Nat";
import Nat8 "mo:base/Nat8";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Text "mo:base/Text";
import Time "mo:base/Time";
import Order "mo:base/Order";
import Int "mo:base/Int";
import Char "mo:base/Char";
import Float "mo:base/Float";
import Option "mo:base/Option";
import TrieMap "mo:base/TrieMap";
import Random "mo:base/Random";
import Nat64 "mo:base/Nat64";

persistent actor UserSystem {
    // ========== TYPE DEFINITIONS ==========
    public type UserId = Principal;
    public type Username = Text;
    public type Email = Text;
    public type Password = Text;
    public type Bio = Text;
    public type ProfilePic = Blob;
    public type QuestionId = Nat;
    public type Question = Text;
    public type Answer = Text;
    public type ChatMessage = Text;
    public type Timestamp = Time.Time;
    public type MemoryId = Nat;
    public type FeedbackScore = Nat; // 1-5 scale
    
    public type Emotion = {
        #happy : Text; // "😊"
        #sad : Text; // "😔"
        #angry : Text; // "😠"
        #neutral : Text; // "😐"
        #excited : Text; // "🤩"
        #confused : Text; // "😕"
    };

    public type CommunicationStyle = { #formal; #casual; #technical; #humorous; #empathetic; #balanced };

    public type PersonalityTrait = {
        name : Text;
        strength : Float; // 0-10 scale with decimals
        lastUpdated : Timestamp;
    };
     // Option for multiple-choice / selectable answers
    public type QuestionOption = {
        text : Text;
        value : Text;
    };

    public type TrainingQuestion = {
        id : QuestionId;
        question : Question;
        category : Text;
        importance : Nat; 
        triggers : [Text]; 
        options : [QuestionOption]; 
        
    };

    public type Memory = {
        id : MemoryId;
        content : Text;
        emotionalWeight : Float;
        lastAccessed : Timestamp;
        accessCount : Nat;
        associatedEmotions : [Emotion];
        decayRate : Float; 
    };

    public type KnowledgeEntry = {
        questionId : QuestionId;
        answer : Answer;
        confidence : Float; 
        lastUsed : Timestamp;
        usageCount : Nat;
    };

    public type ConversationContext = {
        recentTopics : [Text];
        currentEmotion : ?Emotion;
        stylePreference : CommunicationStyle;
    };

    public type UserPreferences = {
        preferredStyle : CommunicationStyle;
        depthLevel : Nat; 
        formality : Nat; 
    };

    public type UserProfile = {
        username : Username;
        email : Email;
        bio : ?Bio;
        profilePic : ?ProfilePic;
        traits : [PersonalityTrait];
        knowledgeBase : [KnowledgeEntry];
        memories : [Memory];
        preferences : UserPreferences;
        deployed : Bool;
        createdAt : Timestamp;
        lastUpdated : Timestamp;
        trainingProgress : Nat; // Percentage
        conversationHistory : [ConversationContext];
    };

    // ========== RESULT TYPES ==========
    public type AuthResult = Result.Result<UserProfile, Text>;
    public type ProfileResult = Result.Result<(), Text>;
    public type TrainingResult = Result.Result<(), Text>;
    public type DeploymentResult = Result.Result<(), Text>;
    public type ChatResult = Result.Result<Text, Text>;
    public type QuestionResult = Result.Result<TrainingQuestion, Text>;
    public type FeedbackResult = Result.Result<(), Text>;
    public type MemoryResult = Result.Result<Memory, Text>;
    public type AnalysisResult = Result.Result<Text, Text>;

    // ========== STATE VARIABLES ==========
    private var users : [(UserId, UserProfile)] = [];
    private var credentials : [(UserId, Password)] = [];
    private var usernameToId : [(Username, UserId)] = [];
    private var emailToId : [(Email, UserId)] = [];
    private var nextMemoryId : MemoryId = 1;
    private var nextQuestionId : QuestionId = 17;
    private var _memoryDecayBase : Float = 0.95; // 5% decay per day
    private var minMemoryStrength : Float = 0.1;

    // In-memory maps
    private transient var usersMap = HashMap.HashMap<UserId, UserProfile>(1, Principal.equal, Principal.hash);
    private transient var credentialsMap = HashMap.HashMap<UserId, Password>(1, Principal.equal, Principal.hash);
    private transient var usernameMap = HashMap.HashMap<Username, UserId>(1, Text.equal, Text.hash);
    private transient var emailMap = HashMap.HashMap<Email, UserId>(1, Text.equal, Text.hash);

    // NLP components
    private transient let stopWords = ["a", "an", "the", "and", "or", "but", "if", "then", "else", "when", "at", "from", "by", "on", "off", "for", "in", "out", "over", "to", "with"];
    private transient let sentimentWords = TrieMap.TrieMap<Text, Float>(Text.equal, Text.hash);

    // Emoji mappings
    private transient let emojiMap = TrieMap.TrieMap<Text, Emotion>(Text.equal, Text.hash);
    
    // ========== TRAINING QUESTIONS ==========
    private var trainingQuestions : [TrainingQuestion] = [
        { id = 0; question = "How would you describe your personality in 5 words?";
          category = "personality"; importance = 5;
          triggers = ["describe", "personality", "character", "traits"];
          options = [{ text = "(open)"; value = "open" }] },

        { id = 1; question = "Are you more introverted or extroverted?";
          category = "personality"; importance = 4;
          triggers = ["introvert", "extrovert", "social", "outgoing", "shy"];
          options = [{ text = "Introverted"; value = "introverted" }, { text = "Extroverted"; value = "extroverted" }] },

        { id = 2; question = "How do you typically respond to stress?";
          category = "personality"; importance = 4;
          triggers = ["stress", "pressure", "anxious", "cope", "handle"];
          options = [{ text = "(open)"; value = "open" }] },

        { id = 3; question = "What are your top 3 core values?";
          category = "values"; importance = 5;
          triggers = ["values", "important", "believe", "principles"];
          options = [{ text = "(open)"; value = "open" }] },

        { id = 4; question = "What moral principle would you never compromise?";
          category = "values"; importance = 5;
          triggers = ["moral", "principle", "compromise", "ethics"];
          options = [{ text = "(open)"; value = "open" }] },

        { id = 5; question = "Describe your morning routine";
          category = "habits"; importance = 3;
          triggers = ["morning", "routine", "wake up", "start day"];
          options = [{ text = "(open)"; value = "open" }] },

        { id = 6; question = "What's your ideal way to spend a weekend?";
          category = "habits"; importance = 3;
          triggers = ["weekend", "free time", "hobby", "relax"];
          options = [{ text = "(open)"; value = "open" }] },

        { id = 7; question = "Are you more logical or emotional in decision making?";
          category = "cognition"; importance = 4;
          triggers = ["decide", "decision", "logic", "emotion", "think", "feel"];
          options = [{ text = "Logical"; value = "logical" }, { text = "Emotional"; value = "emotional" }] },

        { id = 8; question = "How do you approach solving complex problems?";
          category = "cognition"; importance = 4;
          triggers = ["solve", "problem", "complex", "approach", "method"];
          options = [{ text = "(open)"; value = "open" }] },

        { id = 9; question = "What qualities do you value most in friends?";
          category = "relationships"; importance = 4;
          triggers = ["friend", "qualities", "value", "close", "relationship"];
          options = [{ text = "(open)"; value = "open" }] },

        { id = 10; question = "How do you handle conflict in relationships?";
          category = "relationships"; importance = 4;
          triggers = ["conflict", "fight", "argument", "disagree", "handle"];
          options = [{ text = "(open)"; value = "open" }] },

        { id = 11; question = "What's the most important lesson life has taught you?";
          category = "experiences"; importance = 5;
          triggers = ["lesson", "learn", "life", "experience", "taught"];
          options = [{ text = "(open)"; value = "open" }] },

        { id = 12; question = "Describe a formative childhood experience";
          category = "experiences"; importance = 4;
          triggers = ["childhood", "grow up", "young", "experience", "formative"];
          options = [{ text = "(open)"; value = "open" }] },

        { id = 13; question = "Where do you see yourself in 5 years?";
          category = "future"; importance = 3;
          triggers = ["future", "plan", "goal", "dream", "aspire"];
          options = [{ text = "(open)"; value = "open" }] },

        { id = 14; question = "What legacy would you like to leave?";
          category = "future"; importance = 4;
          triggers = ["legacy", "remember", "impact", "contribute", "leave"];
          options = [{ text = "(open)"; value = "open" }] },

        { id = 15; question = "What inspires your creativity?";
          category = "creativity"; importance = 3;
          triggers = ["inspire", "creative", "idea", "imagine", "create"];
          options = [{ text = "(open)"; value = "open" }] },

        { id = 16; question = "How do you overcome creative blocks?";
          category = "creativity"; importance = 3;
          triggers = ["block", "stuck", "creative", "unblock", "inspiration"];
          options = [{ text = "(open)"; value = "open" }] }
    ];


    // Initialize sentiment words and emoji mappings
    private func initSentimentWords() {
        let positive = [("happy", 0.8), ("joy", 0.9), ("love", 1.0), ("great", 0.7)];
        let negative = [("sad", -0.8), ("angry", -0.9), ("hate", -1.0), ("bad", -0.7)];
        
        for ((word, score) in positive.vals()) {
            sentimentWords.put(word, score);
        };
        for ((word, score) in negative.vals()) {
            sentimentWords.put(word, score);
        };

        // Initialize emoji mappings
        emojiMap.put("😊", #happy "😊");
        emojiMap.put("😔", #sad "😔");
        emojiMap.put("😠", #angry "😠");
        emojiMap.put("😐", #neutral "😐");
        emojiMap.put("🤩", #excited "🤩");
        emojiMap.put("😕", #confused "😕");
    };

    // ========== SYSTEM FUNCTIONS ==========
    system func preupgrade() {
        users := Iter.toArray(usersMap.entries());
        credentials := Iter.toArray(credentialsMap.entries());
        usernameToId := Iter.toArray(usernameMap.entries());
        emailToId := Iter.toArray(emailMap.entries());
        nextQuestionId := trainingQuestions.size();
        initSentimentWords();
    };

    system func postupgrade() {
        usersMap := HashMap.fromIter<UserId, UserProfile>(users.vals(), 1, Principal.equal, Principal.hash);
        credentialsMap := HashMap.fromIter<UserId, Password>(credentials.vals(), 1, Principal.equal, Principal.hash);
        usernameMap := HashMap.fromIter<Username, UserId>(usernameToId.vals(), 1, Text.equal, Text.hash);
        emailMap := HashMap.fromIter<Email, UserId>(emailToId.vals(), 1, Text.equal, Text.hash);
        
        users := [];
        credentials := [];
        usernameToId := [];
        emailToId := [];
        
        initSentimentWords();
    };

    // ========== PUBLIC API ==========

    // User Registration
    public shared (msg) func register(username : Username, email : Email, password : Password) : async AuthResult {
        if (Text.size(username) < 3) {
            return #err("Username must be at least 3 characters");
        };

        if (not isValidEmail(email)) {
            return #err("Invalid email format");
        };

        if (Text.size(password) < 8) {
            return #err("Password must be at least 8 characters");
        };

        switch (usernameMap.get(username)) {
            case (?_) { return #err("Username already taken") };
            case null {};
        };

        switch (emailMap.get(email)) {
            case (?_) { return #err("Email already registered") };
            case null {};
        };

        let userId = msg.caller;
        let now = Time.now();

        let newUser : UserProfile = {
            username = username;
            email = email;
            bio = null;
            profilePic = null;
            traits = [];
            knowledgeBase = [];
            memories = [];
            preferences = {
                preferredStyle = #balanced;
                depthLevel = 2;
                formality = 3;
            };
            deployed = false;
            createdAt = now;
            lastUpdated = now;
            trainingProgress = 0;
            conversationHistory = [];
        };

        usersMap.put(userId, newUser);
        credentialsMap.put(userId, password);
        usernameMap.put(username, userId);
        emailMap.put(email, userId);

        #ok(newUser);
    };

    // User Login
    public shared (_msg) func login(username : Username, password : Password) : async AuthResult {
        switch (usernameMap.get(username)) {
            case (?userId) {
                switch (credentialsMap.get(userId)) {
                    case (?storedPassword) {
                        if (Text.equal(password, storedPassword)) {
                            switch (usersMap.get(userId)) {
                                case (?user) { 
                                    // Apply memory decay before returning
                                    let updatedUser = applyMemoryDecay(user);
                                    usersMap.put(userId, updatedUser);
                                    return #ok(updatedUser) 
                                };
                                case null { return #err("User not found") };
                            };
                        } else {
                            return #err("Invalid password")
                        }
                    };
                    case null { return #err("Invalid credentials") };
                }
            };
            case null { return #err("Username not found") };
        }
    };

    // Get Dashboard Data
    public shared query (msg) func getDashboard() : async AuthResult {
        switch (usersMap.get(msg.caller)) {
            case (?user) { return #ok(user) };
            case null { return #err("User not found") };
        }
    };

    // Update Profile
    public shared (msg) func updateProfile(
        bio : ?Bio, 
        profilePic : ?ProfilePic,
        preferredStyle : ?CommunicationStyle,
        depthLevel : ?Nat,
        formality : ?Nat
    ) : async ProfileResult {
        switch (usersMap.get(msg.caller)) {
            case (?user) {
                let updatedPrefs = {
                    preferredStyle = Option.get(preferredStyle, user.preferences.preferredStyle);
                    depthLevel = Option.get(depthLevel, user.preferences.depthLevel);
                    formality = Option.get(formality, user.preferences.formality);
                };

                let updatedUser : UserProfile = {
                    username = user.username;
                    email = user.email;
                    bio = bio;
                    profilePic = profilePic;
                    traits = user.traits;
                    knowledgeBase = user.knowledgeBase;
                    memories = user.memories;
                    preferences = updatedPrefs;
                    deployed = user.deployed;
                    createdAt = user.createdAt;
                    lastUpdated = Time.now();
                    trainingProgress = calculateTrainingProgress(user);
                    conversationHistory = user.conversationHistory;
                };

                usersMap.put(msg.caller, updatedUser);
                #ok();
            };
            case null { return #err("User not found") };
        }
    };

    // Get Training Questions
    public shared query func getQuestions() : async [TrainingQuestion] {
        trainingQuestions
    };

// Get Next Training Question (context-aware)
public shared (msg) func getNextQuestion(context : ?Text) : async QuestionResult {
    switch (usersMap.get(msg.caller)) {
        case (?user) {
            let answeredIds = Buffer.Buffer<QuestionId>(user.knowledgeBase.size());
            for (entry in user.knowledgeBase.vals()) {
                answeredIds.add(entry.questionId);
            };

            // Get unanswered questions
            let unanswered = Array.filter<TrainingQuestion>(
                trainingQuestions,
                func(q : TrainingQuestion) : Bool {
                    Option.isNull(
                        Array.find<QuestionId>(
                            Buffer.toArray(answeredIds),
                            func(id : QuestionId) : Bool { id == q.id }
                        )
                    )
                }
            );

            if (unanswered.size() == 0) {
                return #err("All questions answered");
            };

            // Context-aware selection if context provided
            let selectedQuestion = switch (context) {
                case (?ctx) {
                    let ctxLower = Text.toLowercase(ctx);
                    let matchingQuestions = Array.filter<TrainingQuestion>(
                        unanswered,
                        func(q : TrainingQuestion) : Bool {
                            Array.find<Text>(
                                q.triggers,
                                func(trigger : Text) : Bool {
                                    Text.contains(ctxLower, #text trigger)
                                }
                            ) != null
                        }
                    );

                    if (matchingQuestions.size() > 0) {
                        Array.sort(matchingQuestions, compareQuestionImportance)[0]
                    } else {
                        selectQuestionByImportance(unanswered)
                    }
                };
                case null {
                    selectQuestionByImportance(unanswered)
                }
            };

            // Sanitize options so text is never empty
            let safeOptions = Array.map<QuestionOption, QuestionOption>(
                selectedQuestion.options,
                func(opt : QuestionOption) : QuestionOption {
                    {
                        text = if (opt.text != "" ) opt.text else "(No text provided)";
                        value = opt.value
                    }
                }
            );

            // Build safe question object (keeping your structure)
            let safeQuestion : TrainingQuestion = {
                id = selectedQuestion.id;
                question = selectedQuestion.question;
                category = selectedQuestion.category;
                importance = selectedQuestion.importance;
                triggers = selectedQuestion.triggers;
                options = safeOptions;
            };

            #ok(safeQuestion)
        };
        case null { return #err("User not found") };
    }
};



    // Submit Training Answer with optional emotional context
    public shared (msg) func submitAnswer(
        questionId : QuestionId, 
        answer : Answer,
        emotion : ?Emotion,
    ) : async TrainingResult {
        switch (usersMap.get(msg.caller)) {
            case (?user) {
                let now = Time.now();
                let question = Array.find<TrainingQuestion>(trainingQuestions, func(q : TrainingQuestion) : Bool { q.id == questionId });
                
                // Create new knowledge entry
                let newEntry : KnowledgeEntry = {
                    questionId = questionId;
                    answer = answer;
                    confidence = 1.0; // Start with full confidence
                    lastUsed = now;
                    usageCount = 0;
                };
                
                let newKnowledgeBase = Array.append<KnowledgeEntry>(user.knowledgeBase, [newEntry]);

                // Create memory if important or long answer
                let newMemories = if ((Text.size(answer) > 50) or (switch(question) { case(null) { false }; case(?q) { q.importance >= 4 } })) {
                    let memory : Memory = {
                        id = nextMemoryId;
                        content = answer;
                        emotionalWeight = switch(question) { 
                            case(null) { 3.0 }; 
                            case(?q) { Float.fromInt(q.importance) } 
                        };
                        lastAccessed = now;
                        accessCount = 0;
                        associatedEmotions = switch (emotion) {
                            case (?e) { [e] };
                            case null { [] };
                        };
                        decayRate = 0.95; // Default 5% decay per day
                    };
                    nextMemoryId += 1;
                    Array.append<Memory>(user.memories, [memory])
                } else {
                    user.memories
                };

                // Update personality traits if personality question
                let newTraits = switch (question) {
                    case (?q) {
                        if (Text.equal(q.category, "personality")) {
                            extractTraits(answer, user.traits, now)
                        } else {
                            user.traits
                        }
                    };
                    case null { user.traits };
                };

                // Update conversation style based on answer analysis
                let detectedStyle = detectCommunicationStyle(answer);
                let currentPrefs = user.preferences;
                let updatedPrefs = if (detectedStyle != currentPrefs.preferredStyle) {
                    // Gradually adjust style preference
                    { 
                        currentPrefs with 
                        preferredStyle = blendStyles(currentPrefs.preferredStyle, detectedStyle, 0.3)
                    }
                } else {
                    currentPrefs
                };

                let updatedUser : UserProfile = {
                    username = user.username;
                    email = user.email;
                    bio = user.bio;
                    profilePic = user.profilePic;
                    traits = newTraits;
                    knowledgeBase = newKnowledgeBase;
                    memories = newMemories;
                    preferences = updatedPrefs;
                    deployed = user.deployed;
                    createdAt = user.createdAt;
                    lastUpdated = now;
                    trainingProgress = calculateTrainingProgress({
                        user with 
                        knowledgeBase = newKnowledgeBase
                    });
                    conversationHistory = user.conversationHistory;
                };

                usersMap.put(msg.caller, updatedUser);
                #ok();
            };
            case null { return #err("User not found") };
        }
    };

    // Add Custom Training Question
    public shared (_msg) func addCustomQuestion(
        question : Question, 
        category : Text, 
        importance : Nat,
        triggers : [Text]
    ) : async QuestionResult {
        let clampedImportance = Nat.min(5, Nat.max(1, importance));
        let newQuestion : TrainingQuestion = {
            id = nextQuestionId;
            question = question;
            category = category;
            importance = clampedImportance;
            triggers = triggers;
            options = [{ text = "(open)"; value = "open" }] // Default open-ended option
        };

        trainingQuestions := Array.append<TrainingQuestion>(trainingQuestions, [newQuestion]);
        nextQuestionId += 1;
        #ok(newQuestion)
    };

    // Deploy AI System
    public shared (msg) func deploySystem() : async DeploymentResult {
        switch (usersMap.get(msg.caller)) {
            case (?user) {
                if (user.knowledgeBase.size() < 10) {
                    return #err("You must answer at least 10 questions before deploying");
                };

                let updatedUser : UserProfile = {
                    username = user.username;
                    email = user.email;
                    bio = user.bio;
                    profilePic = user.profilePic;
                    traits = user.traits;
                    knowledgeBase = user.knowledgeBase;
                    memories = user.memories;
                    preferences = user.preferences;
                    deployed = true;
                    createdAt = user.createdAt;
                    lastUpdated = Time.now();
                    trainingProgress = 100; // Consider fully trained when deployed
                    conversationHistory = user.conversationHistory;
                };

                usersMap.put(msg.caller, updatedUser);
                #ok();
            };
            case null { return #err("User not found") };
        }
    };

    // Get Deployed Systems
    public shared query func getDeployedSystems() : async [(Username, UserId)] {
        var buffer = Buffer.Buffer<(Username, UserId)>(0);
        for ((userId, user) in usersMap.entries()) {
            if (user.deployed) {
                buffer.add((user.username, userId));
            };
        };
        Buffer.toArray(buffer)
    };

    // Chat with Deployed System (with context tracking)
    public shared (_msg) func chatWithSystem(
        ownerId : UserId, 
        message : ChatMessage,
        resetContext : Bool
    ) : async ChatResult {
        switch (usersMap.get(ownerId)) {
            case (?user) {
                if (not user.deployed) {
                    return #err("This user hasn't deployed their system yet");
                };

                // Get or reset conversation context
                let currentContext = if (resetContext or user.conversationHistory.size() == 0) {
                    {
                        recentTopics = [];
                        currentEmotion = analyzeEmotion(message);
                        stylePreference = user.preferences.preferredStyle;
                    }
                } else {
                    updateContext(user.conversationHistory[0], message)
                };

                let response = generateAdvancedResponse(user, message, currentContext);

                // Update user with new conversation context
                let updatedHistory = if (user.conversationHistory.size() >= 5) {
                    // Keep only the 5 most recent contexts
                    Array.append([currentContext], Array.take(user.conversationHistory, 4))
                } else {
                    Array.append([currentContext], user.conversationHistory)
                };

                let updatedUser : UserProfile = {
                    user with
                    conversationHistory = updatedHistory;
                    lastUpdated = Time.now()
                };

                usersMap.put(ownerId, updatedUser);
                #ok(response);
            };
            case null { return #err("User not found") };
        }
    };

    // Provide feedback on response quality
    public shared (_msg) func provideFeedback(
        ownerId : UserId,
        questionId : ?QuestionId,
        memoryId : ?MemoryId,
        score : FeedbackScore,
        comments : ?Text
    ) : async FeedbackResult {
        switch (usersMap.get(ownerId)) {
            case (?user) {
                let clampedScore = Nat.min(5, Nat.max(1, score));
                let now = Time.now();

                // Update knowledge entry confidence if specified
                let updatedKnowledge = switch (questionId) {
                    case (?qid) {
                        Array.map<KnowledgeEntry, KnowledgeEntry>(
                            user.knowledgeBase,
                            func(entry) {
                                if (entry.questionId == qid) {
                                    let newConfidence = Float.min(
                                        1.0,
                                        Float.max(0.2, entry.confidence * (0.8 + Float.fromInt(clampedScore) * 0.05))
                                    );
                                    {
                                        entry with
                                        confidence = newConfidence;
                                        lastUsed = now;
                                    }
                                } else {
                                    entry
                                }
                            }
                        )
                    };
                    case null { user.knowledgeBase }
                };

                // Update memory emotional weight if specified
                let updatedMemories = switch (memoryId) {
                    case (?mid) {
                        Array.map<Memory, Memory>(
                            user.memories,
                            func(mem) {
                                if (mem.id == mid) {
                                    let weightChange = Float.fromInt(clampedScore - 3) * 0.2;
                                    let newWeight = Float.min(
                                        10.0,
                                        Float.max(0.1, mem.emotionalWeight + weightChange)
                                    );
                                    {
                                        mem with
                                        emotionalWeight = newWeight;
                                        lastAccessed = now;
                                        accessCount = mem.accessCount + 1;
                                    }
                                } else {
                                    mem
                                }
                            }
                        )
                    };
                    case null { user.memories }
                };

                // Update user preferences if comments provided
                let updatedPrefs = switch (comments) {
                    case (?text) {
                        let detectedStyle = detectCommunicationStyle(text);
                        {
                            user.preferences with
                            preferredStyle = blendStyles(user.preferences.preferredStyle, detectedStyle, 0.2);
                        }
                    };
                    case null { user.preferences }
                };

                // Save updates
                let updatedUser = {
                    user with
                    knowledgeBase = updatedKnowledge;
                    memories = updatedMemories;
                    preferences = updatedPrefs;
                    lastUpdated = now;
                };
                usersMap.put(ownerId, updatedUser);
                #ok();
            };
            case null { return #err("User not found") };
        }
    };

    // Get memory details
    public shared query (msg) func getMemoryDetails(memoryId : MemoryId) : async MemoryResult {
        switch (usersMap.get(msg.caller)) {
            case (?user) {
                switch (Array.find<Memory>(user.memories, func(m : Memory) : Bool { m.id == memoryId })) {
                    case (?mem) { #ok(mem) };
                    case null { #err("Memory not found") };
                }
            };
            case null { #err("User not found") };
        }
    };

    // Analyze text for personality insights
    public shared (msg) func analyzeText(text : Text) : async AnalysisResult {
        switch (usersMap.get(msg.caller)) {
            case (?user) {
                let traits = extractTraits(text, user.traits, Time.now());
                let emotion = analyzeEmotion(text);
                let style = detectCommunicationStyle(text);
                
                let analysis = "Text analysis results:\n" #
                              "Detected personality traits: " # formatTraits(traits) # "\n" #
                              "Emotional tone: " # debugPrintEmotion(emotion) # "\n" #
                              "Communication style: " # debugPrintStyle(style);
                
                #ok(analysis)
            };
            case null { #err("User not found") };
        }
    };

    // ========== PRIVATE HELPER FUNCTIONS ==========

    private func isValidEmail(email : Text) : Bool {
        let partsIter = Text.split(email, #char '@');
        let parts = Iter.toArray(partsIter);
        if (parts.size() != 2) return false;

        let domainParts = Iter.toArray(Text.split(parts[1], #char '.'));
        domainParts.size() >= 2
    };

    private func trimPunctuation(word : Text) : Text {
        let punct : [Char] = ['.', ',', '!', '?', ';', ':', 
                             Char.fromNat32(39), Char.fromNat32(34), 
                             '(', ')', '-', '[', ']', '{', '}'];
        var cleaned = word;
        for (p in punct.vals()) {
            cleaned := Text.trim(cleaned, #predicate(func(c : Char) : Bool { c == p }));
        };
        cleaned
    };

    private func isCommonWord(word : Text) : Bool {
        let lw = Text.toLowercase(word);
        Array.find<Text>(stopWords, func(w : Text) : Bool { Text.equal(w, lw) }) != null
    };

    // Advanced tokenization with stemming and n-grams
    private func tokenize(text : Text) : [Text] {
        let lower = Text.toLowercase(text);
        let tokensIter = Text.tokens(
            lower,
            #predicate(
                func(c : Char) : Bool {
                    // treat these as separators
                    c == ' ' or c == '\n' or c == '\t' or 
                    c == ',' or c == '.' or c == '?' or c == '!' or 
                    c == ';' or c == ':' or c == '(' or c == ')' or 
                    c == '\"' or c == '\'' or c == '-' or c == '/'
                }
            )
        );
        
        var out = Buffer.Buffer<Text>(0);

        // Manual substring function that works even on very old Motoko
        func substring(txt : Text, start : Nat, end : Nat) : Text {
            var i : Nat = 0;
            var result : Text = "";

            for (c in txt.chars()) {
                if (i >= start and i < end) {
                    result := result # Text.fromChar(c);
                };
                i += 1;
            };

            result
        };

        for (t in Iter.toArray(tokensIter).vals()) {
            let clean = trimPunctuation(
                Text.trim(t, #predicate(func(c : Char) : Bool { c == ' ' }))
            );

            if (Text.size(clean) >= 3 and not isCommonWord(clean)) {
                // Basic stemming - remove common suffixes
                let stemmed =
                    if (Text.endsWith(clean, #text "ing")) {
                        substring(clean, 0, Text.size(clean) - 3)
                    } else if (Text.endsWith(clean, #text "ly")) {
                        substring(clean, 0, Text.size(clean) - 2)
                    } else if (Text.endsWith(clean, #text "ed")) {
                        substring(clean, 0, Text.size(clean) - 2)
                    } else {
                        clean
                    };
                out.add(stemmed);
            };
        };

        // Add bigrams for better context
        let tokens = Buffer.toArray(out);
        if (tokens.size() >= 2) {
            var bigrams = Buffer.Buffer<Text>(tokens.size() - 1);
            for (i in Iter.range(0, tokens.size() - 2)) {
                bigrams.add(tokens[i] # " " # tokens[i+1]);
            };
            Array.append(tokens, Buffer.toArray(bigrams))
        } else {
            tokens
        };
    };

    // Weighted token overlap with TF-IDF like scoring
    private func tokenOverlap(a : [Text], b : [Text]) : Float {
        var score : Float = 0.0;
        for (x in a.vals()) {
            if (Array.find<Text>(b, func(y : Text) : Bool { Text.equal(x, y) }) != null) {
                // Simple weighting - longer tokens are more significant
                score += Float.fromInt(Text.size(x)) * 0.1;
            };
        };
        score
    };

    // Compare questions by importance (descending)
    private func compareQuestionImportance(a : TrainingQuestion, b : TrainingQuestion) : Order.Order {
        if (a.importance > b.importance) { #less }
        else if (a.importance < b.importance) { #greater }
        else { #equal }
    };

    // Select question from unanswered based on importance
    private func selectQuestionByImportance(unanswered : [TrainingQuestion]) : TrainingQuestion {
        // Sort by importance (descending)
        let sorted = Array.sort(unanswered, compareQuestionImportance);
        
        // Pick from top 3 most important (or fewer if not enough)
        let pickCount = Nat.min(3, sorted.size());
        let topQuestions = Array.tabulate<TrainingQuestion>(pickCount, func(i : Nat) : TrainingQuestion { sorted[i] });

        // deterministic "random" pick using system time
        let nowNat : Nat = Int.abs(Time.now());
        let randIndex : Nat = nowNat % pickCount;
        topQuestions[randIndex]
    };

    // Match knowledge base with advanced scoring
    private func matchKnowledgeBase(
        user : UserProfile,
        message : Text,
        context : ConversationContext
    ) : ?(KnowledgeEntry, Float) {
        let msgTokens = tokenize(message);
        if (msgTokens.size() == 0) return null;

        var bestEntry : ?KnowledgeEntry = null;
        var bestScore : Float = 0.0;

        for (entry in user.knowledgeBase.vals()) {
            let qOpt = Array.find<TrainingQuestion>(trainingQuestions, func(q : TrainingQuestion) : Bool { q.id == entry.questionId });
            let questionText = switch (qOpt) {
                case (?q) q.question;
                case null "";
            };

            // Tokenize question and answer
            let qTokens = tokenize(questionText);
            let aTokens = tokenize(entry.answer);

            // Calculate scores
            let scoreQ = tokenOverlap(msgTokens, qTokens);
            let scoreA = tokenOverlap(msgTokens, aTokens);

            let importance = switch (qOpt) {
                case (?q) Float.fromInt(q.importance);
                case null 1.0;
            };

            // Recency (days) & exponential decay
            let recency = Float.fromInt(Int.abs(Time.now() - entry.lastUsed)) / 86_400_000_000_000.0;
            let recencyFactor = Float.exp(-0.1 * recency);

            // Context relevance
            let contextRelevance = if (context.recentTopics.size() > 0) {
                let topicOverlap = Array.foldLeft<Text, Float>(
                    context.recentTopics,
                    0.0,
                    func(acc : Float, topic : Text) : Float {
                        let topicTokens = tokenize(topic);
                        acc + tokenOverlap(aTokens, topicTokens)
                    }
                );
                topicOverlap / Float.fromInt(context.recentTopics.size())
            } else {
                1.0
            };

            // Final score
            let totalScore = (scoreQ + scoreA) * importance * recencyFactor * contextRelevance;

            if (totalScore > bestScore) {
                bestScore := totalScore;
                bestEntry := ?entry;
            };
        };

        switch (bestEntry) {
            case (?entry) ?(entry, bestScore);
            case null null;
        }
    };

    // Extract personality traits from text with temporal decay
    private func extractTraits(text : Text, currentTraits : [PersonalityTrait], now : Timestamp) : [PersonalityTrait] {
        let tokens = Text.tokens(text, #predicate(func(c : Char) : Bool { c == ' ' or c == '\n' or c == '\t' or c == ',' or c == '.' }));
        
        // Start with existing traits, applying time-based decay
        var traitsBuffer = Buffer.Buffer<PersonalityTrait>(currentTraits.size());
        for (t in currentTraits.vals()) {
            let hoursSinceUpdate = Float.fromInt(Int.abs(now - t.lastUpdated)) / 3_600_000_000_000.0;
            let decayFactor = Float.exp(-0.0001 * hoursSinceUpdate); // Very slow decay
            traitsBuffer.add({
                t with
                strength = t.strength * decayFactor;
                lastUpdated = now
            });
        };

        // Process new tokens
        for (tok in tokens) {
            let lower = Text.toLowercase(tok);
            let clean = trimPunctuation(lower);
            if ((Text.size(clean) > 3) and (not isCommonWord(clean))) {
                var found = false;
                
                // Check if trait already exists
                label loopName for (i in Iter.range(0, traitsBuffer.size() - 1)) {
                    let existing = traitsBuffer.get(i);
                    if (Text.equal(existing.name, clean)) {
                        traitsBuffer.put(i, {
                            existing with
                            strength = Float.min(10.0, existing.strength + 1.0);
                            lastUpdated = now
                        });
                        found := true;
                        break loopName;
                    };
                };

                if (not found) {
                    // Add new trait
                    traitsBuffer.add({
                        name = clean;
                        strength = 5.0;
                        lastUpdated = now;
                    });
                };
            };
        };

        // Fixed: Using Buffer.toArray
        let allTraits = Buffer.toArray(traitsBuffer);
        
        // Sort by strength and keep top 15
        let sortedArray = Array.sort(
            allTraits,
            func(a : PersonalityTrait, b : PersonalityTrait) : Order.Order {
                if (a.strength > b.strength) { #less }
                else if (a.strength < b.strength) { #greater }
                else { #equal }
            }
        );

        let topCount = Nat.min(15, sortedArray.size());
        Array.tabulate<PersonalityTrait>(
            topCount,
            func(i : Nat) : PersonalityTrait { sortedArray[i] }
        );
    };

    // Apply memory decay based on time and access patterns
    private func applyMemoryDecay(user : UserProfile) : UserProfile {
        let now = Time.now();
        let updatedMemories = Array.map<Memory, Memory>(user.memories, func(mem) {
            let daysSinceAccess = Float.fromInt(Int.abs(now - mem.lastAccessed)) / 86_400_000_000_000.0;
            let decayFactor = Float.pow(mem.decayRate, daysSinceAccess);
            let newWeight = Float.max(minMemoryStrength, mem.emotionalWeight * decayFactor);
            
            // Adjust decay rate based on access frequency
            let newDecayRate = if (mem.accessCount > 5) {
                Float.min(0.99, mem.decayRate + 0.01) // Slower decay for frequently accessed memories
            } else {
                mem.decayRate
            };
            
            { mem with
                emotionalWeight = newWeight;
                decayRate = newDecayRate
            }
        });
        
        // Filter out very weak memories
        let filteredMemories = Array.filter<Memory>(updatedMemories, func(m : Memory) : Bool {
            m.emotionalWeight >= minMemoryStrength
        });
        
        { user with memories = filteredMemories }
    };

    // Updated emotion analysis with emoji handling
    private func analyzeEmotion(text : Text) : ?Emotion {
        // First check for direct emojis in the text
        for ((emoji, emotion) in emojiMap.entries()) {
            if (Text.contains(text, #text emoji)) {
                return ?emotion;
            };
        };

        // Fall back to sentiment analysis if no emojis found
        let tokens = tokenize(text);
        var sentimentScore : Float = 0.0;
        var count : Nat = 0;
        
        for (t in tokens.vals()) {
            switch (sentimentWords.get(t)) {
                case (?score) {
                    sentimentScore += score;
                    count += 1;
                };
                case null {};
            };
        };
        
        if (count == 0) return null;
        
        let avgScore = sentimentScore / Float.fromInt(count);
        if (avgScore > 0.5) { ?#happy "😊" }
        else if (avgScore > 0.2) { ?#excited "🤩" }
        else if (avgScore < -0.5) { ?#angry "😠" }
        else if (avgScore < -0.2) { ?#sad "😔" }
        else { ?#neutral "😐" }
    };

    // Detect communication style from text
    private func detectCommunicationStyle(text : Text) : CommunicationStyle {
        let lower = Text.toLowercase(text);
        let tokens = tokenize(lower);
        
        // Count style indicators
        var formal = 0; 
        var casual = 0; 
        var tech = 0; 
        var humor = 0; 
        var emp = 0;
        
        for (t in tokens.vals()) {
            if (Array.find<Text>(["hi", "hey", "what's up"], func(x : Text) : Bool { x == t }) != null) { casual += 1 };
            if (Array.find<Text>(["dear", "sincerely", "respectfully"], func(x : Text) : Bool { x == t }) != null) { formal += 1 };
            if (Array.find<Text>(["algorithm", "protocol", "interface"], func(x : Text) : Bool { x == t }) != null) { tech += 1 };
            if (Array.find<Text>(["lol", "haha", "funny"], func(x : Text) : Bool { x == t }) != null) { humor += 1 };
            if (Array.find<Text>(["feel", "understand", "empathy"], func(x : Text) : Bool { x == t }) != null) { emp += 1 };
        };
        
        let maxVal = [formal, casual, tech, humor, emp];
        if (tech == Array.foldLeft<Nat, Nat>(maxVal, 0, Nat.max)) { #technical }
        else if (humor == Array.foldLeft<Nat, Nat>(maxVal, 0, Nat.max)) { #humorous }
        else if (emp == Array.foldLeft<Nat, Nat>(maxVal, 0, Nat.max)) { #empathetic }
        else if (formal == Array.foldLeft<Nat, Nat>(maxVal, 0, Nat.max)) { #formal }
        else { #casual }
    };

    // Blend communication styles with probability factor
    private func blendStyles(current : CommunicationStyle, new : CommunicationStyle, factor : Float) : CommunicationStyle {
        if (current == new) return current;

        // Generate quick pseudo-randomness from current time
        let entropy = Blob.fromArray([
            Nat8.fromNat(
                Nat64.toNat(
                    Nat64.fromIntWrap(Time.now()) % 256
                )
            )
        ]);
        let finite = Random.Finite(entropy);

        switch (finite.byte()) {
            case (?b) {
                let randFloat = Float.fromInt(Nat8.toNat(b)) / 255.0;
                if (randFloat < factor) new else current
            };
            case null current
        }
    };

    // Update conversation context
    private func updateContext(current : ConversationContext, message : Text) : ConversationContext {
        // Extract topics from message (first few non-stop words)
        let tokens = tokenize(message);
        let newTopics = if (tokens.size() > 0) {
            Array.append([tokens[0]], current.recentTopics)
        } else {
            current.recentTopics
        };
        
        // Keep only last 3 topics
        let trimmedTopics = if (newTopics.size() > 3) {
            Array.take(newTopics, 3)
        } else {
            newTopics
        };
        
        // Update emotion
        let newEmotion = analyzeEmotion(message);
        
        {
            recentTopics = trimmedTopics;
            currentEmotion = newEmotion;
            stylePreference = current.stylePreference;
        }
    };

    // Calculate training progress percentage
    private func calculateTrainingProgress(user : UserProfile) : Nat {
        let totalQuestions = trainingQuestions.size();
        if (totalQuestions == 0) return 0;
        
        let answeredCount = user.knowledgeBase.size();
        Nat.min(100, (answeredCount * 100) / totalQuestions)
    };

    // Generate advanced response with context awareness
    private func generateAdvancedResponse(
        user : UserProfile, 
        message : Text,
        context : ConversationContext
    ) : Text {
        // Try to match knowledge base first
        switch (matchKnowledgeBase(user, message, context)) {
            case (?(entry, score)) {
                // Use the answer if score is good enough
                if (score > 2.5) {
                    // Update entry usage
                    let _updatedEntry = {
                        entry with
                        lastUsed = Time.now();
                        usageCount = entry.usageCount + 1
                    };
                    
                    // Format based on preferences
                    return formatResponse(entry.answer, user.preferences, context.currentEmotion);
                };
            };
            case null {};
        };

        // Fallback to synthesized response using traits, memories and context
        let traitsText = if (user.traits.size() > 0) {
            "I know you value " # 
            Array.foldLeft<PersonalityTrait, Text>(user.traits, "", func(acc, trait) {
                if (Text.size(acc) == 0) { trait.name }
                else { acc # ", " # trait.name }
            }) # ". "
        } else { "" };

        let memoryText = if (user.memories.size() > 0) {
            // Get most relevant memory
            let sortedMemories = Array.sort(user.memories, func(a : Memory, b : Memory) : Order.Order {
                if (a.emotionalWeight > b.emotionalWeight) { #less }
                else if (a.emotionalWeight < b.emotionalWeight) { #greater }
                else { #equal }
            });
            "I remember you mentioned: \"" # sortedMemories[0].content # "\". "
        } else { "" };

        let contextText = if (context.recentTopics.size() > 0) {
            "We were discussing " # context.recentTopics[0] # ". "
        } else { "" };

        let baseResponse = "Thanks for your message. " # traitsText # memoryText # contextText;
        
        // Add follow-up based on context
        let followUp = switch (context.currentEmotion) {
            case (?#happy _ or ?#excited _) { "That sounds great! Tell me more." };
            case (?#sad _ or ?#angry _) { "I sense this is important to you. Would you like to talk more about it?" };
            case _ { "Can you tell me more about this?" };
        };
        
        formatResponse(baseResponse # followUp, user.preferences, context.currentEmotion)
    };

    // Format response according to user preferences
    private func formatResponse(text : Text, prefs : UserPreferences, emotion : ?Emotion) : Text {
        // Adjust based on depth level
        let depthAdjusted = if (prefs.depthLevel == 1) {
            // Brief mode - take first sentence
            switch (Text.split(text, #char '.').next()) {
                case (?s) { s };
                case null { text };
            }
        } else if (prefs.depthLevel == 3) {
            // Detailed mode - add elaboration
            text # " " # elaborateOnTopic(text)
        } else {
            text
        };
        
        // Adjust based on formality
        let formalityAdjusted = if (prefs.formality >= 4) {
            // Formal
            "Dear user, " # depthAdjusted # " Thank you for your inquiry."
        } else if (prefs.formality <= 2) {
            // Casual
            "Hey! " # Text.toLowercase(depthAdjusted)
        } else {
            depthAdjusted
        };
        
        // Add emotional tone if detected
        switch (emotion) {
            case (?#happy emoji) { emoji # " " # formalityAdjusted };
            case (?#sad emoji) { emoji # " " # formalityAdjusted };
            case (?#angry emoji) { emoji # " " # formalityAdjusted };
            case (?#excited emoji) { emoji # " " # formalityAdjusted };
            case (?#neutral emoji) { emoji # " " # formalityAdjusted };
            case (?#confused emoji) { emoji # " " # formalityAdjusted };
            case null { formalityAdjusted };
        }
    };

    // Simple topic elaboration (would be enhanced in real implementation)
    private func elaborateOnTopic(text : Text) : Text {
        let lower = Text.toLowercase(text);
        if (Text.contains(lower, #text "happy")) {
            "Happiness is such an important aspect of life. "
        } else if (Text.contains(lower, #text "problem")) {
            "Problems can often be opportunities in disguise. "
        } else {
            "This is an interesting topic worth exploring further. "
        }
    };

    // Helper functions for debugging
    private func debugPrintEmotion(emotion : ?Emotion) : Text {
        switch (emotion) {
            case (?#happy emoji) { "happy " # emoji };
            case (?#sad emoji) { "sad " # emoji };
            case (?#angry emoji) { "angry " # emoji };
            case (?#neutral emoji) { "neutral " # emoji };
            case (?#excited emoji) { "excited " # emoji };
            case (?#confused emoji) { "confused " # emoji };
            case null { "unknown" };
        }
    };

    private func debugPrintStyle(style : CommunicationStyle) : Text {
        switch (style) {
            case (#formal) { "formal" };
            case (#casual) { "casual" };
            case (#technical) { "technical" };
            case (#humorous) { "humorous" };
            case (#empathetic) { "empathetic" };
            case (#balanced) { "balanced" };
        }
    };

    private func formatTraits(traits : [PersonalityTrait]) : Text {
        Array.foldLeft<PersonalityTrait, Text>(traits, "", func(acc, t) {
            if (Text.size(acc) == 0) {
                t.name # "(" # Float.toText(t.strength) # ")"
            } else {
                acc # ", " # t.name # "(" # Float.toText(t.strength) # ")"
            }
        })
    };
};