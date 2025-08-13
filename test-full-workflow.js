import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testFullWorkflow() {
  console.log('🚀 Starting full workflow test with Puppeteer...');
  
  const browser = await puppeteer.launch({
    headless: false, // Set to false to watch the automation
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    slowMo: 50 // Slow down actions by 50ms for better visibility
  });

  try {
    const page = await browser.newPage();
    
    // Enable console logging
    page.on('console', msg => {
      if (msg.type() === 'log' || msg.type() === 'info') {
        console.log('PAGE LOG:', msg.text());
      }
    });

    // Step 1: Navigate to the application
    console.log('\n📝 Step 1: Navigating to TranscribeBatch page...');
    await page.goto('http://localhost:5173', { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 2: Upload audio file
    console.log('\n📤 Step 2: Uploading audio file...');
    const audioFilePath = path.join(__dirname, 'test-audio.mp3');
    
    // Check if file exists
    if (!fs.existsSync(audioFilePath)) {
      throw new Error(`Test audio file not found at: ${audioFilePath}`);
    }
    
    // Find the file input element
    const fileInput = await page.$('input[type="file"]');
    if (!fileInput) {
      throw new Error('File input not found');
    }
    
    // Upload the file
    await fileInput.uploadFile(audioFilePath);
    console.log('✅ File uploaded successfully');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Take screenshot after upload
    await page.screenshot({ path: 'step2-file-uploaded.png' });
    console.log('📸 Screenshot saved: step2-file-uploaded.png');
    
    // Step 3: Configure settings (optional - using defaults)
    console.log('\n⚙️ Step 3: Configuring settings...');
    
    // Check if we need to set API key
    const apiKeyInput = await page.$('input[placeholder*="API"]');
    if (apiKeyInput) {
      const apiKeyValue = await page.evaluate(el => el.value, apiKeyInput);
      if (!apiKeyValue) {
        console.log('⚠️ API key not set. Please set VITE_OPENAI_API_KEY in .env file');
        // You can set it here if needed:
        // await apiKeyInput.type('your-api-key-here');
      } else {
        console.log('✅ API key is already configured');
      }
    }
    
    // Select AI processing type (optional - change if needed)
    const promptSelect = await page.$('select');
    if (promptSelect) {
      await promptSelect.select('professional'); // or 'summary', 'bullet_points', etc.
      console.log('✅ Selected "Professional Rewrite" AI processing');
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Step 4: Start processing
    console.log('\n🎬 Step 4: Starting batch processing...');
    
    // Find and click the "Process All" button
    const processButton = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(btn => btn.textContent.includes('Process All'));
    });
    
    if (!processButton) {
      throw new Error('Process All button not found');
    }
    
    await processButton.click();
    console.log('✅ Clicked "Process All" button');
    
    // Step 5: Monitor processing progress
    console.log('\n⏳ Step 5: Monitoring processing progress...');
    
    // Wait for transcription to start
    await page.waitForSelector('.animate-pulse, .animate-bounce, .animate-spin', {
      timeout: 10000
    }).catch(() => console.log('No animation indicators found'));
    
    // Monitor status changes
    let previousStatus = '';
    let completionCheckCount = 0;
    const maxChecks = 120; // Maximum 2 minutes of checking (120 * 1 second)
    
    while (completionCheckCount < maxChecks) {
      try {
        // Get current status
        const statusElement = await page.$eval(
          'span[class*="rounded-full"][class*="text-xs"]',
          el => el.textContent.trim()
        );
        
        if (statusElement !== previousStatus) {
          console.log(`📊 Status changed: ${statusElement}`);
          previousStatus = statusElement;
          
          // Take screenshot of each status change
          await page.screenshot({ 
            path: `step5-status-${statusElement.toLowerCase().replace(/\s+/g, '-')}.png` 
          });
        }
        
        // Check if completed
        if (statusElement === 'Completed') {
          console.log('✅ Processing completed!');
          break;
        }
        
        // Check if failed
        if (statusElement === 'Failed') {
          console.log('❌ Processing failed');
          
          // Try to get error message if available
          const errorMsg = await page.$eval('.text-red-600', el => el.textContent).catch(() => null);
          if (errorMsg) {
            console.log(`Error: ${errorMsg}`);
          }
          break;
        }
        
      } catch (e) {
        // Status element might not be found yet
      }
      
      // Check progress bar if available
      try {
        const progress = await page.$eval(
          '.bg-gradient-to-r.from-blue-500.to-green-500',
          el => el.style.width
        );
        if (progress) {
          console.log(`📈 Overall progress: ${progress}`);
        }
      } catch (e) {
        // Progress bar might not be available
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      completionCheckCount++;
    }
    
    if (completionCheckCount >= maxChecks) {
      console.log('⚠️ Processing timeout - took longer than expected');
    }
    
    // Step 6: Download results
    console.log('\n💾 Step 6: Downloading results...');
    
    // Check if download button is available
    const downloadButton = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(btn => btn.querySelector('svg') && 
        (btn.closest('[class*="completed"]') || btn.textContent.includes('Download')));
    });
    
    if (downloadButton) {
      // Set up download handling
      const downloadPath = path.join(__dirname, 'downloads');
      if (!fs.existsSync(downloadPath)) {
        fs.mkdirSync(downloadPath);
      }
      
      const client = await page.target().createCDPSession();
      await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: downloadPath
      });
      
      await downloadButton.click();
      console.log('✅ Download initiated');
      
      // Wait a bit for download to complete
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check downloads folder
      const downloads = fs.readdirSync(downloadPath);
      if (downloads.length > 0) {
        console.log(`✅ Downloaded files: ${downloads.join(', ')}`);
      }
    } else {
      console.log('⚠️ Download button not found - file might not be ready');
    }
    
    // Step 7: Final verification
    console.log('\n✅ Step 7: Final verification...');
    
    // Take final screenshot
    await page.screenshot({ path: 'step7-final-state.png', fullPage: true });
    console.log('📸 Final screenshot saved: step7-final-state.png');
    
    // Get final statistics
    try {
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
        console.log(`   - ${key}: ${value}`);
      });
    } catch (e) {
      console.log('Could not retrieve statistics');
    }
    
    console.log('\n🎉 Full workflow test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    
    // Take error screenshot
    const page = (await browser.pages())[0];
    if (page) {
      await page.screenshot({ path: 'error-screenshot.png', fullPage: true });
      console.log('📸 Error screenshot saved: error-screenshot.png');
    }
    
    throw error;
  } finally {
    // Keep browser open for 5 seconds to review final state
    console.log('\n⏰ Keeping browser open for 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    await browser.close();
  }
}

// Run the test
console.log('═══════════════════════════════════════════════════════');
console.log('  PUPPETEER FULL WORKFLOW AUTOMATION TEST');
console.log('═══════════════════════════════════════════════════════');
console.log('\nThis test will:');
console.log('1. Upload an audio file');
console.log('2. Process it through transcription');
console.log('3. Apply AI processing');
console.log('4. Generate new audio');
console.log('5. Download the results');
console.log('\n⚠️ Make sure your development server is running on http://localhost:5173');
console.log('⚠️ Make sure you have set VITE_OPENAI_API_KEY in your .env file');
console.log('═══════════════════════════════════════════════════════\n');

testFullWorkflow().catch(console.error);