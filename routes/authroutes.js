import express from "express";
import { userSignup, userLogin, logoutUser } from "../controllers/authControllers.js";
import protect from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/signup", userSignup);
router.post("/login", userLogin);
router.post("/logout", logoutUser);

router.get("/me", protect, (req, res) => {
  res.json(req.user);
});

export default router;
