// ===========================================
// LOAD API KEY FROM SECURE CONFIG
// ===========================================
let GEMINI_API_KEY = '';

// Try to load from config file
if (typeof window.APP_CONFIG !== 'undefined' && window.APP_CONFIG.GEMINI_API_KEY) {
    GEMINI_API_KEY = window.APP_CONFIG.GEMINI_API_KEY;
    console.log('✅ API Key loaded from config');
} else {
    console.warn('⚠️ No API key found - using offline mode');
}

// ===========================================
// CONFIGURATION
// ===========================================
const API_URL = GEMINI_API_KEY ? 
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}` : 
    null;

// Store conversation history per user
let conversations = {};

// Store reminders per user
let reminders = {};

// Get user ID from URL or generate new
const urlParams = new URLSearchParams(window.location.search);
let currentUserId = urlParams.get('userId') || 'user_' + Math.random().toString(36).substring(2, 10);

// DOM elements
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const typing = document.getElementById('typing');
const status = document.getElementById('status');

// ===========================================
// REMINDER DETECTION (Smart Companion Feature)
// ===========================================
function detectReminder(message) {
    const reminderPatterns = [
        { pattern: /remind me to (.+?)(?: at | on | in | for |\.|$)/i, type: 'simple' },
        { pattern: /remind me (.+?)(?: at | on | in | for |\.|$)/i, type: 'simple' },
        { pattern: /don't forget to (.+?)(?: at | on | in | for |\.|$)/i, type: 'simple' },
        { pattern: /reminder:?\s*(.+?)(?: at | on | in | for |\.|$)/i, type: 'simple' },
        { pattern: /set a reminder for (.+?)(?: at | on | in | for |\.|$)/i, type: 'simple' }
    ];
    
    for (let pattern of reminderPatterns) {
        const match = message.match(pattern.pattern);
        if (match && match[1]) {
            // Extract time if mentioned
            let timePattern = /(?:at|on|for|in)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i;
            let timeMatch = message.match(timePattern);
            let reminderTime = timeMatch ? timeMatch[1] : null;
            
            return {
                isReminder: true,
                text: match[1].trim(),
                time: reminderTime,
                original: message
            };
        }
    }
    return { isReminder: false };
}

function saveReminder(userId, reminderText, time) {
    if (!reminders[userId]) {
        reminders[userId] = [];
    }
    
    const reminder = {
        id: Date.now(),
        text: reminderText,
        time: time || 'later',
        createdAt: new Date().toISOString()
    };
    
    reminders[userId].push(reminder);
    
    // Store in localStorage for persistence
    try {
        localStorage.setItem(`reminders_${userId}`, JSON.stringify(reminders[userId]));
    } catch(e) {
        console.log('LocalStorage not available');
    }
    
    return reminder;
}

function loadReminders(userId) {
    try {
        const saved = localStorage.getItem(`reminders_${userId}`);
        if (saved) {
            reminders[userId] = JSON.parse(saved);
        }
    } catch(e) {
        reminders[userId] = [];
    }
    return reminders[userId] || [];
}

// ===========================================
// ENHANCED FALLBACK RESPONSES (Smarter Offline Mode)
// ===========================================
function getFallbackResponse(message) {
    const msg = message.toLowerCase();
    
    // Context-aware responses
    if (msg.includes('remind') || msg.includes('reminder') || msg.includes('forget')) {
        const reminderDetect = detectReminder(message);
        if (reminderDetect.isReminder) {
            saveReminder(currentUserId, reminderDetect.text, reminderDetect.time);
            return `🔔 Got it! I'll remind you to "${reminderDetect.text}"${reminderDetect.time ? ` at ${reminderDetect.time}` : ''}. You're on top of things! 💪`;
        }
        return "📝 Want me to set a reminder? Just say 'remind me to [task]'!";
    }
    
    const fallbacks = {
        greetings: ["Hey there! 👋", "Hello! 😊 Ready to chat?", "Hi! 💬 What's on your mind?", "Greetings! 🌟 How can I help?"],
        howAreYou: ["I'm doing great! 😊 How about you?", "Feeling awesome and ready to help! 💪", "I'm fantastic! Thanks for asking! 🌟"],
        thanks: ["You're welcome! 🙌 Happy to help!", "Anytime! 😊 That's what I'm here for!", "My pleasure! 💪"],
        goodbye: ["Take care! 👋 Come back anytime!", "See you later! 🌟 Stay awesome!", "Goodbye! 😊 Have a great day!"],
        help: ["🤖 I'm IA Bot, your smart companion! I can:\n• Chat with you\n• Set reminders\n• Answer questions\n• Give motivation\n\nTry saying 'remind me to...' or ask me anything!"],
        motivation: ["💪 You've got this! Every step counts!", "🌟 Keep going! You're doing amazing!", "🔥 Believe in yourself! You're capable of great things!"],
        study: ["📚 Study tip: 25 mins focus, 5 mins break (Pomodoro)!", "🧠 Try active recall - it's scientifically proven to help memory!", "💡 Pro tip: Teach what you learn to someone else!"],
        time: [`⏰ Current time: ${new Date().toLocaleTimeString()}`, "⌚ Time management is key! Want me to set a reminder?"],
        weather: ["🌤️ I'd love to check the weather, but I'm offline right now!", "☔ Connect to internet and I can check the weather for you!"],
        joke: ["😂 Why don't scientists trust atoms? Because they make up everything!", "🤣 What do you call a fake noodle? An impasta!"],
        default: [
            "That's interesting! 😊 Tell me more about it.",
            "I see! 🤔 How can I help you with that?",
            "Thanks for sharing! 💡 What else would you like to talk about?",
            "Hmm, let me think about that... 🤔"
        ]
    };
    
    // Check for keywords
    if (msg.match(/^(hi|hello|hey|yo)/)) return fallbacks.greetings[Math.floor(Math.random() * fallbacks.greetings.length)];
    if (msg.match(/how are you|how are ya/)) return fallbacks.howAreYou[Math.floor(Math.random() * fallbacks.howAreYou.length)];
    if (msg.match(/thank|thanks|appreciate/)) return fallbacks.thanks[Math.floor(Math.random() * fallbacks.thanks.length)];
    if (msg.match(/bye|goodbye|see you|cya/)) return fallbacks.goodbye[Math.floor(Math.random() * fallbacks.goodbye.length)];
    if (msg.match(/help|commands|what can you do/)) return fallbacks.help[0];
    if (msg.match(/motivate|motivation|inspire|encourage/)) return fallbacks.motivation[Math.floor(Math.random() * fallbacks.motivation.length)];
    if (msg.match(/study|learn|homework|exam|test/)) return fallbacks.study[Math.floor(Math.random() * fallbacks.study.length)];
    if (msg.match(/time|clock/)) return fallbacks.time[Math.floor(Math.random() * fallbacks.time.length)];
    if (msg.match(/weather|rain|sunny|storm/)) return fallbacks.weather[Math.floor(Math.random() * fallbacks.weather.length)];
    if (msg.match(/joke|funny|laugh/)) return fallbacks.joke[Math.floor(Math.random() * fallbacks.joke.length)];
    if (msg.match(/my reminders|show reminders|list reminders/)) {
        const userReminders = loadReminders(currentUserId);
        if (userReminders.length === 0) return "📭 You don't have any reminders yet! Try saying 'remind me to...'";
        return `📋 Your reminders:\n${userReminders.map((r, i) => `${i+1}. ${r.text}${r.time !== 'later' ? ` (${r.time})` : ''}`).join('\n')}`;
    }
    
    return fallbacks.default[Math.floor(Math.random() * fallbacks.default.length)];
}

// ===========================================
// FIXED GEMINI API CALL (No Errors!)
// ===========================================
async function callGemini(userMessage, userId) {
    // If no API key, use fallback
    if (!GEMINI_API_KEY || !API_URL) {
        console.log('No API key - using offline mode');
        status.textContent = '📡 No API Key - Offline Mode';
        return getFallbackResponse(userMessage);
    }
    
    try {
        // Initialize conversation if needed
        if (!conversations[userId]) {
            conversations[userId] = [];
        }
        
        // Prepare the conversation properly
        const contents = [];
        
        // Add system instruction as conversation start (compatible with all models)
        if (conversations[userId].length === 0) {
            contents.push({
                role: "user",
                parts: [{ text: "You are IA Bot, a friendly, helpful, and encouraging AI assistant. You give short, helpful responses with emojis. Keep responses under 3 sentences. Be warm and supportive. You can help set reminders too." }]
            });
            contents.push({
                role: "model", 
                parts: [{ text: "Hey there! 👋 I'm IA Bot! I'm here to chat, help with reminders, and support you. What's on your mind? 😊" }]
            });
        }
        
        // Add conversation history
        for (let msg of conversations[userId]) {
            contents.push({
                role: msg.role,
                parts: [{ text: msg.parts[0].text }]
            });
        }
        
        // Add current user message
        contents.push({
            role: "user",
            parts: [{ text: userMessage }]
        });
        
        // Limit conversation length (keep last 15 exchanges)
        while (contents.length > 17) {
            contents.splice(1, 1);
        }
        
        const requestBody = {
            contents: contents,
            generationConfig: {
                temperature: 0.8,
                maxOutputTokens: 300,
                topP: 0.9
            }
        };
        
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });
        
        // Handle specific error codes
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('API Error:', errorData);
            
            if (response.status === 429) {
                status.textContent = '⚠️ Rate limit hit - using offline mode';
                return getFallbackResponse(userMessage);
            } else if (response.status === 403) {
                status.textContent = '❌ Invalid API key! Check Google AI Studio';
                return "🔑 My API key isn't working! Please check it in Google AI Studio and update the code.";
            } else if (response.status === 400) {
                status.textContent = '⚠️ Using offline mode';
                return getFallbackResponse(userMessage);
            }
            
            return getFallbackResponse(userMessage);
        }
        
        const data = await response.json();
        
        // Extract response properly
        if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
            const botReply = data.candidates[0].content.parts[0].text;
            
            // Save to conversation history
            conversations[userId].push({
                role: "user",
                parts: [{ text: userMessage }]
            });
            conversations[userId].push({
                role: "model",
                parts: [{ text: botReply }]
            });
            
            return botReply;
        } else {
            console.error('Unexpected response:', data);
            return getFallbackResponse(userMessage);
        }
        
    } catch (error) {
        console.error('Network Error:', error);
        status.textContent = '⚠️ No internet - offline mode';
        return getFallbackResponse(userMessage);
    }
}

// ===========================================
// ENHANCED UI FUNCTIONS
// ===========================================
function addMessage(message, isUser) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user' : 'bot'}`;
    
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Format message with emojis and line breaks
    const formattedMessage = message.replace(/\n/g, '<br>');
    
    messageDiv.innerHTML = `
        <div class="message-content">${formattedMessage}</div>
        <div class="message-time">${time}</div>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // ===========================================
    // SEND RESPONSE TO REACT NATIVE APP
    // ===========================================
    if (!isUser && (window.ReactNativeWebView || window.webkit || window.parent !== window)) {
        const responseData = {
            type: 'AI_RESPONSE',
            response: message,
            isReminder: message.includes('remind') || message.includes('🔔') || message.includes('reminder'),
            reminderText: (message.match(/remind you to "(.+?)"/) || message.match(/remind you to (.+?)(?:\!|\.|$)/))?.[1] || null
        };
        
        // Send to React Native WebView
        if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify(responseData));
            console.log('📱 Sent to React Native:', responseData);
        }
        // Send to iOS WebView
        else if (window.webkit && window.webkit.messageHandlers) {
            window.webkit.messageHandlers.app.postMessage(responseData);
        }
        // Send to iframe
        else if (window.parent !== window) {
            window.parent.postMessage(responseData, '*');
        }
    }
}

async function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;
    
    addMessage(message, true);
    chatInput.value = '';
    
    typing.classList.add('active');
    status.textContent = `🧠 Thinking...`;
    
    try {
        // First check for reminders in the message
        const reminderCheck = detectReminder(message);
        
        if (reminderCheck.isReminder && !navigator.onLine) {
            // Handle reminder offline
            const saved = saveReminder(currentUserId, reminderCheck.text, reminderCheck.time);
            typing.classList.remove('active');
            addMessage(`🔔 Got it! I'll remind you to "${reminderCheck.text}"${reminderCheck.time ? ` at ${reminderCheck.time}` : ''}. I'll save this for when we're back online! 💪`, false);
            status.textContent = `📝 Reminder saved offline`;
            return;
        }
        
        // Get AI response
        const response = await callGemini(message, currentUserId);
        typing.classList.remove('active');
        addMessage(response, false);
        status.textContent = `✅ Gemini AI • Online`;
        
    } catch (error) {
        typing.classList.remove('active');
        const fallback = getFallbackResponse(message);
        addMessage(fallback, false);
        status.textContent = `⚠️ Offline Mode`;
    }
    
    // Reset input height and focus
    chatInput.style.height = 'auto';
    chatInput.focus();
}

