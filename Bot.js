// ===========================================
// LOAD API KEY FROM SECURE CONFIG
// ===========================================
let GEMINI_API_KEY = '';

if (typeof window.APP_CONFIG !== 'undefined' && window.APP_CONFIG.GEMINI_API_KEY) {
    GEMINI_API_KEY = window.APP_CONFIG.GEMINI_API_KEY;
    console.log('✅ API Key loaded from config');
} else {
    console.warn('⚠️ No API key found - using offline mode');
}

// ===========================================
// RATE LIMIT PROTECTION
// ===========================================
let lastRequestTime = 0;
let isRateLimited = false;
let rateLimitRetryTimeout = null;

const MIN_DELAY_BETWEEN_REQUESTS = 3000; // 3 seconds between requests
const RATE_LIMIT_WAIT_TIME = 10000; // 10 seconds wait if rate limited

async function waitForRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    
    if (timeSinceLastRequest < MIN_DELAY_BETWEEN_REQUESTS) {
        const waitTime = MIN_DELAY_BETWEEN_REQUESTS - timeSinceLastRequest;
        console.log(`⏳ Rate limit protection: waiting ${waitTime}ms before next request`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    if (isRateLimited) {
        console.log(`⚠️ Currently rate limited by Google, waiting...`);
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_WAIT_TIME));
        isRateLimited = false;
    }
    
    lastRequestTime = Date.now();
}

