import * as path from 'path';
import * as fs from 'fs';
// We assume 'jimp' is used for image processing in Node/TypeScript environment
import Jimp from 'jimp';

interface FileMapping {
  [key: string]: string;
}

const mediaDir = 'C:\\Users\\OP User\\.gemini\\antigravity-ide\\brain\\d7b7be8a-d106-4e90-89a5-6eabdecb6504';
const outputDir = path.join(__dirname, 'tile_icons');

// Create output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const filesMapping: FileMapping = {
  'media__1782136766632.png': 'grass',
  'media__1782136828112.png': 'ant',
  'media__1782136904265.png': 'blue_flower',
  'media__1782136924170.png': 'red_flower',
  'media__1782137063592.png': 'potted_plant',
  'media__1782139152357.png': 'shovel'
};

/**
 * Removes white backgrounds with anti-aliasing tolerance.
 */
function removeWhiteBackground(image: Jimp): Jimp {
  image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
    const r = this.bitmap.data[idx + 0];
    const g = this.bitmap.data[idx + 1];
    const b = this.bitmap.data[idx + 2];
    const a = this.bitmap.data[idx + 3];

    // Calculate Euclidean distance from pure white (255, 255, 255)
    const dist = Math.sqrt(
      Math.pow(r - 255, 2) + Math.pow(g - 255, 2) + Math.pow(b - 255, 2)
    );

    if (dist < 20) {
      // Set pixel to fully transparent
      this.bitmap.data[idx + 3] = 0;
    } else if (dist < 60) {
      // Anti-aliasing alpha blending near the borders
      const factor = (dist - 20) / 40.0;
      this.bitmap.data[idx + 3] = Math.round(factor * a);
    }
  });

  return image;
}

/**
 * Crops an image to its non-transparent bounding box.
 */
function cropToContent(image: Jimp): Jimp {
  let minX = image.bitmap.width;
  let minY = image.bitmap.height;
  let maxX = -1;
  let maxY = -1;

  // Scan image for non-transparent bounding box
  image.scan(0, 0, image.bitmap.width, image.bitmap.height, (x, y, idx) => {
    const alpha = image.bitmap.data[idx + 3];
    if (alpha > 50) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  });

  if (maxX >= minX && maxY >= minY) {
    const width = maxX - minX + 1;
    const height = maxY - minY + 1;
    image.crop(minX, minY, width, height);
  }

  return image;
}

/**
 * Creates the final game icon with a translucent blue rounded-rectangle background.
 */
async function createGameIcon(srcPath: string, name: string): Promise<void> {
  try {
    const img = await Jimp.read(srcPath);
    let imgRgba = img.clone();

    const width = imgRgba.bitmap.width;
    const height = imgRgba.bitmap.height;

    // Check if the corner pixels are white to determine if it has a white background
    const cornerThreshold = 240;
    const corners = [
      imgRgba.getPixelColor(0, 0),
      imgRgba.getPixelColor(width - 1, 0),
      imgRgba.getPixelColor(0, height - 1),
      imgRgba.getPixelColor(width - 1, height - 1)
    ];

    const isWhiteBg = corners.every((c) => {
      const rgba = Jimp.intToRGBA(c);
      return rgba.r > cornerThreshold && rgba.g > cornerThreshold && rgba.b > cornerThreshold;
    });

    if (isWhiteBg) {
      console.log(`Removing white background for ${name}...`);
      imgRgba = removeWhiteBackground(imgRgba);
    }

    // Crop to content bounding box
    imgRgba = cropToContent(imgRgba);

    const canvasSize = 256;
    // Create new blank transparent image
    const iconCanvas = await new Jimp(canvasSize, canvasSize, 0x00000000);

    // Draw the translucent blue background.
    // In Jimp, we can manually draw shapes or draw a translucent blue box with rounded corners.
    // A nice DodgerBlue color: RGBA(30, 144, 255, 35) -> Hex 0x1e90ff23
    const bgHex = Jimp.rgbaToInt(245, 10, 45, 190);
    const borderHex = Jimp.rgbaToInt(245, 10, 45, 255);
    const borderThickness = 4;
    const margin = 12;

    // Simple rounded rect implementation in Jimp scans pixels to color inside a rounded region
    iconCanvas.scan(0, 0, canvasSize, canvasSize, (x, y, idx) => {
      // Check if pixel is inside the rounded rectangle bounding box
      if (x >= margin && x < canvasSize - margin && y >= margin && y < canvasSize - margin) {
        const radius = 45;
        const widthBound = canvasSize - margin * 2;
        const heightBound = canvasSize - margin * 2;
        
        // Coordinates relative to bounding box
        const rx = x - margin;
        const ry = y - margin;

        let inCorner = false;
        let dist = 0;

        if (rx < radius && ry < radius) {
          // Top-Left corner
          dist = Math.sqrt(Math.pow(radius - rx, 2) + Math.pow(radius - ry, 2));
          inCorner = true;
        } else if (rx > widthBound - radius && ry < radius) {
          // Top-Right corner
          dist = Math.sqrt(Math.pow(rx - (widthBound - radius), 2) + Math.pow(radius - ry, 2));
          inCorner = true;
        } else if (rx < radius && ry > heightBound - radius) {
          // Bottom-Left corner
          dist = Math.sqrt(Math.pow(radius - rx, 2) + Math.pow(ry - (heightBound - radius), 2));
          inCorner = true;
        } else if (rx > widthBound - radius && ry > heightBound - radius) {
          // Bottom-Right corner
          dist = Math.sqrt(Math.pow(rx - (widthBound - radius), 2) + Math.pow(ry - (heightBound - radius), 2));
          inCorner = true;
        }

        // Draw border and background fill
        if (!inCorner || dist <= radius) {
          const isBorder = inCorner
            ? dist > radius - borderThickness
            : (rx < borderThickness || rx >= widthBound - borderThickness || ry < borderThickness || ry >= heightBound - borderThickness);

          if (isBorder) {
            // Apply border color
            iconCanvas.setPixelColor(borderHex, x, y);
          } else {
            // Apply background color
            iconCanvas.setPixelColor(bgHex, x, y);
          }
        }
      }
    });

    // Resize the foreground icon to fit nicely inside the background container
    const maxContentSize = 170;
    const w = imgRgba.bitmap.width;
    const h = imgRgba.bitmap.height;
    const scale = Math.min(maxContentSize / w, maxContentSize / h);
    const newW = Math.round(w * scale);
    const newH = Math.round(h * scale);

    imgRgba.resize(newW, newH);

    // Center and composite the resized foreground image onto the canvas
    const pasteX = Math.round((canvasSize - newW) / 2);
    const pasteY = Math.round((canvasSize - newH) / 2);
    iconCanvas.composite(imgRgba, pasteX, pasteY);

    const outPath = path.join(outputDir, `${name}.png`);
    await iconCanvas.writeAsync(outPath);
    console.log(`Saved processed icon: ${outPath}`);
  } catch (err) {
    console.error(`Error processing ${name}:`, err);
  }
}

async function run(): Promise<void> {
  console.log('Processing icons in TypeScript...');
  for (const [filename, name] of Object.entries(filesMapping)) {
    const srcPath = path.join(mediaDir, filename);
    if (fs.existsSync(srcPath)) {
      await createGameIcon(srcPath, name);
    } else {
      console.error(`Source file not found: ${srcPath}`);
    }
  }
  console.log('Icon processing completed.');
}

run();
