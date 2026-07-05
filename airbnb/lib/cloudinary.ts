const CLOUDINARY_CLOUD_NAME = 'djosldcjf';
const CLOUDINARY_UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

export type CloudinaryUploadResult = {
  public_id: string;
  secure_url: string;
};

export const uploadImageToCloudinary = async (
  uri: string,
  folder = 'airbnb-mobile/listings'
): Promise<CloudinaryUploadResult> => {
  if (!CLOUDINARY_UPLOAD_PRESET) {
    throw new Error('EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET is not configured');
  }

  const formData = new FormData();
  const filename = uri.split('/').pop() ?? `listing-${Date.now()}.jpg`;
  const extension = filename.split('.').pop()?.toLowerCase();
  const type = extension === 'png' ? 'image/png' : 'image/jpeg';

  formData.append('file', {
    uri,
    name: filename,
    type,
  } as any);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  formData.append('folder', folder);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? 'Cloudinary upload failed');
  }

  return {
    public_id: payload.public_id,
    secure_url: payload.secure_url,
  };
};
