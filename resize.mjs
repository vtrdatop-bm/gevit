import { Jimp } from 'jimp';

async function main() {
  try {
    console.log("Reading public/logo.png...");
    const image = await Jimp.read('public/logo.png');
    
    const sizes = [
      { name: 'icon-512x512.png', size: 512, padding: 32 },
      { name: 'icon-192x192.png', size: 192, padding: 12 },
      { name: 'apple-touch-icon.png', size: 180, padding: 0 }, // iOS usually handles its own rounding/padding if full bleed
      { name: 'favicon-32x32.png', size: 32, padding: 2 }
    ];

    for (const item of sizes) {
      console.log(`Generating ${item.name}...`);
      const bg = new Jimp({
        width: item.size,
        height: item.size,
        color: 0x00000000
      });

      const iconImg = image.clone();
      const drawSize = item.size - (item.padding * 2);
      iconImg.contain({ w: drawSize, h: drawSize });

      const x = Math.floor((item.size - iconImg.bitmap.width) / 2);
      const y = Math.floor((item.size - iconImg.bitmap.height) / 2);
      bg.composite(iconImg, x, y);

      await bg.write(`public/${item.name}`);
    }

    console.log("All icons generated successfully.");
  } catch (error) {
    console.error("Error generating icons:", error);
  }
}

main();
