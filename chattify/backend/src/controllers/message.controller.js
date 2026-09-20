// import Message from "../models/Message.js";
// import User from "../models/User.js";
// import cloudinary from "../lib/cloudinary.js";
// import { getReceiverSocketId, io } from "../lib/socket.js";


// export const getAllContacts = async (req, res) => {
//     try {
//         const loggedInUserId = req.user._id;
//         const filteredUsers = await User.find({_id: { $ne: loggedInUserId }}).select("-password");

//         res.status(200).json(filteredUsers);
//     } catch (error) {
//         console.log("Error in getAllContacts: ", error);
//         res.status(500).json({ message: "Internal Server Error" });
//     }
// };

// export const getMessagesByUserId = async (req, res) => {
//     try {
//         const myId = req.user._id;
//         const {id: userToChatId} = req.params;

//         const messages = await Message.find({
//             $or: [
//                 { senderId: myId, receiverId: userToChatId },
//                 { senderId: userToChatId, receiverId: myId },
//             ]
//         });

//         res.status(200).json(messages);
//     } catch (error) {
//         console.log("Error in getMessage controller: ", error);
//         res.status(500).json({ message: "Internal Server Error" });
//     }
// };

// export const sendMessage = async (req, res) => {
//     try {
//         const {text, image} = req.body;
//         const {id: receiverId} = req.params;
//         const senderId = req.user._id;

//         if(!text && !image){
//             return res.status(400).json({ message: "Text or Image is required" });
//         }
//         if (senderId.equals(receiverId)) {
//             return res.status(400).json({ message: "Cannot send message to yourself" });
//         }
//         const receiverExists = await User.exists({_id: receiverId});
//         if(!receiverExists){
//             return res.status(404).json({ message: "Receiver not found" });
//         }

//         let imageUrl;
//         if (image) {
//             const sizeInBytes = Buffer.byteLength(image, 'base64');
//             if (sizeInBytes > 5 * 1024 * 1024) {
//                 return res.status(413).json({ message: "Image exceeds 5MB limit" });
//             }
//             const uploadResponse = await cloudinary.uploader.upload(image, {
//                 folder: "chattify/messages",
//                 quality: "auto",
//                 fetch_format: "auto",
//             });
//             imageUrl = uploadResponse.secure_url;
//         }

//         const newMessage = new Message({
//             senderId,
//             receiverId,
//             text,
//             image: imageUrl,
//         });

//         await newMessage.save();

//         const receiverSocketId = getReceiverSocketId(receiverId);
//         if(receiverSocketId){
//             io.to(receiverSocketId).emit("newMessage", newMessage);
//         }

//         res.status(201).json(newMessage);
//     } catch (error) {
//         console.log("Error in sendMessage controller: ", error);
//         res.status(500).json({ message: "Internal Server Error" });
//     }

// };

// export const getChatPartners = async (req, res) => {
//     try {
//         const loggedInUserId = req.user._id;

//         const partnerIds = await Message.aggregate([
//             {
//                 $match: {
//                     $or: [
//                         { senderId: loggedInUserId },
//                         { receiverId: loggedInUserId },
//                     ],
//                 },
//             },
//             {
//                 $project: {
//                     partnerId: {
//                         $cond: [
//                             { $eq: ["$senderId", loggedInUserId] },
//                             "$receiverId",
//                             "$senderId",
//                         ],
//                     },
//                 },
//             },
//             { $group: { _id: "$partnerId" } },
//         ]);

//         const ids = partnerIds.map((p) => p._id);
//         const chatPartners = await User.find({ _id: { $in: ids } }).select("-password");
//         res.status(200).json(chatPartners);
//     } catch (error) {
//         console.error("Error in getChatPartners:", error.message);
//         res.status(500).json({ message: "Internal Server Error" });
//     }
// };

import Message from "../models/Message.js";
import User from "../models/User.js";
import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
import { processStoreOperatorMessage } from "../lib/storeOperator.js";

// Zero-Click Store Operator API endpoint
const STORE_OPERATOR_API_URL = process.env.STORE_OPERATOR_API_URL || "https://ais-dev-nzdyjysmexoho6dwswqoqc-600740134167.asia-southeast1.run.app/api/chat-app/chattify";

