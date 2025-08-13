import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testSimpleUpload() {
  console.log('🚀 Starting simple upload and process test...');
  
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    // Enable detailed console logging
    page.on('console', msg => console.log('PAGE:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url()));

    // Navigate to app
    console.log('\n📝 Navigating to application...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Upload file
    console.log('\n📤 Uploading test audio file...');
    const audioFilePath = path.join(__dirname, 'test-audio.mp3');
    const fileInput = await page.$('input[type="file"]');
    await fileInput.uploadFile(audioFilePath);
    console.log('✅ File uploaded');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check file appears in list
    const fileName = await page.$eval('.font-semibold.text-gray-900', el => el.textContent);
    console.log(`✅ File appears in list: ${fileName}`);
    
    // Click Process All button
    console.log('\n🎬 Starting processing...');
    const processBtn = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(btn => btn.textContent.includes('Process All'));
    });
    await processBtn.click();
    console.log('✅ Clicked Process All');
    
    // Monitor for 30 seconds max
    console.log('\n⏳ Monitoring status for 30 seconds...');
    let lastStatus = '';
    for (let i = 0; i < 30; i++) {
      try {
        const status = await page.$eval(
          'span[class*="rounded-full"][class*="text-xs"]',
          el => el.textContent.trim()
        );
        
        if (status !== lastStatus) {
          console.log(`   Status: ${status}`);
          lastStatus = status;
          
          if (status === 'Completed') {
            console.log('✅ Processing completed successfully!');
            
            // Try to download
            const downloadBtn = await page.$('button svg[stroke="currentColor"]')?.asElement()?.parentElement;
            if (downloadBtn) {
              await downloadBtn.click();
              console.log('✅ Download initiated');
            }
            break;
          }
          
          if (status === 'Failed') {
            console.log('❌ Processing failed');
            
            // Try to get error details
            const errorDetails = await page.evaluate(() => {
              const errorElements = document.querySelectorAll('.text-red-600, .text-red-500');
              return Array.from(errorElements).map(el => el.textContent).join(' | ');
            });
            if (errorDetails) {
              console.log(`   Error details: ${errorDetails}`);
            }
            break;
          }
        }
        
        // Get progress if available
        const progress = await page.$eval(
          '.h-1\\.5.bg-blue-500',
          el => el.style.width
        ).catch(() => null);
        
        if (progress && progress !== '0%') {
          console.log(`   File progress: ${progress}`);
        }
        
      } catch (e) {
        // Element not found, continue
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Take final screenshot
    await page.screenshot({ path: 'test-simple-final.png', fullPage: true });
    console.log('\n📸 Final screenshot saved: test-simple-final.png');
    
    // Get final stats
    const stats = await page.evaluate(() => {
      const statDivs = document.querySelectorAll('.text-center');
      const result = {};
      statDivs.forEach(div => {
        const value = div.querySelector('.text-2xl')?.textContent;
        const label = div.querySelector('.text-xs')?.textContent;
        if (value && label) {
          result[label] = value;
        }
      });
      return result;
    });
    
    console.log('\n📊 Final Statistics:');
    Object.entries(stats).forEach(([key, value]) => {
      console.log(`   ${key}: ${value}`);
    });
    
    console.log('\n✅ Test completed!');
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
    await page.screenshot({ path: 'test-error.png', fullPage: true });
  } finally {
    console.log('\n⏰ Closing browser in 3 seconds...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    await browser.close();
  }
}

testSimpleUpload().catch(console.error);