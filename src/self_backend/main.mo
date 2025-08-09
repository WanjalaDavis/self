import Array "mo:base/Array";
import Blob "mo:base/Blob";
import Buffer "mo:base/Buffer";
import HashMap "mo:base/HashMap";
import Iter "mo:base/Iter";
import Nat "mo:base/Nat";
import Option "mo:base/Option";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Text "mo:base/Text";
import Time "mo:base/Time";
import Order "mo:base/Order";
import Int "mo:base/Int";
import Char "mo:base/Char";

actor UserSystem {
    // ========== TYPE DEFINITIONS ==========
    public type UserId = Principal.Principal;
    public type Username = Text.Text;
    public type Email = Text.Text;
    public type Password = Text.Text;
    public type Bio = Text.Text;
    public type ProfilePic = Blob.Blob;
    public type QuestionId = Nat.Nat;
    public type Question = Text.Text;
    public type Answer = Text.Text;
    public type ChatMessage = Text.Text;
    public type Timestamp = Time.Time;

    public type PersonalityTrait = {
        name : Text.Text;
        strength : Nat.Nat; // 1-10 scale
    };

    public type TrainingQuestion = {
        id : QuestionId;
        question : Question;
        category : Text.Text;
        importance : Nat.Nat; // 1-5 scale
    };

    public type Memory = {
        id : Nat.Nat;
        content : Text.Text;
        emotionalWeight : Nat.Nat; // 1-10 scale
        lastAccessed : Timestamp;
    };

    public type UserProfile = {
        username : Username;
        email : Email;
        bio : ?Bio;
        profilePic : ?ProfilePic;
        traits : [PersonalityTrait];
        knowledgeBase : [Answer];
        memories : [Memory];
        deployed : Bool;
        createdAt : Timestamp;
        lastUpdated : Timestamp;
    };

    // ========== RESULT TYPES ==========
    public type AuthResult = Result.Result<UserProfile, Text.Text>;
    public type ProfileResult = Result.Result<(), Text.Text>;
    public type TrainingResult = Result.Result<(), Text.Text>;
    public type DeploymentResult = Result.Result<(), Text.Text>;
    public type ChatResult = Result.Result<Text.Text, Text.Text>;
    public type QuestionResult = Result.Result<TrainingQuestion, Text.Text>;

    // ========== STATE VARIABLES ==========
    // Stable arrays used for upgrades; HashMaps are transient and reconstructed in postupgrade.
    private stable var users : [(UserId, UserProfile)] = [];
    private stable var credentials : [(UserId, Password)] = [];
    private stable var usernameToId : [(Username, UserId)] = [];
    private stable var emailToId : [(Email, UserId)] = [];
    private stable var nextMemoryId : Nat.Nat = 1;
    private stable var nextQuestionId : Nat.Nat = 17;

    // In-memory maps (not stable) for efficient lookup during normal operation.
    private var usersMap = HashMap.HashMap<UserId, UserProfile>(1, Principal.equal, Principal.hash);
    private var credentialsMap = HashMap.HashMap<UserId, Password>(1, Principal.equal, Principal.hash);
    private var usernameMap = HashMap.HashMap<Username, UserId>(1, Text.equal, Text.hash);
    private var emailMap = HashMap.HashMap<Email, UserId>(1, Text.equal, Text.hash);

    // ========== TRAINING QUESTIONS ==========
    private stable var trainingQuestions : [TrainingQuestion] = [
        { id = 0; question = "How would you describe your personality in 5 words?"; category = "personality"; importance = 5 },
        { id = 1; question = "Are you more introverted or extroverted?"; category = "personality"; importance = 4 },
        { id = 2; question = "How do you typically respond to stress?"; category = "personality"; importance = 4 },
        { id = 3; question = "What are your top 3 core values?"; category = "values"; importance = 5 },
        { id = 4; question = "What moral principle would you never compromise?"; category = "values"; importance = 5 },
        { id = 5; question = "Describe your morning routine"; category = "habits"; importance = 3 },
        { id = 6; question = "What's your ideal way to spend a weekend?"; category = "habits"; importance = 3 },
        { id = 7; question = "Are you more logical or emotional in decision making?"; category = "cognition"; importance = 4 },
        { id = 8; question = "How do you approach solving complex problems?"; category = "cognition"; importance = 4 },
        { id = 9; question = "What qualities do you value most in friends?"; category = "relationships"; importance = 4 },
        { id = 10; question = "How do you handle conflict in relationships?"; category = "relationships"; importance = 4 },
        { id = 11; question = "What's the most important lesson life has taught you?"; category = "experiences"; importance = 5 },
        { id = 12; question = "Describe a formative childhood experience"; category = "experiences"; importance = 4 },
        { id = 13; question = "Where do you see yourself in 5 years?"; category = "future"; importance = 3 },
        { id = 14; question = "What legacy would you like to leave?"; category = "future"; importance = 4 },
        { id = 15; question = "What inspires your creativity?"; category = "creativity"; importance = 3 },
        { id = 16; question = "How do you overcome creative blocks?"; category = "creativity"; importance = 3 }
    ];

    // ========== SYSTEM FUNCTIONS ==========
    system func preupgrade() {
        // Save maps into stable arrays so state survives upgrades.
        users := Iter.toArray(usersMap.entries());
        credentials := Iter.toArray(credentialsMap.entries());
        usernameToId := Iter.toArray(usernameMap.entries());
        emailToId := Iter.toArray(emailMap.entries());
        // preserve nextQuestionId in case trainingQuestions mutated
        nextQuestionId := trainingQuestions.size();
    };

    system func postupgrade() {
        // Reconstruct transient hash maps from the stable arrays saved in preupgrade.
        usersMap := HashMap.fromIter<UserId, UserProfile>(users.vals(), 1, Principal.equal, Principal.hash);
        credentialsMap := HashMap.fromIter<UserId, Password>(credentials.vals(), 1, Principal.equal, Principal.hash);
        usernameMap := HashMap.fromIter<Username, UserId>(usernameToId.vals(), 1, Text.equal, Text.hash);
        emailMap := HashMap.fromIter<Email, UserId>(emailToId.vals(), 1, Text.equal, Text.hash);

        // clear the stable temporary holders (optional but keeps upgrades idempotent)
        users := [];
        credentials := [];
        usernameToId := [];
        emailToId := [];
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
            deployed = false;
            createdAt = now;
            lastUpdated = now;
        };

        usersMap.put(userId, newUser);
        credentialsMap.put(userId, password);
        usernameMap.put(username, userId);
        emailMap.put(email, userId);

        #ok(newUser);
    };

    // User Login
    public shared (msg) func login(username : Username, password : Password) : async AuthResult {
        switch (usernameMap.get(username)) {
            case (?userId) {
                switch (credentialsMap.get(userId)) {
                    case (?storedPassword) {
                        if (Text.equal(password, storedPassword)) {
                            switch (usersMap.get(userId)) {
                                case (?user) { return #ok(user) };
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
    public shared (msg) func updateProfile(bio : ?Bio, profilePic : ?ProfilePic) : async ProfileResult {
        switch (usersMap.get(msg.caller)) {
            case (?user) {
                let updatedUser : UserProfile = {
                    username = user.username;
                    email = user.email;
                    bio = bio;
                    profilePic = profilePic;
                    traits = user.traits;
                    knowledgeBase = user.knowledgeBase;
                    memories = user.memories;
                    deployed = user.deployed;
                    createdAt = user.createdAt;
                    lastUpdated = Time.now();
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

    // Get Next Training Question
    public shared (msg) func getNextQuestion() : async QuestionResult {
        switch (usersMap.get(msg.caller)) {
            case (?user) {
                // build answered ids array from knowledgeBase entries formatted as "<id>|||<answer>"
                var answeredIds : [Nat.Nat] = [];
                for (entry in user.knowledgeBase.vals()) {
                    let partsIter = Text.split(entry, #text "|||");
                    let parts = Iter.toArray(partsIter);
                    if (Array.size(parts) > 0) {
                        switch (Nat.fromText(parts[0])) {
                            case (?id) { answeredIds := Array.append<Nat.Nat>(answeredIds, [id]) };
                            case null {};
                        };
                    };
                };

                // collect unanswered questions
                var unanswered : [TrainingQuestion] = [];
                for (q in trainingQuestions.vals()) {
                    let present = Array.find<Nat.Nat>(answeredIds, func(x : Nat.Nat) : Bool { x == q.id });
                    if (present == null) {
                        unanswered := Array.append<TrainingQuestion>(unanswered, [q]);
                    };
                };

                if (unanswered.size() == 0) {
                    return #err("All questions answered");
                };

                // Sort by importance (descending)
                let sorted = Array.sort(unanswered, func (a : TrainingQuestion, b : TrainingQuestion) : Order.Order {
                    if (a.importance > b.importance) { #less };
                    if (a.importance < b.importance) { #greater };
                    #equal;
                });

                // Pick from top 3 most important (or fewer if not enough)
                let pickCount = Nat.min(3, sorted.size());
                let topQuestions = Array.tabulate<TrainingQuestion>(pickCount, func (i : Nat.Nat) : TrainingQuestion { sorted[i] });

                // deterministic "random" pick using system time (safe here because pickCount > 0)
                let nowNat : Nat.Nat = Int.abs(Time.now());
                let randIndex : Nat.Nat = nowNat % pickCount;
                return #ok(topQuestions[randIndex]);
            };
            case null { return #err("User not found") };
        }
    };

    // Submit Training Answer
    public shared (msg) func submitAnswer(questionId : QuestionId, answer : Answer) : async TrainingResult {
        switch (usersMap.get(msg.caller)) {
            case (?user) {
                let formattedAnswer = Nat.toText(questionId) # "|||" # answer;
                let newKnowledgeBase = Array.append<Answer>(user.knowledgeBase, [formattedAnswer]);

                // Find the question to check category
                let question = Array.find<TrainingQuestion>(trainingQuestions, func (q : TrainingQuestion) : Bool { q.id == questionId });

                // Create memory if important or long answer
                let newMemories = if ((Text.size(answer) > 50) or (switch(question) { case(null) { false }; case(?q) { q.importance == 5 } })) {
                    let memory : Memory = {
                        id = nextMemoryId;
                        content = answer;
                        emotionalWeight = switch(question) { case(null) { 3 }; case(?q) { q.importance } };
                        lastAccessed = Time.now();
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
                            extractTraits(answer, user.traits)
                        } else {
                            user.traits
                        }
                    };
                    case null { user.traits };
                };

                let updatedUser : UserProfile = {
                    username = user.username;
                    email = user.email;
                    bio = user.bio;
                    profilePic = user.profilePic;
                    traits = newTraits;
                    knowledgeBase = newKnowledgeBase;
                    memories = newMemories;
                    deployed = user.deployed;
                    createdAt = user.createdAt;
                    lastUpdated = Time.now();
                };

                usersMap.put(msg.caller, updatedUser);
                #ok();
            };
            case null { return #err("User not found") };
        }
    };

    // Add Custom Training Question
    public shared (msg) func addCustomQuestion(question : Question, category : Text.Text, importance : Nat.Nat) : async QuestionResult {
        let clampedImportance = Nat.min(5, Nat.max(1, importance));
        let newQuestion : TrainingQuestion = {
            id = nextQuestionId;
            question = question;
            category = category;
            importance = clampedImportance;
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
                    deployed = true;
                    createdAt = user.createdAt;
                    lastUpdated = Time.now();
                };

                usersMap.put(msg.caller, updatedUser);
                #ok();
            };
            case null { return #err("User not found") };
        }
    };

    // Get Deployed Systems
    public shared query func getDeployedSystems() : async [(Username, UserId)] {
        var buffer : [(Username, UserId)] = [];
        for ((userId, user) in usersMap.entries()) {
            if (user.deployed) {
                buffer := Array.append<(Username, UserId)>(buffer, [(user.username, userId)]);
            };
        };
        buffer
    };

    // Chat with Deployed System
    public shared (msg) func chatWithSystem(ownerId : UserId, message : ChatMessage) : async ChatResult {
        switch (usersMap.get(ownerId)) {
            case (?user) {
                if (not user.deployed) {
                    return #err("This user hasn't deployed their system yet");
                };

                let response = generateAdvancedResponse(user, message);
                return #ok(response);
            };
            case null { return #err("User not found") };
        }
    };

    // ========== PRIVATE HELPER FUNCTIONS ==========

    private func isValidEmail(email : Text.Text) : Bool {
        let partsIter = Text.split(email, #char '@');
        let parts = Iter.toArray(partsIter);
        if (parts.size() != 2) return false;

        let domainParts = Iter.toArray(Text.split(parts[1], #char '.'));
        domainParts.size() >= 2
    };

    private func trimPunctuation(word : Text.Text) : Text.Text {
        // Trim common punctuation from both ends using a predicate pattern per-character.
        let punct : [Char.Char] = ['.' , ',' , '!' , '?' , ';' , ':' , '\'' , '"' , '(' , ')'];
        var cleaned = word;
        for (p in punct.vals()) {
            cleaned := Text.trim(cleaned, func(c : Char.Char) : Bool { c == p });
        };
        cleaned
    };

    private func isCommonWord(word : Text.Text) : Bool {
        let lw = Text.toLowercase(word);
        let commonWords : [Text.Text] = [
            "the", "and", "you", "that", "have", "for", "not", "with", "this", "but",
            "are", "was", "they", "one", "all", "can", "her", "has", "there", "their",
            "what", "out", "about", "who", "get", "which", "when", "where", "how", "why"
        ];
        Array.contains<Text.Text>(commonWords, lw, Text.equal)
    };

    // ========== TRAIT EXTRACTION ==========
    private func extractTraits(answer : Text.Text, currentTraits : [PersonalityTrait]) : [PersonalityTrait] {
        // Tokenize on whitespace and common separators
        let tokens = Text.tokens(answer, #predicate (func(c : Char.Char) { c == ' ' or c == '\n' or c == '\t' or c == ',' or c == '.' }));

        // Start from the existing immutable traits and make a mutable var-array to update counts.
        var traitsVar : [var PersonalityTrait] = Array.thaw<PersonalityTrait>(currentTraits);

        for (tok in tokens) {
            let lower = Text.toLowercase(tok);
            let clean = trimPunctuation(lower);
            if ((Text.size(clean) > 3) and (not isCommonWord(clean))) {
                var found = false;

                // search existing and update strength
                for (i in Iter.range(0, Array.size(traitsVar) - 1)) {
                    let existing = traitsVar[i];
                    if (Text.equal(existing.name, clean)) {
                        Array.set(traitsVar, i, {
                            name = existing.name;
                            strength = Nat.min(10, existing.strength + 1)
                        });
                        found := true;
                        break;
                    };
                };

                if (not found) {
                    // append a new trait (mutable arrays can't change length directly, so freeze/append/thaw)
                    traitsVar := Array.thaw<PersonalityTrait>(Array.append<PersonalityTrait>(Array.freeze(traitsVar), [{ name = clean; strength = 5 }]));
                };
            };
        };

        // Sort by strength (descending) and keep top 10
        let frozen = Array.freeze(traitsVar);
        let sortedByStrength = Array.sort(
            frozen,
            func(a : PersonalityTrait, b : PersonalityTrait) : Order.Order {
                if (a.strength > b.strength) { #less }
                else if (a.strength < b.strength) { #greater }
                else { #equal }
            }
        );

        let top10Count = Nat.min(10, sortedByStrength.size());
        let top10 = Array.tabulate<PersonalityTrait>(
            top10Count,
            func(i : Nat.Nat) : PersonalityTrait { sortedByStrength[i] }
        );

        top10
    };

    // ========== ADVANCED RESPONSE GENERATOR ==========
    private func generateAdvancedResponse(user : UserProfile, message : ChatMessage) : Text.Text {
        // Simple response generation based on user's traits and memories
        let traitsText = if (user.traits.size() > 0) {
            "I remember you described yourself as " # 
            Array.foldLeft<PersonalityTrait, Text.Text>(
                user.traits,
                "",
                func(acc : Text.Text, trait : PersonalityTrait) : Text.Text {
                    if (Text.size(acc) == 0) {
                        trait.name
                    } else {
                        acc # ", " # trait.name
                    }
                }
            ) # ". "
        } else {
            ""
        };

        let memoryText = if (user.memories.size() > 0) {
            let sortedMemories = Array.sort(
                user.memories,
                func(a : Memory, b : Memory) : Order.Order {
                    if (a.emotionalWeight > b.emotionalWeight) { #less }
                    else if (a.emotionalWeight < b.emotionalWeight) { #greater }
                    else { #equal }
                }
            );
            "I recall you mentioning: \"" # sortedMemories[0].content # "\". "
        } else {
            ""
        };

        "Thanks for your message: \"" # message # "\". " # 
        traitsText # 
        memoryText # 
        "How does that make you feel?"
    };

};
