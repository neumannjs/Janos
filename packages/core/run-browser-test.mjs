/**
 * Headless browser test for image processing
 */
import puppeteer from 'puppeteer';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Simple static file server
function startServer(port) {
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
  };

  const server = createServer((req, res) => {
    let filePath = join(__dirname, req.url === '/' ? 'test-image.html' : req.url);

    if (!existsSync(filePath)) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const ext = extname(filePath);
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    try {
      const content = readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    } catch (err) {
      res.writeHead(500);
      res.end('Server error');
    }
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`Server running at http://localhost:${port}/`);
      resolve(server);
    });
  });
}

async function runTest() {
  const PORT = 8765;
  let server;
  let browser;

  try {
    // Start server
    server = await startServer(PORT);

    // Launch browser
    console.log('\nLaunching browser...');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    // Capture console output
    page.on('console', msg => {
      const type = msg.type();
      if (type === 'error') {
        console.log('Browser Error:', msg.text());
      } else if (type === 'log') {
        console.log('Browser Log:', msg.text());
      }
    });

    // Navigate to test page
    console.log('Loading test page...');
    await page.goto(`http://localhost:${PORT}/test-image.html`, {
      waitUntil: 'networkidle0',
    });

    // Fetch a test image and convert to base64
    console.log('\nFetching test image from picsum.photos...');
    const imageResponse = await fetch('https://picsum.photos/800/600.jpg');
    const imageBuffer = await imageResponse.arrayBuffer();
    const imageBase64 = Buffer.from(imageBuffer).toString('base64');
    console.log(`Downloaded ${imageBuffer.byteLength} bytes`);

    // Inject the image and process it
    console.log('\nProcessing image in browser...');

    const result = await page.evaluate(async (base64Data) => {
      // Convert base64 to File
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/jpeg' });
      const file = new File([blob], 'test-image.jpg', { type: 'image/jpeg' });

      // Set the file as selected
      window.selectedFile = file;

      // Import the codecs
      const { decode: decodeJpeg, encode: encodeJpeg } = await import('https://esm.sh/@jsquash/jpeg@1.6.0');
      const { encode: encodeWebp } = await import('https://esm.sh/@jsquash/webp@1.5.0');
      const { encode: encodeAvif } = await import('https://esm.sh/@jsquash/avif@2.1.1');
      const resize = (await import('https://esm.sh/@jsquash/resize@2.1.1')).default;

      const SIZE_PRESETS = { s: 480, m: 768, l: 1024 };
      const FORMATS = ['avif', 'webp', 'jpg'];
      const QUALITY = { avif: 50, webp: 80, jpg: 80 };

      // Decode image
      const startTime = performance.now();
      const arrayBuffer = await file.arrayBuffer();

      // Use browser native decoding
      const imageBitmap = await createImageBitmap(blob);
      const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imageBitmap, 0, 0);
      const imageData = ctx.getImageData(0, 0, imageBitmap.width, imageBitmap.height);

      console.log(`Decoded: ${imageData.width}x${imageData.height}`);

      // Calculate sizes
      const targetSizes = Object.entries(SIZE_PRESETS)
        .map(([preset, pixels]) => ({ preset, pixels: Math.min(pixels, imageData.width) }))
        .filter((s, i, arr) => arr.findIndex(a => a.pixels === s.pixels) === i);

      const results = {
        original: {
          width: imageData.width,
          height: imageData.height,
          size: arrayBuffer.byteLength,
        },
        variants: {},
        totalVariants: 0,
        timings: {},
      };

      // Process each format
      for (const format of FORMATS) {
        results.variants[format] = [];
        const formatStart = performance.now();

        for (const { preset, pixels } of targetSizes) {
          // Resize
          let resizedData = imageData;
          if (pixels < imageData.width) {
            const aspectRatio = imageData.height / imageData.width;
            const targetHeight = Math.round(pixels * aspectRatio);
            resizedData = await resize(imageData, { width: pixels, height: targetHeight });
          }

          // Encode
          let encoded;
          if (format === 'avif') {
            encoded = new Uint8Array(await encodeAvif(resizedData, { quality: QUALITY.avif }));
          } else if (format === 'webp') {
            encoded = new Uint8Array(await encodeWebp(resizedData, { quality: QUALITY.webp }));
          } else {
            encoded = new Uint8Array(await encodeJpeg(resizedData, { quality: QUALITY.jpg }));
          }

          results.variants[format].push({
            preset,
            width: resizedData.width,
            height: resizedData.height,
            size: encoded.byteLength,
          });
          results.totalVariants++;

          console.log(`  ${format.toUpperCase()} ${preset}: ${resizedData.width}x${resizedData.height} = ${(encoded.byteLength / 1024).toFixed(1)} KB`);
        }

        results.timings[format] = Math.round(performance.now() - formatStart);
      }

      results.totalTime = Math.round(performance.now() - startTime);
      return results;
    }, imageBase64);

    // Print results
    console.log('\n' + '='.repeat(60));
    console.log('IMAGE PROCESSING TEST RESULTS');
    console.log('='.repeat(60));
    console.log(`\nOriginal: ${result.original.width}x${result.original.height} (${(result.original.size / 1024).toFixed(1)} KB)`);
    console.log(`Total variants: ${result.totalVariants}`);
    console.log(`Total processing time: ${result.totalTime}ms`);

    console.log('\nVariants by format:');
    for (const [format, variants] of Object.entries(result.variants)) {
      console.log(`\n  ${format.toUpperCase()} (${result.timings[format]}ms):`);
      for (const v of variants) {
        const ratio = ((v.size / result.original.size) * 100).toFixed(1);
        console.log(`    ${v.preset}: ${v.width}x${v.height} = ${(v.size / 1024).toFixed(1)} KB (${ratio}% of original)`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('TEST PASSED ✓');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\nTest failed:', error);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
    if (server) server.close();
  }
}

runTest();
