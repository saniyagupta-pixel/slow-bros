import { useState, useRef } from 'react';
import { LogOutIcon, VolumeOffIcon, Volume2Icon, XCircleIcon } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useChatStore } from '../store/useChatStore';

const mouseClickSound = new Audio('/sounds/mouse-click.mp3');

function ProfileHeader() {
  const { logout, authUser, updateProfile, removeProfilePic, isUpdatingProfileImage } = useAuthStore();
  const { isSoundEnabled, toggleSound } = useChatStore();
  const [selectedImg, setSelectedImg] = useState(null);

  if (!authUser) return null;

  const fileInputRef = useRef(null);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onloadend = async () => {
      const base64Image = reader.result;
      try {
        await updateProfile({ profilePic: base64Image });
        setSelectedImg(base64Image);
      } catch (error) {
        console.error("Image upload failed", error);
      }
    };
  };

  const handleRemovePic = async () => {
    try {
      await removeProfilePic();
      setSelectedImg(null);
    } catch (error) {
      console.error("Remove profile pic failed", error);
    }
  };

  const hasProfilePic = selectedImg || authUser.profilePic;

  return (
    <div className='p-6 border-b border-slate-700/50'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-3'>

          {/* Avatar */}
          <div className='relative'>
            <div className='avatar online'>
              <button
                className='size-14 rounded-full overflow-hidden relative group'
                onClick={() => fileInputRef.current.click()}
                disabled={isUpdatingProfileImage}
              >
                <img
                  src={selectedImg || authUser.profilePic || "/avatar.png"}
                  alt="User Image"
                  className='size-full object-cover'
                />
                <div className='absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity'>
                  <span className='text-xs text-white'>
                    {isUpdatingProfileImage ? "Saving..." : "Change"}
                  </span>
                </div>
              </button>
              <input
                type='file'
                accept='image/*'
                ref={fileInputRef}
                onChange={handleImageUpload}
                className='hidden'
              />
            </div>

            {/* Remove button — only shown when a custom pic is set */}
            {hasProfilePic && (
              <button
                onClick={handleRemovePic}
                disabled={isUpdatingProfileImage}
                className='absolute -top-1 -right-1 text-red-400 hover:text-red-300 transition-colors disabled:opacity-50 bg-slate-900 rounded-full'
                title="Remove profile picture"
              >
                <XCircleIcon className='size-4' />
              </button>
            )}
          </div>

          {/* User name & Online Text */}
          <div>
            <h3 className='text-slate-200 font-medium text-base max-w-[180px] truncate'>
              {authUser.fullName}
            </h3>
            <p className='text-xs text-slate-400'>Online</p>
          </div>
        </div>

        {/* Buttons */}
        <div className='flex items-center gap-4'>

          {/* Logout Btn */}
          <button
            className='text-slate-400 hover:text-slate-200 transition-colors'
            onClick={logout}
          >
            <LogOutIcon className='size-5' />
          </button>

          {/* Sound Toggle Btn */}
          <button
            className='text-slate-400 hover:text-slate-200 transition-colors'
            onClick={() => {
              mouseClickSound.currentTime = 0;
              mouseClickSound.play().catch((error) => console.log('Sound play error:', error));
              toggleSound();
            }}
          >
            {isSoundEnabled ? (
              <Volume2Icon className='size-5' />
            ) : (
              <VolumeOffIcon className='size-5' />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProfileHeader;