const ws = new WebSocket("wss://chatapp-server-3ygw.onrender.com");
ws.binaryType = "text";

const chatBox = document.getElementById("chatBox");
const messageInput = document.getElementById("messageInput");
const usernameInput = document.getElementById("username");
const sendBtn = document.getElementById("sendBtn");
const userList = document.getElementById("userList");

let userColor = "";
let hasJoined = false; // ✅ track if user has joined
let typingTimer;
let userWasAtBottom = true;

chatBox.addEventListener("scroll", () => {
  const diff = chatBox.scrollHeight - chatBox.scrollTop - chatBox.clientHeight;
  userWasAtBottom = diff < 150; // ✅ reuse same threshold as messages
});


ws.onopen = () => console.log("✅ Connected to WebSocket server");
ws.onclose = () => console.log("🔴 Disconnected from WebSocket server");
ws.onerror = (err) => console.error("❌ WebSocket Error:", err);

// Random color generator for each user
function randomColor() {
  const colors = ["#4CAF50", "#2196F3", "#E91E63", "#FF9800", "#9C27B0", "#00BCD4"];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Join when user first sends a message
function ensureJoin() {
  if (!hasJoined) {
    const username = usernameInput.value.trim();
    if (username === "") {
      alert("Please enter your name before joining!");
      return false;
    }
    userColor = randomColor();
    ws.send(JSON.stringify({ type: "join", user: username }));
    hasJoined = true;
  }
  return true;
}

function scrollToBottom(force = false) {
  if (!chatBox) return;

  // Run AFTER the DOM updates (so scrollHeight is accurate)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const scrollDiff = chatBox.scrollHeight - chatBox.scrollTop - chatBox.clientHeight;
      const nearBottom = scrollDiff < 150; // ✅ larger threshold

      if (force || nearBottom || scrollDiff <= 1) {
        // scrollDiff <= 1 handles exact bottom edge cases
        chatBox.scrollTo({
          top: chatBox.scrollHeight,
          behavior: force ? "auto" : "smooth",
        });
      }
    });
  });
}


const newMessageIndicator = document.getElementById("newMessageIndicator");
let unseenMessages = 0;

// Helper: Show indicator
function showNewMessageIndicator() {
  if (!newMessageIndicator) return;
  unseenMessages++;
  newMessageIndicator.textContent = `⬇️ ${unseenMessages} new message${unseenMessages > 1 ? 's' : ''}`;
  newMessageIndicator.classList.add("show");
}

// Helper: Hide indicator
function hideNewMessageIndicator() {
  if (!newMessageIndicator) return;
  unseenMessages = 0;
  newMessageIndicator.classList.remove("show");
}

// Clicking the indicator scrolls down
newMessageIndicator?.addEventListener("click", () => {
  scrollToBottom(true);
  hideNewMessageIndicator();
});

// Detect user scrolls (hide badge if near bottom)
chatBox.addEventListener("scroll", () => {
  const nearBottom =
    chatBox.scrollHeight - chatBox.scrollTop - chatBox.clientHeight < 80;
  if (nearBottom) hideNewMessageIndicator();
});


// Handle sending messages
function sendMessage() {
  if (!ensureJoin()) return;

  const msg = messageInput.value.trim();
  const user = usernameInput.value.trim() || "Anonymous";

  if (msg === "") return;

  const data = { type: "chat", user, msg, time: new Date().toLocaleTimeString() };
  ws.send(JSON.stringify(data));
  messageInput.value = "";
  messageInput.style.height = "auto";

  // stop typing immediately after sending
  ws.send(JSON.stringify({ type: "stopTyping", user }))

  scrollToBottom(true);
}

// Send “typing” event
function notifyTyping() {
  if (!ensureJoin()) return;
  const user = usernameInput.value.trim();
  ws.send(JSON.stringify({ type: "typing", user }));
}