export const getAllContacts = async (req, res) => {
    try {
        const loggedInUserId = req.user._id;
        const filteredUsers = await User.find({_id: { $ne: loggedInUserId }}).select("-password");

        res.status(200).json(filteredUsers);
    } catch (error) {
        console.log("Error in getAllContacts: ", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const getMessagesByUserId = async (req, res) => {
    try {
        const myId = req.user._id;
        const {id: userToChatId} = req.params;

        const messages = await Message.find({
            $or: [
                { senderId: myId, receiverId: userToChatId },
                { senderId: userToChatId, receiverId: myId },
            ]
        });

        res.status(200).json(messages);
    } catch (error) {
        console.log("Error in getMessage controller: ", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const sendMessage = async (req, res) => {
    try {
        const {text, image} = req.body;
        const {id: receiverId} = req.params;
        const senderId = req.user._id;

        if(!text && !image){
            return res.status(400).json({ message: "Text or Image is required" });
        }
        if (senderId.equals(receiverId)) {
            return res.status(400).json({ message: "Cannot send message to yourself" });
        }

        // Fetch receiver details to verify existence and check if it's the Store Bot
        const receiver = await User.findById(receiverId);
        if(!receiver){
            return res.status(404).json({ message: "Receiver not found" });
        }

        let imageUrl;
        if (image) {
            const sizeInBytes = Buffer.byteLength(image, 'base64');
            if (sizeInBytes > 5 * 1024 * 1024) {
                return res.status(413).json({ message: "Image exceeds 5MB limit" });
            }
            const uploadResponse = await cloudinary.uploader.upload(image, {
                folder: "chattify/messages",
                quality: "auto",
                fetch_format: "auto",
            });
            imageUrl = uploadResponse.secure_url;
        }

        // 1. Create and save the customer's message as normal
        const newMessage = new Message({
            senderId,
            receiverId,
            text,
            image: imageUrl,
        });

        await newMessage.save();

        // Emit through socket so receiver sees it immediately
        const receiverSocketId = getReceiverSocketId(receiverId);
        if(receiverSocketId){
            io.to(receiverSocketId).emit("newMessage", newMessage);
        }

        // Return 201 immediately so the user's input box clears with 0ms lag
        res.status(201).json(newMessage);

        // 2. CHECK IF RECEIVER IS THE STORE OPERATOR BOT
        // Matches if STORE_BOT_USER_ID matches, or receiver email is store@kirana.local, or receiver.isBot is true
        // 2. CHECK IF RECEIVER IS THE STORE OPERATOR BOT
        const isStoreBot = 
            (process.env.STORE_BOT_USER_ID && receiverId.toString() === process.env.STORE_BOT_USER_ID.toString()) ||
            receiver.email === "store@kirana.local" ||
            receiver.isBot === true;

        if (isStoreBot && text) {
            // Run Store Operator directly inside your backend
            (async () => {
                try {
                    const operatorData = await processStoreOperatorMessage({
                        text,
                        senderId: senderId.toString(),
                        senderName: req.user.fullName || req.user.name || "Customer",
                        senderPhone: req.user.phone || "9876543210",
                    });

                    if (operatorData && operatorData.success && operatorData.reply) {
                        const botReplyMessage = new Message({
                            senderId: receiverId, // Store Bot
                            receiverId: senderId, // Customer
                            text: operatorData.reply,
                        });

                        await botReplyMessage.save();

                        // Emit live to customer via Socket.io
                        const senderSocketId = getReceiverSocketId(senderId);
                        if (senderSocketId) {
                            io.to(senderSocketId).emit("newMessage", botReplyMessage);
                        }
                    }
                } catch (botErr) {
                    console.error("[Store Operator Error]:", botErr);
                }
            })();
        }
    } catch (error) {
        console.log("Error in sendMessage controller: ", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const getChatPartners = async (req, res) => {
    try {
        const loggedInUserId = req.user._id;

        const partnerIds = await Message.aggregate([
            {
                $match: {
                    $or: [
                        { senderId: loggedInUserId },
                        { receiverId: loggedInUserId },
                    ],
                },
            },
            {
                $project: {
                    partnerId: {
                        $cond: [
                            { $eq: ["$senderId", loggedInUserId] },
                            "$receiverId",
                            "$senderId",
                        ],
                    },
                },
            },
            { $group: { _id: "$partnerId" } },
        ]);

        const ids = partnerIds.map((p) => p._id);
        const chatPartners = await User.find({ _id: { $in: ids } }).select("-password");
        res.status(200).json(chatPartners);
    } catch (error) {
        console.error("Error in getChatPartners:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
};