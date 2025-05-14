// @author Michael Polívka (xpoliv07)
const imagePreviewUrl = import.meta.env.VITE_API_URL + '/image/preview/';
const imageRasterUrl = import.meta.env.VITE_API_URL + '/image/raster/';

export const getPreviewImage = (imageId: string) => {
  return `${imagePreviewUrl}${imageId}`;
};

export const getRasterImage = (imageId: string) => {
  return imageRasterUrl + imageId;
};

type ColorMap = {
  [key: string]: string;
};

const colorMap: ColorMap = {
  kapitola: '#FF0000',
  jine_cislo: '#00FF00',
  cislo_strany: '#0000FF',
  edited: '#FF00FF',
  edited2: '#234678',
};

export const getAnnotationColor = (type: string) => {
  const jsonKey = type.split(' ').join('_');
  return colorMap[jsonKey] || '#000000';
};