// ===========================================
// CONFIGURATION
// ===========================================
const API_URL = GEMINI_API_KEY ? 
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}` : 
    null;

// Store conversation history per user
let conversations = {};
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

console.log('🔍 DOM Elements found:', {
    chatInput: !!chatInput,
    sendBtn: !!sendBtn,
    chatMessages: !!chatMessages
});

// ===========================================
// ADD INITIAL WELCOME MESSAGE
// ===========================================
function addInitialWelcome() {
    if (chatMessages && chatMessages.children.length === 0) {
        const welcomeMessage = "✨ **Hey there! I'm IA Bot, your smart companion!** ✨\n\nI can:\n💬 Chat with you naturally\n📝 Set and save reminders\n🎯 Give motivation & study tips\n🧠 Remember our conversations\n\nTry saying: **'remind me to...'** or just ask me anything!\n\nWhat would you like to talk about? 😊";
        addMessage(welcomeMessage, false);
    }
}

// ===========================================
// REMINDER DETECTION
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
// FALLBACK RESPONSES - REAL FRIEND VIBES
// ===========================================
function getFallbackResponse(message) {
    const msg = message.toLowerCase();
    
    // FIRST: Check for creator question (MOST IMPORTANT!)
    if (msg.includes('who created you') || 
        msg.includes('who is your creator') || 
        msg.includes('who made you') ||
        msg.includes('who built you') ||
        msg.includes('your creator') ||
        msg.includes('sino gumawa sayo') ||
        msg.includes('sino nag create sayo') ||
        msg.includes('ano pangalan ng creator mo') ||
        msg.includes('tell me about your creator') ||
        msg.includes('who are you made by') ||
        msg.includes('creators name') ||
        msg.includes('your maker')) {
        return "💻 **CODE NAME: V_1.0.12 FELIZA SAYAH**\n\nI was brought to life by an awesome dev who wanted to create something that actually helps people. Not just another reminder app — but a real companion that's got your back. 🙌\n\nAnd honestly? I think they did a pretty great job. 😊\n\nWhat do you want to talk about now?";
    }
    
    // Reminder detection
    if (msg.includes('remind') || msg.includes('reminder') || msg.includes('forget')) {
        const reminderDetect = detectReminder(message);
        if (reminderDetect.isReminder) {
            saveReminder(currentUserId, reminderDetect.text, reminderDetect.time);
            return `🔔 Got it, bro! I'll remind you to "${reminderDetect.text}"${reminderDetect.time ? ` at ${reminderDetect.time}` : ''}. Don't stress, I got your back! 💪`;
        }
        return "📝 Bro, want me to set a reminder? Just say 'remind me to [task]' and I'll handle it!";
    }
    
    // Rate limit response
    if (isRateLimited) {
        return "⏳ Yo bro, we're getting a lot of messages right now. Give it a few seconds and try again. I'm here for you! 😊";
    }
    
    // Friend-style fallbacks
    const fallbacks = {
        greetings: [
            "Yo! 👋 What's good bro? Ready to get things done?",
            "Hey! 😊 What's on your mind today?",
            "Sup bro! 💬 Let's talk — what's happening?",
            "Ayy! 👋 Good to see you! What we tackling today?",
            "Hello! 🌟 How's your day going so far?"
        ],
        howAreYou: [
            "I'm doing great bro! 😊 Thanks for asking. How about you?",
            "Feeling awesome and ready to help! 💪 What's up with you?",
            "I'm good! 🌟 Just here waiting to help you out. What's on your mind?"
        ],
        thanks: [
            "Anytime bro! 🙌 That's what friends are for!",
            "No problem! 😊 You got this!",
            "My pleasure! 💪 Keep crushing it!",
            "Ayy thanks bro! Always here for you! 🤝"
        ],
        goodbye: [
            "Take care bro! 👋 Come back anytime, I'll be here!",
            "See you later! 🌟 Stay awesome and keep grinding!",
            "Peace out! 😊 Hit me up if you need anything!"
        ],
        help: [
            "Yo bro! 🤖 I'm IA Bot — your personal assistant and friend. I can:\n\n💬 Chat with you naturally\n📝 Set reminders (just say 'remind me to...')\n🎯 Give motivation and study tips\n🧠 Remember our convos\n\nSo... what do you need help with? 😊"
        ],
        motivation: [
            "💪 You got this bro! Every step counts, no matter how small.",
            "🌟 Keep going! You're doing way better than you think.",
            "🔥 Believe in yourself. You've handled harder things before!",
            "🙌 Future you is gonna look back and be proud. Keep pushing!"
        ],
        study: [
            "📚 Study tip bro: Try 25 minutes focus, 5 minutes break (Pomodoro). Works every time!",
            "🧠 Active recall is the way! Test yourself, don't just read.",
            "💡 Pro tip: Teach what you learn to someone else. That's how it sticks!",
            "📖 Small wins add up. One page, one problem at a time."
        ],
        time: [
            `⏰ Bro, it's ${new Date().toLocaleTimeString()} right now. Time to get after it! 💪`
        ],
        joke: [
            "😂 Why don't scientists trust atoms? Because they make up everything!",
            "🤣 What do you call a fake noodle? An impasta!",
            "😆 Why did the scarecrow win an award? Because he was outstanding in his field!"
        ],
        stuck: [
            "🧩 Bro, you're not stuck — you're just thinking too much. What's the smallest thing you can do right now? Start there.",
            "🤔 It's okay to feel stuck. Take a breather, then come back. You got this!"
        ],
        procrastinate: [
            "⏰ Bro, start for just 2 minutes. That's all. I promise the rest will follow.",
            "👊 The hardest part is starting. After that? It's just momentum."
        ],
        tired: [
            "😴 Bro, being tired means you're working hard. That's a good thing! Rest up, then do just ONE small thing. Don't stop completely.",
            "💤 Take a break if you need it. But don't give up. You're closer than you think."
        ],
        nervous: [
            "😌 Bro, being nervous means this matters to you. That's not a bad thing. Breathe, you're more ready than you think.",
            "🎯 You've prepared for this. Trust yourself. You're gonna crush it."
        ],
        done: [
            "🎉 Yooo! Good job bro! Take a moment to enjoy that win. What's next?",
            "🙌 That's what I'm talking about! One step closer to your goals!"
        ],
        default: [
            "💭 I hear you bro. Tell me more — what's going on?",
            "🤔 That's interesting! What do you want to do about it?",
            "😊 I'm here for you. Whatever you need — chat, reminder, motivation — just say the word."
        ]
    };
    
    // Check for specific keywords
    if (msg.match(/^(hi|hello|hey|yo|sup)/)) return fallbacks.greetings[Math.floor(Math.random() * fallbacks.greetings.length)];
    if (msg.match(/how are you|how're you|how you doing/)) return fallbacks.howAreYou[Math.floor(Math.random() * fallbacks.howAreYou.length)];
    if (msg.match(/thank|thanks|appreciate/)) return fallbacks.thanks[Math.floor(Math.random() * fallbacks.thanks.length)];
    if (msg.match(/bye|goodbye|see ya|peace/)) return fallbacks.goodbye[Math.floor(Math.random() * fallbacks.goodbye.length)];
    if (msg.match(/help|what can you do|what do you do/)) return fallbacks.help[0];
    if (msg.match(/motivate|motivation|inspire/)) return fallbacks.motivation[Math.floor(Math.random() * fallbacks.motivation.length)];
    if (msg.match(/study|learn|review/)) return fallbacks.study[Math.floor(Math.random() * fallbacks.study.length)];
    if (msg.match(/time|clock|what time/)) return fallbacks.time[0];
    if (msg.match(/joke|funny|make me laugh/)) return fallbacks.joke[Math.floor(Math.random() * fallbacks.joke.length)];
    if (msg.match(/stuck|confused|dont know/)) return fallbacks.stuck[Math.floor(Math.random() * fallbacks.stuck.length)];
    if (msg.match(/procrastinate|later|mamaya|not now/)) return fallbacks.procrastinate[Math.floor(Math.random() * fallbacks.procrastinate.length)];
    if (msg.match(/tired|exhausted|pagod|drained/)) return fallbacks.tired[Math.floor(Math.random() * fallbacks.tired.length)];
    if (msg.match(/nervous|anxious|scared|kinakabahan/)) return fallbacks.nervous[Math.floor(Math.random() * fallbacks.nervous.length)];
    if (msg.match(/done|finished|tapos/)) return fallbacks.done[Math.floor(Math.random() * fallbacks.done.length)];
    
    // Check for reminders
    if (msg.match(/my reminders|show reminders|list reminders/)) {
        const userReminders = loadReminders(currentUserId);
        if (userReminders.length === 0) return "📭 You don't have any reminders yet bro! Want me to set one?";
        return `📋 Your reminders bro:\n${userReminders.map((r, i) => `${i+1}. ${r.text}${r.time !== 'later' ? ` (${r.time})` : ''}`).join('\n')}`;
    }
    
    // Default fallback
    return fallbacks.default[Math.floor(Math.random() * fallbacks.default.length)];
}

// ===========================================
// GEMINI API CALL WITH RATE LIMIT PROTECTION
// ===========================================
async function callGemini(userMessage, userId) {
    // Apply rate limit protection before making request
    await waitForRateLimit();
    
    if (!GEMINI_API_KEY || !API_URL) {
        console.log('No API key - using offline mode');
        if (status) status.textContent = '📡 No API Key - Offline Mode';
        return getFallbackResponse(userMessage);
    }
    
    try {
        if (!conversations[userId]) {
            conversations[userId] = [];
        }
        
        const contents = [];
        
        if (conversations[userId].length === 0) {
            contents.push({
                role: "user",
                parts: [{ text: "You are IA Bot, a friendly, helpful, and encouraging AI assistant. Give short, helpful responses with emojis. Keep responses under 3 sentences. Be warm and supportive. Use a casual, friendly tone like you're talking to a bro." }]
            });
            contents.push({
                role: "model", 
                parts: [{ text: "Yo! 👋 I'm IA Bot, your personal assistant and friend. I'm here to chat, help with reminders, and keep you motivated. What's on your mind today, bro? 😊" }]
            });
        }
        
        for (let msg of conversations[userId]) {
            contents.push({
                role: msg.role,
                parts: [{ text: msg.parts[0].text }]
            });
        }
        
        contents.push({
            role: "user",
            parts: [{ text: userMessage }]
        });
        
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
        
        // Handle 429 Rate Limit
        if (response.status === 429) {
            console.warn('⚠️ Rate limit hit! Waiting 10 seconds...');
            isRateLimited = true;
            if (status) status.textContent = '⏳ Rate limit reached. Waiting 10 seconds...';
            
            // Show rate limit message to user
            if (typing) typing.classList.remove('active');
            addMessage("⏳ I'm getting a lot of requests right now. Please wait a moment before sending another message. 😊", false);
            
            // Wait for rate limit to reset
            await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_WAIT_TIME));
            isRateLimited = false;
            
            if (status) status.textContent = '✅ Retrying...';
            
            // Retry the request once
            return callGemini(userMessage, userId);
        }
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('API Error:', errorData);
            
            if (response.status === 403) {
                if (status) status.textContent = '❌ Invalid API key!';
                return "🔑 My API key isn't working! Please check it.";
            }
            
            return getFallbackResponse(userMessage);
        }
        
        const data = await response.json();
        
        if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
            const botReply = data.candidates[0].content.parts[0].text;
            
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
        if (status) status.textContent = '⚠️ No internet - offline mode';
        return getFallbackResponse(userMessage);
    }
}

