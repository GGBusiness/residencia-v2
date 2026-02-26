'use client';

import { useState, useRef } from 'react';
import { Camera, Upload, X, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/hooks/useUser';

export function AvatarUpload() {
    const { user, refreshUser } = useUser();
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            if (!event.target.files || event.target.files.length === 0 || !user) {
                return;
            }

            const file = event.target.files[0];
            const fileExt = file.name.split('.').pop();
            const filePath = `${user.id}-${Math.random()}.${fileExt}`;

            setUploading(true);

            // 1. Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file);

            if (uploadError) {
                throw uploadError;
            }

            // 2. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            // 3. Update User in DB via Server Action
            const { updateUserDataAction } = await import('@/app/actions/user-actions');
            await updateUserDataAction(user.id, { avatar_url: publicUrl });

            // 4. Refresh local user hook
            await refreshUser();

        } catch (error) {
            console.error('Error uploading avatar:', error);
            alert('Erro ao fazer upload da imagem.');
        } finally {
            setUploading(false);
        }
    };

    if (!user) return null;

    return (
        <div className="flex flex-col items-center sm:items-start gap-4">
            <div className="relative group">
                {/* Current Avatar or Initials */}
                <div className="w-24 h-24 rounded-full bg-indigo-100 flex items-center justify-center text-3xl font-bold text-indigo-700 overflow-hidden border-4 border-white shadow-md">
                    {user.avatar_url ? (
                        <img
                            src={user.avatar_url}
                            alt="Profile"
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        user.name ? user.name.substring(0, 2).toUpperCase() : 'DR'
                    )}
                </div>

                {/* Hover Overlay */}
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white cursor-pointer"
                >
                    {uploading ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                        <>
                            <Camera className="w-6 h-6 mb-1" />
                            <span className="text-[10px] font-medium tracking-wider uppercase">Trocar</span>
                        </>
                    )}
                </button>
            </div>

            <input
                type="file"
                ref={fileInputRef}
                onChange={handleUpload}
                accept="image/png, image/jpeg, image/jpg, image/webp"
                className="hidden"
            />
        </div>
    );
}
