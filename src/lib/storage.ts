import { supabase } from './supabase';

export async function uploadBusinessAvatar(
  userId: string,
  imageUri: string
): Promise<string | null> {
  const ext = imageUri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const filePath = `${userId}/avatar.${ext}`;

  const response = await fetch(imageUri);
  const blob = await response.blob();

  const { error } = await supabase.storage
    .from('business-avatars')
    .upload(filePath, blob, {
      upsert: true,
      contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
    });

  if (error) return null;

  const { data } = supabase.storage
    .from('business-avatars')
    .getPublicUrl(filePath);

  return data.publicUrl;
}
