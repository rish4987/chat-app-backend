import Chat from "../models/chatModel.js";
import User from "../models/userModel.js";
import asyncHandler from "../middlewares/asyncHandler.js";

/* CREATE OR ACCESS 1-1 CHAT */
export const createOrAccessChat = asyncHandler(async (req, res) => {
  const { userId, receiverId } = req.body;
  
  // Support both field names
  const targetUserId = userId || receiverId;

  if (!targetUserId) {
    res.status(400);
    throw new Error("UserId or ReceiverId is required");
  }

  // Validate userId format
  if (!targetUserId.match(/^[0-9a-fA-F]{24}$/)) {
    res.status(400);
    throw new Error("Invalid User ID format");
  }

  const currentUserId = req.user._id;

  // Cannot create chat with yourself
  if (targetUserId === currentUserId.toString()) {
    res.status(400);
    throw new Error("Cannot create chat with yourself");
  }

  // Check if target user exists
  const userExists = await User.findById(targetUserId);
  if (!userExists) {
    res.status(404);
    throw new Error("User not found");
  }

  // Check if 1-1 chat already exists (using efficient $and query)
  let chat = await Chat.findOne({
    isGroupChat: false,
    $and: [
      { users: { $elemMatch: { $eq: currentUserId } } },
      { users: { $elemMatch: { $eq: targetUserId } } },
    ],
  })
    .populate("users", "-password") 
    .populate("latestMessage");

  // Populate sender of latest message
  chat = await User.populate(chat, {
    path: "latestMessage.sender",
    select: "name profileImg email",
  });

  // If chat exists, return it
  if (chat) {
    return res.status(200).json(chat);
  }

  // Create new 1-1 chat
  const chatData = {
    chatName: "sender", 
    isGroupChat: false,
    users: [currentUserId, targetUserId],
  };

  const newChat = await Chat.create(chatData);

  const fullChat = await Chat.findById(newChat._id)
    .populate("users", "-password")
    .populate("latestMessage");

  res.status(200).json(fullChat);
});

/* FETCH USER CHATS (SIDEBAR) */
export const fetchUserChats = asyncHandler(async (req, res) => {
  // Find all chats where user is a member, sorted by most recent update
  const chats = await Chat.find({
    users: { $in: [req.user._id] },
  })
    .populate("users", "name profileImg email")
    .populate({
      path: "latestMessage",
      populate: {
        path: "sender",
        select: "name profileImg email",
      },
    })
    .sort({ updatedAt: -1 }); // Most recent first

  res.status(200).json(chats);
});
