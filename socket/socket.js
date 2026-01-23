import Message from "../models/messageModel.js";
import Chat from "../models/chatModel.js";

let io;

// userId -> Set(socketIds) - Multi-device support
const onlineUsers = new Map();
// socketId -> userId
const socketUserMap = new Map();

// PRODUCTION NOTE: In a clustered environment (Redis adapter), these Maps 
// would need to be replaced by a centralized store (Redis).

const socketHandler = (ioInstance) => {
  io = ioInstance;

  io.on("connection", (socket) => {

    /* USER SETUP  */
    socket.on("setup", async (userId) => {
      try {
        if (!userId) return;

        socketUserMap.set(socket.id, userId);

        if (!onlineUsers.has(userId)) {
          onlineUsers.set(userId, new Set());
        }
        onlineUsers.get(userId).add(socket.id);

        socket.join(userId);

        // Notify friends/everyone? 
        // In production: Only emit to users who have active chats with this user.
        io.emit("online users", Array.from(onlineUsers.keys()));
        
        socket.emit("connected");
      } catch (error) {
        // console.error("Setup error:", error);
      }
    });

    /* JOIN CHAT */
    socket.on("join chat", (chatId) => {
      socket.join(chatId);
    });

    /* LEAVE CHAT */
    socket.on("leave chat", (chatId) => {
      socket.leave(chatId);
    });

    /* TYPING */
    socket.on("typing", (chatId) => {
      socket.to(chatId).emit("typing", chatId);
    });

    socket.on("stop typing", (chatId) => {
      socket.to(chatId).emit("stop typing", chatId);
    });

    /* MESSAGE DELIVERED / SEE*/
    // Moved complex logic to API controllers or Worker queues for scalability.
    // Sockets should be lightweight signal carriers.
    
    // Simple signal relay if needed
    socket.on("mark seen", ({ chatId, messageIds }) => {
       // Logic to update DB should ideally happen via API POST /messages/seen
       // Then API emits event. 
       // Keeping socket lightweight.
    });

    /* DISCONNECT */
    socket.on("disconnect", () => {
      const userId = socketUserMap.get(socket.id);

      if (userId) {
        const userSockets = onlineUsers.get(userId);
        if (userSockets) {
          userSockets.delete(socket.id);
          if (userSockets.size === 0) {
            onlineUsers.delete(userId);
          }
        }
      }

      socketUserMap.delete(socket.id);
      
      // Throttle/Debounce this in real app
      io.emit("online users", Array.from(onlineUsers.keys()));
    });
  });
};

/* HELPER FUNCTIONS  */

export const isUserOnline = (userId) => {
  return onlineUsers.has(userId) && onlineUsers.get(userId).size > 0;
};

export const getIO = () => {
  if (!io) {
    throw new Error("❌ Socket.io not initialized");
  }
  return io;
};

export default socketHandler;
