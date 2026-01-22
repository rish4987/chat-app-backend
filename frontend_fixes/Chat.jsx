import React, { useEffect, useState, useRef, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import io from "socket.io-client";
import { toast } from "react-hot-toast"; // Assuming toast library
import axios from "axios";
import {
  setChats,
  setActiveChat,
  addMessage,
  setMessages,
} from "../redux/chatSlice"; // Adjust path as needed

// ENDPOINT from env or hardcoded for dev (Adjust as needed)
const ENDPOINT = "http://localhost:3000";

let socket;

const Chat = () => {
  const dispatch = useDispatch();
  
  // SELECTORS - robust access
  const { user } = useSelector((state) => state.auth || {});
  const { activeChat, messages } = useSelector((state) => state.chat || {});

  // STATE
  const [loading, setLoading] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [typing, setTyping] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  // REFS
  const messagesEndRef = useRef(null);

  // ================= SCROLL TO BOTTOM =================
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // ================= SOCKET SETUP =================
  useEffect(() => {
    if (!user) return;

    // Initialize Socket
    socket = io(ENDPOINT, {
      transports: ["websocket"], // improved performance
      credentials: true,
    });

    socket.emit("setup", user._id);
    socket.on("connected", () => setSocketConnected(true));
    socket.on("typing", () => setIsTyping(true));
    socket.on("stop typing", () => setIsTyping(false));

    // CLEANUP
    return () => {
      socket.disconnect();
      socket.off("setup");
      socket.off("typing");
      socket.off("stop typing");
    };
  }, [user]);

  // ================= MESSAGE LISTENER =================
  useEffect(() => {
    if (!socket) return;

    // Use a named function for safer cleanup
    const handleMessageReceived = (newMessageReceived) => {
      // Safety Check: Only add if belongs to active chat
      if (
        activeChat &&
        activeChat._id === newMessageReceived.chat._id
      ) {
        dispatch(addMessage(newMessageReceived));
      } else {
        // Option: Show notification (handled globally usually)
      }
    };

    socket.on("message received", handleMessageReceived);

    return () => {
      socket.off("message received", handleMessageReceived);
    };
  }, [activeChat, dispatch]);

  // ================= FETCH MESSAGES =================
  useEffect(() => {
    if (!activeChat) return;

    const fetchMessages = async () => {
      try {
        setLoading(true);
        const config = {
          headers: {
            Authorization: `Bearer ${user.token}`, // Or cookie
          },
        };

        const { data } = await axios.get(
          `/api/messages/${activeChat._id}`,
          config
        );

        dispatch(setMessages(data));
        socket.emit("join chat", activeChat._id);
        setLoading(false);
      } catch (error) {
        toast.error("Failed to load messages");
        setLoading(false);
      }
    };

    fetchMessages();
  }, [activeChat, dispatch, user]);

  // ================= HANDLERS =================
  const sendMessage = async (event) => {
    if (event.key === "Enter" && newMessage) {
      socket.emit("stop typing", activeChat._id);
      try {
        const config = {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.token}`,
          },
        };
        
        setNewMessage(""); // Optimistic clear

        const { data } = await axios.post(
          "/api/messages",
          {
            content: newMessage,
            chatId: activeChat._id,
          },
          config
        );

        // Socket emit handled by backend now? 
        // If backend emits 'message received' to room, we catch it in the listener above.
        // OR we manually add it here to be faster. 
        // Best practice: Wait for socket or api response.
        
        dispatch(addMessage(data));
      } catch (error) {
        toast.error("Failed to send message");
      }
    }
  };

  const typingHandler = (e) => {
    setNewMessage(e.target.value);

    // Typing Indicator Logic
    if (!socketConnected) return;

    if (!typing) {
      setTyping(true);
      socket.emit("typing", activeChat._id);
    }

    let lastTypingTime = new Date().getTime();
    let timerLength = 3000;
    setTimeout(() => {
      let timeNow = new Date().getTime();
      let timeDiff = timeNow - lastTypingTime;
      if (timeDiff >= timerLength && typing) {
        socket.emit("stop typing", activeChat._id);
        setTyping(false);
      }
    }, timerLength);
  };

  // ================= RENDER =================
  
  // Guard Clauses
  if (!user) return <div>Please Login</div>;
  if (!activeChat) {
    return (
      <div className="flex items-center justify-center h-full">
        <h1 className="text-3xl font-bold text-gray-400">Select a chat to start messaging</h1>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-4 pb-2 border-b">
        <h2 className="text-xl font-bold">
           {/* Safe Render */}
           {activeChat.isGroupChat 
              ? activeChat.chatName 
              : activeChat.users?.find(u => u._id !== user._id)?.name || "Chat"}
        </h2>
      </div>

      {/* Messages Box */}
      <div className="flex-1 overflow-y-auto bg-gray-100 p-3 rounded-lg flex flex-col gap-2">
        {loading ? (
             <div className="self-center mt-10">Loading...</div>
        ) : (
          /* 
             FIXED: Ensure map callback has (m, i) or just (m) and uses m._id for key. 
             NEVER assume 'index' variable exists outside this scope.
          */
          messages?.map((m, i) => (
             <div 
               key={m._id || i} // Fallback to i only if _id missing (Safe)
               className={`flex ${m.sender._id === user._id ? "justify-end" : "justify-start"}`}
             >
                <span className={`px-4 py-2 rounded-lg max-w-xs ${
                   m.sender._id === user._id 
                     ? "bg-blue-500 text-white" 
                     : "bg-gray-300 text-black"
                }`}>
                   {m.content}
                </span>
             </div>
          ))
        )}
        
        {isTyping && <div className="text-gray-500 text-sm italic">Typing...</div>}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="mt-3">
        <input
          className="w-full bg-gray-200 p-2 rounded-lg border outline-none focus:border-blue-500"
          placeholder="Enter a message..."
          onChange={typingHandler}
          value={newMessage}
          onKeyDown={sendMessage}
        />
      </div>
    </div>
  );
};

export default Chat;
