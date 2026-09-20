import { sendWelcomeEmail } from "../emails/emailHandlers.js";
import { generateToken } from "../lib/utils.js";
import User from "../models/User.js";
import bcrypt from "bcryptjs";
import {ENV} from "../lib/env.js";
import cloudinary from "../lib/cloudinary.js";

export const signup = async (req, res) => {
    const { fullName, email, password } = req.body;

    try {
        if (!fullName || !email || !password) {
            return res.status(400).json({ message: "All fields are required" });
        }

        if (password.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters" });
        }
    // check email is valid: regex
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ message: "Invalid email format" });
        }

        const user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ message: "Email already exists" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({
            fullName,
            email,
            password: hashedPassword,
        });

        if (newUser) {
            // generateToken(newUser._id, res);
            // await newUser.save();

            const savedUser = await newUser.save();
            generateToken(savedUser._id, res);

            res.status(201).json({
                _id: newUser._id,
                fullName: newUser.fullName,
                email: newUser.email,
                profilePic: newUser.profilePic,
            });

            try {
                await sendWelcomeEmail(savedUser.email, savedUser.fullName, ENV.CLIENT_URL);
            } catch (error) {
                console.log("Failed to send welcome email:", error);
            }

        } else {
            res.status(400).json({ message: "Invalid user data" });
        }
    } catch (error) {
        console.log("Error in signup controller:", error);
        res.status(500).json({message: "Internal server error"});

    }
};

export const login = async (req, res) => {
    const { email, password } = req.body;

    if(!email || !password){
        return res.status(400).json({message: "Email and Password are required"});
    }

    try {
        const user = await User.findOne({email});
        if(!user) return res.status(400).json({message: "Invalid credentials"});

        const isPasswordCorrect = await bcrypt.compare(password, user.password);
        if(!isPasswordCorrect) return res.status(400).json({message: "Invalid credentials"});

        generateToken(user._id, res);

        res.status(200).json({
            _id: user._id,
            fullName: user.fullName,
            email: user.email,
            profilePic: user.profilePic,
        });

    } catch (error) {
        console.error("Error in login controller:", error);
        res.status(500).json({message: "Internal server error!"});
    }
};

export const logout = (_, res) => {
    res.cookie("jwt", "", {
        maxAge: 0,
        httpOnly: true,
        sameSite: "lax",
        secure: ENV.NODE_ENV === "production",
    });
    res.status(200).json({ message: "Logged out successfully" });
};

export const updateProfile = async (req, res) => {
    try {
        const { profilePic } = req.body;
        const userId = req.user._id;

        let updatedUser;

        if (profilePic === null || profilePic === "") {
            // Remove: delete from Cloudinary if one exists, reset to default
            if (req.user.profilePic) {
                const publicId = req.user.profilePic
                    .split("/").pop()       // get filename
                    .split(".")[0];         // strip extension
                await cloudinary.uploader.destroy(`chattify/profiles/${publicId}`);
            }

            updatedUser = await User.findByIdAndUpdate(
                userId,
                { profilePic: "" },
                { new: true }
            ).select("-password");

        } else if (profilePic) {
            // Upload new image
            const uploadResponse = await cloudinary.uploader.upload(profilePic, {
                folder: "chattify/profiles",
            });

            updatedUser = await User.findByIdAndUpdate(
                userId,
                { profilePic: uploadResponse.secure_url },
                { new: true }
            ).select("-password");

        } else {
            return res.status(400).json({ message: "profilePic field is required" });
        }

        res.status(200).json(updatedUser);
    } catch (error) {
        console.error("Error in update profile:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};