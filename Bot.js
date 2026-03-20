// ===========================================
// YOUR GEMINI API KEY - PASTE HERE!
// ===========================================
const GEMINI_API_KEY = 'AIzaSyBY6arSr8SbTwnC6dcE40rPasUh1vBoUys';

// ===========================================
// CONFIGURATION
// ===========================================
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

// Store conversation history per user
let conversations = {};

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
// GEMINI API CALL
// ===========================================
async function callGemini(userMessage, userId) {
    try {
        // Get or create conversation history for this user
        if (!conversations[userId]) {
            conversations[userId] = [
                {
                    role: "user",
                    parts: [{ text: "Hi! I'm ready to chat!" }]
                },
                {
                    role: "model",
                    parts: [{ text: "Hey there! 👋 I'm IA Bot! I'm here to help with anything you need - questions, advice, motivation, or just a chat. What's on your mind? 😊" }]
                }
            ];
        }
        
        // Add user message to history
        conversations[userId].push({
            role: "user",
            parts: [{ text: userMessage }]
        });
        
        // Keep only last 20 messages
        if (conversations[userId].length > 20) {
            conversations[userId] = conversations[userId].slice(-20);
        }
        
        // Prepare request
        const requestBody = {
            contents: conversations[userId],
            system_instruction: {
                parts: [{ text: "You are IA Bot, a friendly, helpful, and encouraging AI assistant. You are like a study buddy and life coach. You give short, helpful responses with emojis. You're warm and supportive. Keep responses under 3 sentences unless asked for more detail." }]
            },
            generationConfig: {
                temperature: 0.8,
                maxOutputTokens: 500,
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
        
        if (!response.ok) {
            const error = await response.text();
            console.error('API Error:', error);
            return getFallbackResponse(userMessage);
        }
        
        const data = await response.json();
        const botReply = data.candidates[0]?.content?.parts[0]?.text || "Sorry, I couldn't process that. 😅";
        
        // Add bot response to history
        conversations[userId].push({
            role: "model",
            parts: [{ text: botReply }]
        });
        
        return botReply;
        
    } catch (error) {
        console.error('Gemini Error:', error);
        status.textContent = '⚠️ Using offline mode';
        return getFallbackResponse(userMessage);
    }
}

// ===========================================
// FALLBACK RESPONSES (when no internet)
// ===========================================
function getFallbackResponse(message) {
    const msg = message.toLowerCase();
    
    const fallbacks = {
        greetings: ["Hey there! 👋", "Hello! 😊", "Hi! 💬", "Greetings! 🌟"],
        howAreYou: ["I'm doing great! 😊 How about you?", "Feeling awesome! 💪", "I'm ready to help! 🌟"],
        thanks: ["You're welcome! 🙌", "Happy to help! 😊", "Anytime! 💪"],
        goodbye: ["Take care! 👋", "See you later! 🌟", "Goodbye! 😊"],
        help: ["I'm your AI assistant! 🤖 Ask me anything!"],
        motivation: ["💪 You've got this!", "🌟 Keep going!", "🔥 You're amazing!"],
        study: ["📚 Study tip: 25 mins focus, 5 mins break!", "🧠 Active recall helps memory!"],
        default: [
            "That's interesting! 😊 Tell me more.",
            "I see! 🤔 How can I help?",
            "Thanks for sharing! 💡 What else?"
        ]
    };
    
    if (msg.match(/^(hi|hello|hey)/)) {
        return fallbacks.greetings[Math.floor(Math.random() * fallbacks.greetings.length)];
    }
    if (msg.match(/how are you/)) {
        return fallbacks.howAreYou[Math.floor(Math.random() * fallbacks.howAreYou.length)];
    }
    if (msg.match(/thank|thanks/)) {
        return fallbacks.thanks[Math.floor(Math.random() * fallbacks.thanks.length)];
    }
    if (msg.match(/bye|goodbye/)) {
        return fallbacks.goodbye[Math.floor(Math.random() * fallbacks.goodbye.length)];
    }
    if (msg.match(/help/)) {
        return fallbacks.help[0];
    }
    if (msg.match(/motivate|motivation/)) {
        return fallbacks.motivation[Math.floor(Math.random() * fallbacks.motivation.length)];
    }
    if (msg.match(/study|learn/)) {
        return fallbacks.study[Math.floor(Math.random() * fallbacks.study.length)];
    }
    
    return fallbacks.default[Math.floor(Math.random() * fallbacks.default.length)];
}

// ===========================================
// UI FUNCTIONS
// ===========================================
function addMessage(message, isUser) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user' : 'bot'}`;
    
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    messageDiv.innerHTML = `
        <div class="message-content">${message.replace(/\n/g, '<br>')}</div>
        <div class="message-time">${time}</div>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;
    
    addMessage(message, true);
    chatInput.value = '';
    
    typing.classList.add('active');
    status.textContent = `🧠 Thinking...`;
    
    try {
        const response = await callGemini(message, currentUserId);
        typing.classList.remove('active');
        addMessage(response, false);
        status.textContent = `✅ Gemini AI • Online`;
    } catch (error) {
        typing.classList.remove('active');
        const fallback = getFallbackResponse(message);
        addMessage(fallback, false);
        status.textContent = `⚠️ Offline Mode • Using fallback`;
    }
}

// ===========================================
// CHECK API KEY
// ===========================================
function checkAPIKey() {
    if (GEMINI_API_KEY === 'YOUR_API_KEY_HERE') {
        status.innerHTML = '⚠️ NEED API KEY! Go to: aistudio.google.com/apikey';
        status.style.color = '#f97316';
        addMessage("⚠️ Hey! I need my Gemini API key to work properly.\n\nPlease add it in bot.js! Go to **aistudio.google.com/apikey** to get one for free.", false);
    } else {
        status.innerHTML = `✅ Gemini AI Ready • Free & Smart`;
        status.style.color = '#22c55e';
    }
}

// ===========================================
// EVENT LISTENERS
// ===========================================
sendBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

// Initialize
checkAPIKey();
chatInput.focus();

console.log('🤖 IA Bot Ready! User ID:', currentUserId);