// Event listeners
sendBtn.addEventListener("click", sendMessage);
messageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.shiftKey) {
    return;
  } 
  else if (e.key === "Enter") {
    e.preventDefault();
    sendMessage();
  } 
  else {
    notifyTyping();
  }
});

// Auto-resize the message input box as you type
messageInput.addEventListener("input", () => {
  messageInput.style.height = "auto";
  messageInput.style.height = messageInput.scrollHeight + "px";
});

// Auto-join as soon as user enters a name
usernameInput.addEventListener("change", ensureJoin);

ws.onmessage = async (event) => {
  const text = event.data instanceof Blob ? await event.data.text() : event.data;
  const data = JSON.parse(text);

  // 🔔 System message
  if (data.type === "system") {
    const sysDiv = document.createElement("div");
    sysDiv.classList.add("system-message");
    sysDiv.innerHTML = `<em>🔔 ${data.msg}</em>`;
    chatBox.appendChild(sysDiv);
    scrollToBottom(true); // scroll instantly for system updates
  }

  // 💬 Chat message
  else if (data.type === "chat") {
    const wrapper = document.createElement("div");
    wrapper.classList.add("bubble-wrapper");
    wrapper.classList.add(data.user === usernameInput.value ? "self" : "other");

    const nameTag = document.createElement("div");
    nameTag.classList.add("bubble-username");
    nameTag.textContent = data.user;

    const bubble = document.createElement("div");
    bubble.classList.add("chat-bubble");
    bubble.innerHTML = `${data.msg}<sub class="chat-time">${data.time}</sub>`;

    wrapper.appendChild(nameTag);
    wrapper.appendChild(bubble);
    chatBox.appendChild(wrapper);

    // 🧭 Smart scroll behavior
    const isSelf = data.user === usernameInput.value;
    const nearBottom =
      chatBox.scrollHeight - chatBox.scrollTop - chatBox.clientHeight < 80;

    if (isSelf) {
      // My own message → instant scroll
      scrollToBottom(true);
    } 
    else {
      // Always re-evaluate scrollDiff after layout
      requestAnimationFrame(() => {
        const scrollDiff = chatBox.scrollHeight - chatBox.scrollTop - chatBox.clientHeight;

        if (scrollDiff > 150) {
          // user scrolled up noticeably
          showNewMessageIndicator();
        } else {
          scrollToBottom(); // already near bottom
        }
      });
    }

  }

  // ✍️ Typing
  else if (data.type === "typing") {
    if (data.user !== usernameInput.value) showTypingIndicator(data.user);
  }

  // 🛑 Stop typing
  else if (data.type === "stopTyping") {
    removeTypingIndicator(data.user);
  }

  // 👥 Update user list
  else if (data.type === "userList") {
    updateUserList(data.users);
  }
};


function showTypingIndicator(user) {
  // If typing indicator already exists for this user, refresh it
  let typingDiv = document.getElementById("typingIndicator");
  if (!typingDiv) {
    typingDiv = document.createElement("div");
    typingDiv.id = "typingIndicator";
    typingDiv.classList.add("system-message");
    chatBox.appendChild(typingDiv);
  }

  typingDiv.innerHTML = `💬 <em>${user} is typing...</em>`;
  typingDiv.classList.remove("fade-out");

  // ✅ If the receiver was at the bottom → scroll to show typing indicator
  if (userWasAtBottom) {
    scrollToBottom(true);
  }

  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    typingDiv.classList.add("fade-out");
    setTimeout(() => typingDiv.remove(), 600);
  }, 1500);
}

function removeTypingIndicator(user) {
  const typingDiv = document.getElementById("typingIndicator");
  if (typingDiv && typingDiv.textContent.includes(user)) {
    typingDiv.classList.add("fade-out");
    setTimeout(() => typingDiv.remove(), 400);
  }
}

function updateUserList(users) {
  userList.innerHTML = "";
  users.forEach((u) => {
    const li = document.createElement("li");
    li.textContent = u;
    userList.appendChild(li);
  });
}
