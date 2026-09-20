import { useEffect, useRef } from 'react';
import { useChatStore } from '../store/useChatStore';
import { useAuthStore } from '../store/useAuthStore';
import ChatHeader from "./ChatHeader"
import NoChatHistoryPlaceholder from './NoChatHistoryPlaceholder';
import MessagesLoadingSkeleton from './MessagesLoadingSkeleton';
import MessageInput from './MessageInput';

function ChatContainer() {
  const {selectedUser, getMessagesByUserId, messages, isMessageLoading, subscribeToMessages, unsubscribeFromMessages} = useChatStore();
  const {authUser} = useAuthStore();
  const messageEndRef = useRef(null);

  if (!authUser) return null;

  useEffect(() => {
    getMessagesByUserId(selectedUser._id);
    subscribeToMessages();

    //cleanup
    return () => unsubscribeFromMessages();
  }, [selectedUser,getMessagesByUserId, subscribeToMessages, unsubscribeFromMessages]);

  useEffect(() => {
    if(messageEndRef.current){
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  return (
    <>
      <ChatHeader />
      <div className='flex-1 px-6 overflow-y-auto py-8'>
        {messages.length > 0 && !isMessageLoading ? (
          <div className='max-w-3xl mx-auto space-y-6'>
            {messages.map(msg => (
              <div key={msg._id}
                className={`chat ${msg.senderId === authUser._id ? "chat-end" : "chat-start"}`}
              >
                <div className={`chat-bubble relative ${
                    msg.senderId === authUser._id
                      ? "bg-cyan-600 text-white"
                      : "bg-slate-800 text-slate-200"
                  }`}>
                    {msg.image && (
                    <img src={msg.image} alt="Shared" className="rounded-lg h-48 object-cover" />
                    )}
                    {msg.text && <p className="mt-2">{msg.text}</p>}
                    <p className="text-xs mt-1 opacity-75 flex items-center gap-1">
                    {new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    </p>

                </div>
              </div>
            ))}
            <div ref={messageEndRef} />
          </div>
        ) : isMessageLoading ? <MessagesLoadingSkeleton /> : (
          <NoChatHistoryPlaceholder name={selectedUser.fullName}/>
        )}
      </div>
      <MessageInput />
    </>
  )
}

export default ChatContainer