const { io } = require("socket.io-client");

const socket = io("https://msg-3vgj.onrender.com", {
  autoConnect: true,
  transports: ["websocket"]
});

socket.on("connect", () => {
  console.log("Connected with socket ID:", socket.id);
  
  // Create a fake chatId (must be 24 char hex for ObjectId)
  const fakeChatId = "605c72ef2f8a4c14c45b854a";
  
  socket.emit("join-chat", fakeChatId);
  console.log("Joined chat", fakeChatId);

  // Listen for receive-message
  socket.on("receive-message", (msg) => {
    console.log("RECEIVED MESSAGE:", msg);
    process.exit(0);
  });

  // Emit a send-message
  const payload = {
    chatId: fakeChatId,
    tempId: "temp-12345",
    senderId: "testUser",
    text: "hello world encrypted",
    mediaUrl: null,
    mediaType: null,
    replyTo: null
  };
  
  console.log("EMITTING:", payload);
  socket.emit("send-message", payload);
  
  // Timeout in case it fails silently
  setTimeout(() => {
    console.log("TIMEOUT! No response received. The save probably failed silently on the server.");
    process.exit(1);
  }, 5000);
});

socket.on("connect_error", (err) => {
  console.error("Connection Error:", err);
  process.exit(1);
});