// Handle Enter key with Shift+Enter for new lines
chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Auto-resize textarea
chatInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});

// ===========================================
// API KEY VALIDATION
// ===========================================
function checkAPIKey() {
    if (!GEMINI_API_KEY || GEMINI_API_KEY === '') {
        status.innerHTML = '⚠️ NEED API KEY! Get one free at: aistudio.google.com/apikey';
        status.style.color = '#f97316';
        addMessage("🔑 **Welcome to IA Bot!**\n\nTo get started, you need a free Gemini API key:\n\n1. Go to **aistudio.google.com/apikey**\n2. Sign in with Google\n3. Click 'Create API Key'\n4. Copy your key and paste it in config.js\n\nIt's completely free! 🎉", false);
    } else {
        status.innerHTML = `✅ Gemini AI Ready • Free & Smart`;
        status.style.color = '#22c55e';
        addMessage("✨ **Hey there! I'm IA Bot, your smart companion!** ✨\n\nI can:\n💬 Chat with you naturally\n📝 Set and save reminders\n🎯 Give motivation & study tips\n🧠 Remember our conversations\n\nTry saying: **'remind me to...'** or just ask me anything!\n\nWhat would you like to talk about? 😊", false);
        
        // Load saved reminders
        const savedReminders = loadReminders(currentUserId);
        if (savedReminders.length > 0) {
            setTimeout(() => {
                addMessage(`📋 I found ${savedReminders.length} saved reminder${savedReminders.length > 1 ? 's' : ''} for you! Say "show my reminders" to see them.`, false);
            }, 1000);
        }
    }
}

