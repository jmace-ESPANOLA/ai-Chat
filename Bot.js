// ===========================================
// GROQ AI CHATBOT - bot.js
// Free, Fast, Smart!
// ===========================================

// YOUR GROQ API KEY - PASTE HERE!
const GROQ_API_KEY = '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';

// Groq API URL (FREE!)
const API_URL = 'https://api.groq.com/openai/v1/chat/completions';

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
// GROQ API CALL (FREE!)
// ===========================================
async function callGroq(userMessage, userId) {
    try {
        // Get or create conversation history for this user
        if (!conversations[userId]) {
            conversations[userId] = [];
        }
        
        // Build messages for Groq
        let messages = [
            {
                role: "system",
                content: "You are IA Bot, a friendly, helpful, and encouraging AI assistant. You are like a study buddy and life coach. You give short, helpful responses with emojis. You're warm and supportive. Keep responses under 3 sentences unless asked for more detail."
            }
        ];
        
        // Add conversation history (last 15 exchanges)
        const historyToUse = conversations[userId].slice(-15);
        for (let msg of historyToUse) {
            messages.push({
                role: msg.role,
                content: msg.content
            });
        }
        
        // Add current user message
        messages.push({
            role: "user",
            content: userMessage
        });
        
        // Prepare request
        const requestBody = {
            model: "llama-3.1-70b-versatile",  // FREE model
            messages: messages,
            temperature: 0.8,
            max_tokens: 500,
            top_p: 0.9
        };
        
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const error = await response.text();
            console.error('API Error:', error);
            return getFallbackResponse(userMessage);
        }
        
        const data = await response.json();
        const botReply = data.choices[0]?.message?.content || "Sorry, I couldn't process that. 😅";
        
        // Store in conversation history
        if (!conversations[userId]) conversations[userId] = [];
        conversations[userId].push({ role: "user", content: userMessage });
        conversations[userId].push({ role: "assistant", content: botReply });
        
        // Keep only last 30 messages
        if (conversations[userId].length > 30) {
            conversations[userId] = conversations[userId].slice(-30);
        }
        
        return botReply;
        
    } catch (error) {
        console.error('Groq Error:', error);
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
        math: ["🧮 1+1 = 2! Easy! 😊", "Math is fun! Need help with something?"],
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
    if (msg.match(/1\+1|what is 1\+1/)) {
        return fallbacks.math[0];
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
        const response = await callGroq(message, currentUserId);
        typing.classList.remove('active');
        addMessage(response, false);
        status.textContent = `✅ Groq AI (Llama 3) • Free & Fast`;
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
    if (GROQ_API_KEY === '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') {
        status.innerHTML = '⚠️ NEED API KEY! Go to: console.groq.com';
        status.style.color = '#f97316';
        addMessage("⚠️ Hey! I need my Groq API key to work properly.\n\nPlease add it in bot.js! Go to **console.groq.com** to get one for free.", false);
    } else {
        status.innerHTML = `✅ Groq AI (Llama 3) • Free & Fast`;
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

console.log('🤖 IA Bot Ready with Groq! User ID:', currentUserId);
