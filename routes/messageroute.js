import express from "express";
import {
  sendMessage,
  fetchMessages,
} from "../controllers/messageController.js";
import protect from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/", protect, sendMessage);
router.get("/:chatId", protect, fetchMessages);

export default router;
