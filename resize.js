import Jimp from 'jimp';

async function main() {
  const image = await Jimp.read('public/logo.png');
  
  // Create a 512x512 transparent background
  new Jimp(512, 512, 0x00000000, async (err, bg) => {
    if (err) throw err;
    
    // Scale the logo to fit within 512x512 (with padding)
    image.contain(480, 480);
    
    // Composite the logo onto the center of the transparent background
    const x = Math.floor((512 - image.bitmap.width) / 2);
    const y = Math.floor((512 - image.bitmap.height) / 2);
    bg.composite(image, x, y);
    
    await bg.writeAsync('public/icon-512x512.png');
    
    const icon192 = bg.clone().resize(192, 192);
    await icon192.writeAsync('public/icon-192x192.png');
    
    console.log("Icons generated successfully.");
  });
}

main().catch(console.error);
