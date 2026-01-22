import User from "../models/userModel.js";
import bcrypt from "bcryptjs";
import generateToken from "../utils/generateToken.js";
import asyncHandler from "../middlewares/asyncHandler.js";

const validateEmail = (email) => {
  return String(email)
    .toLowerCase()
    .match(
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    );
};

export const userSignup = asyncHandler(async (req, res) => {
  const { profileImg = "", name, email, password } = req.body;

  if (!name || !email || !password) {
    res.status(400);
    throw new Error("All fields are required");
  }

  if (!validateEmail(email)) {
    res.status(400);
    throw new Error("Invalid email format");
  }

  if (password.length < 6) {
    res.status(400);
    throw new Error("Password must be at least 6 characters");
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    res.status(409);
    throw new Error("User already exists");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = await User.create({
    profileImg,
    name,
    email,
    password: hashedPassword,
  });

  if (newUser) {
    const token = generateToken(newUser._id);
    setCookie(res, token);

    res.status(201).json({
      user: {
        id: newUser._id,
        profileImg: newUser.profileImg,
        name: newUser.name,
        email: newUser.email,
      },
      token, // Optional: send token in body too
    });
  } else {
    res.status(400);
    throw new Error("Invalid user data");
  }
});

export const userLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error("All fields are required");
  }

  const user = await User.findOne({ email });
  if (!user) {
    res.status(401);
    throw new Error("Invalid email or password");
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    res.status(401);
    throw new Error("Invalid email or password");
  }

  const token = generateToken(user._id);
  setCookie(res, token);

  res.status(200).json({
    user: {
      id: user._id,
      profileImg: user.profileImg,
      name: user.name,
      email: user.email,
    },
    token,
  });
});

export const logoutUser = asyncHandler(async (req, res) => {
  res.cookie("token", "", {
    httpOnly: true,
    expires: new Date(0),
  });

  res.status(200).json({ message: "Logged out successfully" });
});

// Helper for consistency
const setCookie = (res, token) => {
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};