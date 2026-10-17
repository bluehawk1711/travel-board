import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';

import { api, ApiError } from '@/lib/api';
import { UI_MESSAGES } from '@travel-board/shared';

/**
 * Avatar pick → upload → `PATCH /users/me`, shared by Settings and Profile
 * so the flow (and its error handling) lives in exactly one place.
 */
export function useAvatarUpload(onUploaded?: () => Promise<void> | void) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (asset: { uri: string; name: string; type: string }) => {
      const { url } = await api.uploadImage(asset);
      await api.updateMyProfile({ avatarUrl: url });
    },
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      if (onUploaded) await onUploaded();
    },
    onError: (err: Error) => {
      setError(
        err instanceof ApiError
          ? err.message
          : UI_MESSAGES.SETTINGS.AVATAR_UPLOAD_FAILED,
      );
    },
  });

  const pickAvatar = async () => {
    setError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      mutation.mutate({
        uri: asset.uri,
        name: asset.fileName ?? 'avatar.jpg',
        type: asset.mimeType ?? 'image/jpeg',
      });
    } catch {
      setError(UI_MESSAGES.SETTINGS.AVATAR_UPLOAD_FAILED);
    }
  };

  return { pickAvatar, uploading: mutation.isPending, error };
}
