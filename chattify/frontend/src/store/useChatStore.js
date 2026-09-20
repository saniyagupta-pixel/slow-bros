import { create } from 'zustand';
import { axiosInstance } from '../lib/axios';
import toast from 'react-hot-toast';
import { useAuthStore } from './useAuthStore';



export const useChatStore = create((set, get) => ({
    allContacts: [],
    chats: [],
    messages: [],
    activeTab: "chats",
    selectedUser: null,
    isUsersLoading: false,
    isMessageLoading: false,
    // Read stored value if present, default to true otherwise
    isSoundEnabled: localStorage.getItem("isSoundEnabled") ? JSON.parse(localStorage.getItem("isSoundEnabled")) : true,

    toggleSound: () => {
        const newVal = !get().isSoundEnabled;
        localStorage.setItem("isSoundEnabled", JSON.stringify(newVal));
        set({isSoundEnabled: newVal});
    },

    setActiveTab: (tab) => set({activeTab: tab}),
    setSelectedUser: (selectedUser) => set({selectedUser}),

    getAllContacts: async() => {
        set({isUsersLoading: true});
        try {
            const res = await axiosInstance.get('/messages/contacts');
            set({allContacts: res.data});

        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to load contacts");

        } finally {
            set({isUsersLoading: false});
        }
    },
    getMyChatPartners: async() => {
        set({isUsersLoading: true});
        try {
            const res = await axiosInstance.get('/messages/chats');
            set({chats: res.data});
        } catch (error) {
            toast.error(error?.response?.data?.message);
        } finally {
            set({isUsersLoading: false});
        }
    },

    getMessagesByUserId: async (userId) => {
        set({ isMessageLoading: true });
        try {
            const res = await axiosInstance.get(`/messages/${userId}`);
            set({ messages: res.data });
        } catch (error) {
            toast.error(error.response?.data?.message || "Something went wrong");
        } finally {
            set({ isMessageLoading: false });
        }
    },

    sendMessage: async(messageData) => {
        const { selectedUser, messages } = get();
        const {authUser} = useAuthStore.getState();
        const tempId = `temp-${Date.now()}`;
        const optimisticMessage = {    // learn this piece of code...
            _id: tempId,
            senderId: authUser._id,
            receiverId: selectedUser._id,
            text: messageData.text,
            image: messageData.image,
            createdAt: new Date().toISOString(),
            isOptimistic: true,

        };
        set({messages: [...messages,optimisticMessage]});
        try {
            const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, messageData);
            set({messages: messages.concat(res.data)});
        } catch (error) {
            set({messages: messages});
            toast.error(error.response?.data?.message || "Something went wrong");
        }
    },

    subscribeToMessages: () => {
        const {  selectedUser, isSoundEnabled } = get();
        if(!selectedUser) return;

        const socket = useAuthStore.getState().socket;

        socket.on("newMessage", (newMessage) => {
            const { selectedUser } = get();
            const isRelevant = newMessage.senderId === selectedUser?._id || newMessage.receiverId === selectedUser?._id;
            if (!isRelevant) return;
            
            set({ messages: [...get().messages, newMessage] });

            if(isSoundEnabled) {
                const notificationSound = new Audio("/sounds/notification.mp3");
                notificationSound.currentTime = 0;
                notificationSound.play().catch((e) => console.log("Audio play failed:", e));
            }
        });
    },

    unsubscribeFromMessages: () => {
        const socket = useAuthStore.getState().socket;
        socket.off("newMessage");
    },
}));