import express from "express";
import protect from "../middlewares/authMiddleware.js";
import {
  getMyProfile,
  updateMyProfile,
  searchUsers,
} from "../controllers/userController.js";

const router = express.Router();

router.get("/", protect, searchUsers);
router.get("/me", protect, getMyProfile);
router.put("/me", protect, updateMyProfile);

export default router;
