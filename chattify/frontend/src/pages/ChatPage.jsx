import { useChatStore } from '../store/useChatStore';
import BorderAnimatedContainer from "../components/BorderAnimatedContainer";
import ProfileHeader from '../components/ProfileHeader';
import ActiveTabSwitch from '../components/ActiveTabSwitch';
import ChatList from '../components/ChatList';
import ContactsList from '../components/ContactsList';
import ChatContainer from '../components/ChatContainer';
import WelcomeMessage from '../components/WelcomeMessage';


function ChatPage() {
  const {activeTab, selectedUser} = useChatStore();
  return (
    <div className='relative w-full max-w-6xl h-[800px]'>

      <BorderAnimatedContainer>
        {/* Left Side */}
        <div className='w-80 bg-slate-800/50 backdrop-blur-sm flex flex-col'>
          <ProfileHeader />
          <ActiveTabSwitch />
          
          <div className='flex-1 overflow-y-auto p-4 space-y-2'>
            {activeTab === "chats" ? <ChatList /> : <ContactsList />}
          </div>
        </div>

        {/* Right Side */}
        <div className='flex-1 flex flex-col bg-slate-900/50 backdrop-blur-sm'>
          {selectedUser ? <ChatContainer/> : <WelcomeMessage />}
        </div>
      </BorderAnimatedContainer>
      
    </div>
  );
}

export default ChatPage