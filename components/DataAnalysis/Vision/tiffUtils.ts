
/**
 * tiffUtils.ts
 * Utility to convert TIFF files to PNG DataURLs using utif.js
 */
import UTIF from 'utif';

/**
 * convertTiffToDataUrl 
 * Reads a File/Blob, decodes it as TIFF, and returns a PNG data URL.
 */
export const convertTiffToDataUrl = async (file: File | Blob): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const ifds = UTIF.decode(arrayBuffer) as any[];

    // Default to the first IFD (image file directory)
    const ifd = ifds[0];
    UTIF.decodeImage(arrayBuffer, ifd);

    // Get RGBA pixels
    const rgba = UTIF.toRGBA8(ifd);

    // Create a canvas to draw the pixels and export as PNG
    const canvas = document.createElement('canvas');
    canvas.width = ifd.width;
    canvas.height = ifd.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Could not get 2D context");

    const imageData = new ImageData(new Uint8ClampedArray(rgba.buffer as ArrayBuffer), ifd.width, ifd.height);
    ctx.putImageData(imageData, 0, 0);

    return canvas.toDataURL('image/png');
};

/**
 * isTiffFile
 * Checks if a file is a TIFF based on its extension or MIME type.
 */
export const isTiffFile = (file: File): boolean => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    return ext === 'tif' || ext === 'tiff' || file.type === 'image/tiff';
};