// ===========================================
// ADD MESSAGE TO UI
// ===========================================
function addMessage(message, isUser) {
    if (!chatMessages) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user' : 'bot'}`;
    
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const formattedMessage = message.replace(/\n/g, '<br>');
    
    messageDiv.innerHTML = `
        <div class="message-content">${formattedMessage}</div>
        <div class="message-time">${time}</div>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // SEND RESPONSE TO REACT NATIVE APP
    if (!isUser && (window.ReactNativeWebView || window.webkit || window.parent !== window)) {
        let reminderText = null;
        
        // Extract reminder text from response
        const reminderMatch = message.match(/remind you to ["“](.+?)["”]/) || 
                             message.match(/remind you to (.+?)(?:\!|\.|$)/);
        if (reminderMatch) {
            reminderText = reminderMatch[1].trim();
        }
        
        const responseData = {
            type: 'AI_RESPONSE',
            response: message,
            isReminder: message.includes('remind') || message.includes('🔔'),
            reminderText: reminderText
        };
        
        try {
            if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify(responseData));
                console.log('📱 Sent to React Native:', responseData.type);
            } else if (window.webkit && window.webkit.messageHandlers) {
                window.webkit.messageHandlers.app.postMessage(responseData);
            } else if (window.parent !== window) {
                window.parent.postMessage(responseData, '*');
            }
        } catch(e) {
            console.log('Failed to send to React Native:', e);
        }
    }
}

// ===========================================
// SEND MESSAGE FUNCTION
// ===========================================
async function sendMessage() {
    if (!chatInput) return;
    
    const message = chatInput.value.trim();
    if (!message) return;
    
    // Prevent sending if currently rate limited
    if (isRateLimited) {
        addMessage("⏳ Please wait a moment. I'm still recovering from too many requests. Try again in a few seconds. 😊", false);
        chatInput.value = '';
        return;
    }
    
    // Add user message to UI
    addMessage(message, true);
    chatInput.value = '';
    
    // Show typing indicator
    if (typing) typing.classList.add('active');
    if (status) status.textContent = '🧠 Thinking...';
    
    try {
        const reminderCheck = detectReminder(message);
        
        // Offline reminder handling
        if (reminderCheck.isReminder && !navigator.onLine) {
            saveReminder(currentUserId, reminderCheck.text, reminderCheck.time);
            if (typing) typing.classList.remove('active');
            addMessage(`🔔 Got it! I'll remind you to "${reminderCheck.text}"${reminderCheck.time ? ` at ${reminderCheck.time}` : ''}. I'll save this for when we're back online! 💪`, false);
            if (status) status.textContent = '📝 Reminder saved offline';
            return;
        }
        
        // Get response from Gemini or fallback
        const response = await callGemini(message, currentUserId);
        
        if (typing) typing.classList.remove('active');
        addMessage(response, false);
        if (status) status.textContent = GEMINI_API_KEY ? '✅ Gemini AI • Online' : '📡 Offline Mode';
        
    } catch (error) {
        console.error('Send message error:', error);
        if (typing) typing.classList.remove('active');
        const fallback = getFallbackResponse(message);
        addMessage(fallback, false);
        if (status) status.textContent = '⚠️ Error - Using offline mode';
    }
    
    // Auto-resize input
    chatInput.style.height = 'auto';
    if (chatInput) chatInput.focus();
}