// ===========================================
// NETWORK STATUS HANDLER
// ===========================================
function updateNetworkStatus() {
    if (!navigator.onLine) {
        status.innerHTML = '📡 Offline Mode • Reminders will be saved';
        status.style.color = '#f97316';
    } else if (GEMINI_API_KEY && GEMINI_API_KEY !== '') {
        status.innerHTML = `✅ Gemini AI • Online`;
        status.style.color = '#22c55e';
    }
}

window.addEventListener('online', updateNetworkStatus);
window.addEventListener('offline', updateNetworkStatus);

// ===========================================
// LISTEN FOR MESSAGES FROM REACT NATIVE
// ===========================================
window.addEventListener('sendMessage', (event) => {
    const message = event.detail;
    if (message) {
        console.log('📱 Received message from React Native:', message);
        chatInput.value = message;
        sendMessage();
    }
});

// Also listen for custom event from WebView injection
window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SEND_MESSAGE') {
        console.log('📱 Received from React Native (postMessage):', event.data.message);
        chatInput.value = event.data.message;
        sendMessage();
    }
});

// ===========================================
// INITIALIZE
// ===========================================
checkAPIKey();
updateNetworkStatus();
chatInput.focus();

console.log('🤖 IA Bot Ready! User ID:', currentUserId);
console.log('💡 Tip: Say "remind me to..." to set reminders!');
console.log('📱 React Native bridge active - ready to communicate!');
