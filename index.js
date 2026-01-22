import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";

import connectDB from "./config/db.js";
import authRoutes from "./routes/authroutes.js";
import messageRoutes from "./routes/messageroute.js";
import userRoutes from "./routes/userRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import { notFound, errorHandler } from "./middlewares/errorMiddleware.js";
import socketHandler from "./socket/socket.js";

import { createServer } from "node:http";
import { Server } from "socket.io";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security & Middleware
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chats", chatRoutes);

app.get("/health", (req, res) => {
  res.status(200).json({ message: "Server is running 🚀" });
});

// Error Handling
app.use(notFound);
app.use(errorHandler);

const server = createServer(app);

const io = new Server(server, {
  pingTimeout: 60000,
  cors: {
    origin: "http://localhost:5173",
    credentials: true,
  },
});

socketHandler(io);

const startServer = async () => {
  try {
    await connectDB();
    server.listen(PORT, () => {
      console.log(`🚀 Server running in ${process.env.NODE_ENV} mode at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();