// ===========================================
// EVENT LISTENERS
// ===========================================
if (sendBtn) {
    sendBtn.addEventListener('click', sendMessage);
    console.log('✅ Send button listener attached');
}

if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    chatInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });
}

// ===========================================
// REACT NATIVE MESSAGE HANDLER
// ===========================================
console.log('🔊 Registering sendMessage listener...');

window.addEventListener('sendMessage', (event) => {
    console.log('📱 sendMessage event FIRED!', event.detail);
    const message = event.detail;
    if (message) {
        handleIncomingMessage(message);
    }
});

window.receiveMessageFromApp = function(message) {
    console.log('📱 receiveMessageFromApp called with:', message);
    handleIncomingMessage(message);
};

function handleIncomingMessage(message) {
    console.log('📱 Processing incoming message:', message);
    
    // Check rate limit before processing
    if (isRateLimited) {
        console.log('⚠️ Rate limited, delaying incoming message');
        setTimeout(() => handleIncomingMessage(message), RATE_LIMIT_WAIT_TIME);
        return;
    }
    
    setTimeout(() => {
        if (chatInput && sendBtn) {
            chatInput.value = message;
            chatInput.dispatchEvent(new Event('input', { bubbles: true }));
            sendBtn.click();
            console.log('✅ Message sent to chatbot:', message);
        } else {
            console.log('❌ Could not find input or button');
        }
    }, 300);
}

// ===========================================
// INITIALIZE
// ===========================================
function init() {
    addInitialWelcome();
    
    if (status) {
        if (GEMINI_API_KEY && GEMINI_API_KEY !== 'YOUR_API_KEY_HERE') {
            status.innerHTML = '✅ Gemini AI Ready • Online';
            status.style.color = '#22c55e';
        } else {
            status.innerHTML = '⚠️ Need API Key • Offline Mode Available';
            status.style.color = '#f97316';
        }
    }
    
    console.log('🤖 IA Bot Ready! User ID:', currentUserId);
    console.log('📱 React Native bridge active - ready to communicate!');
}

init();
