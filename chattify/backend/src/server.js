import express from "express";
import cookieParser from "cookie-parser";
import path from "path";
import cors from "cors";

import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import { connectDB } from "./lib/db.js";
import { ENV } from "./lib/env.js";
import { app, server } from "./lib/socket.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);  // now = .../backend/src/

const PORT = ENV.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors({origin: ENV.CLIENT_URL, credentials: true}));
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);

// make ready for deployment   Anything other than '/api/...' then deploy frontend   
if(ENV.NODE_ENV === "production"){
    app.use(express.static(path.join(__dirname, "../../frontend/dist")));

    app.get("*", (_,res) => {   // 'req' in place of '_'
        res.sendFile(path.join(__dirname, "../../frontend", "dist", "index.html"));
    });
}

server.listen(PORT, () => {
    console.log("Server running on Port: " + PORT);
    connectDB();
});
