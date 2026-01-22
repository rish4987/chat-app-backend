import Message from "../models/messageModel.js";
import Chat from "../models/chatModel.js";
import { getIO, isUserOnline } from "../socket/socket.js";
import asyncHandler from "../middlewares/asyncHandler.js";

/* ================= SEND MESSAGE ================= */
export const sendMessage = asyncHandler(async (req, res) => {
  const { content, chatId } = req.body;

  if (!content || !chatId) {
    res.status(400);
    throw new Error("Content and chatId are required");
  }

  // Validate content
  if (typeof content !== "string" || content.trim().length === 0) {
    res.status(400);
    throw new Error("Message content cannot be empty");
  }

  // 🔐 Security: check user is part of chat
  const chat = await Chat.findById(chatId).populate("users", "_id");
  if (!chat) {
    res.status(404);
    throw new Error("Chat not found");
  }

  // Check if user is a member of the chat (proper ObjectId comparison)
  const isMember = chat.users.some(
    (user) => user._id.toString() === req.user._id.toString()
  );
  if (!isMember) {
    res.status(403);
    throw new Error("Not authorized for this chat");
  }

  // Create message with status "sent"
  let newMessage = await Message.create({
    sender: req.user._id,
    content: content.trim(),
    chat: chatId,
    status: "sent",
  });

  // Populate message data
  newMessage = await newMessage.populate(
    "sender",
    "name profileImg email"
  );
  newMessage = await newMessage.populate("chat");
  newMessage = await Chat.populate(newMessage, {
    path: "chat.users",
    select: "name profileImg email",
  });

  // Update chat's latest message
  await Chat.findByIdAndUpdate(chatId, {
    latestMessage: newMessage._id,
  });

  const io = getIO();

  // 🔥 Socket Logic:
  // 1. Emit to the specific chat room (for users currently looking at this chat)
  io.to(chatId).emit("message received", newMessage);

  // 2. Emit notification to specific users (if they are online but maybe not in the chat room)
  const recipientUsers = chat.users.filter(
    (user) => user._id.toString() !== req.user._id.toString()
  );

  for (const user of recipientUsers) {
    const userId = user._id.toString();
    
    // Only emit notification, client handles logic
    io.to(userId).emit("notification received", newMessage);
    
    // Mark as delivered if recipient is online
    if (isUserOnline(userId)) {
      // NOTE: We could update DB here, but doing it in a loop might be slow.
      // Ideally, the client implicitly ack's it or we do a bulk update.
      // For now, we update individual messages as 'delivered' to keep it synced.
      await Message.findByIdAndUpdate(newMessage._id, { status: "delivered" }); 
      // Re-fetch or update object in memory to return correct status
      newMessage.status = "delivered";
    }
  }

  // Emit 'delivered' update to sender if updated
  if (newMessage.status === "delivered") {
    io.to(req.user._id.toString()).emit("message updated", newMessage);
  }

  res.status(201).json(newMessage);
});

/* ================= FETCH MESSAGES ================= */
export const fetchMessages = asyncHandler(async (req, res) => {
  const { chatId } = req.params;

  // Validate chatId format
  if (!chatId.match(/^[0-9a-fA-F]{24}$/)) {
    res.status(400);
    throw new Error("Invalid chatId format");
  }

  // 🔐 Security: check chat access
  const chat = await Chat.findById(chatId).populate("users", "_id");
  if (!chat) {
    res.status(404);
    throw new Error("Chat not found");
  }

  // Check if user is a member of the chat (proper ObjectId comparison)
  const isMember = chat.users.some(
    (user) => user._id.toString() === req.user._id.toString()
  );
  if (!isMember) {
    res.status(403);
    throw new Error("Not authorized for this chat");
  }

  // Fetch messages with pagination support (optional)
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const skip = (page - 1) * limit;

  const messages = await Message.find({ chat: chatId })
    .populate("sender", "name profileImg email")
    .populate("chat")
    .sort({ createdAt: -1 }) // Most recent first
    .limit(limit)
    .skip(skip);

  // Reverse to show oldest first in response (for frontend)
  messages.reverse();

  res.status(200).json(messages);
});
