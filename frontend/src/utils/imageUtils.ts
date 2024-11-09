const imagePreviewUrl = import.meta.env.VITE_API_URL + '/image/preview/';
const imageRasterUrl = import.meta.env.VITE_API_URL + '/image/raster/';

export const getPreviewImage = (imageId: string) => {
  return imagePreviewUrl + imageId;
};

export const getRasterImage = (imageId: string) => {
  return imageRasterUrl + imageId;
};
