import express from "express";
import {
  createOrAccessChat,
  fetchUserChats,
} from "../controllers/chatController.js";
import protect from "../middlewares/authMiddleware.js";

const router = express.Router();

// POST /api/chats - Create or access 1-1 chat
router.post("/", protect, createOrAccessChat);

// GET /api/chats - Fetch logged-in user's chats (sidebar)
router.get("/", protect, fetchUserChats);

export default router;
