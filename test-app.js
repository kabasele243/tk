import puppeteer from 'puppeteer';

async function testApplication() {
  console.log('🚀 Starting Puppeteer application verification...');
  
  const browser = await puppeteer.launch({
    headless: false, // Set to true for headless mode
    defaultViewport: { width: 1280, height: 720 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    console.log('📝 Testing TranscribeBatch page...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
    
    // Wait for the page to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Take a screenshot
    await page.screenshot({ path: 'app-screenshot.png', fullPage: true });
    console.log('📸 Screenshot saved as app-screenshot.png');
    
    // Test 1: Check if the main title is present
    console.log('\n🔍 Test 1: Checking main title...');
    const title = await page.$eval('h1', el => el.textContent);
    console.log(`✅ Found title: "${title}"`);
    
    // Test 2: Check if the file upload zone exists
    console.log('\n🔍 Test 2: Checking file upload zone...');
    const uploadZone = await page.$('[ref="dropZoneRef"], .border-dashed');
    if (uploadZone) {
      console.log('✅ File upload zone found');
    } else {
      console.log('❌ File upload zone not found');
    }
    
    // Test 3: Check if settings panel exists
    console.log('\n🔍 Test 3: Checking settings panel...');
    const settingsPanel = await page.$eval('h3', el => el.textContent);
    if (settingsPanel.includes('Processing Settings')) {
      console.log('✅ Processing settings panel found');
    } else {
      console.log('❌ Processing settings panel not found');
    }
    
    // Test 4: Check if AI prompt dropdown exists
    console.log('\n🔍 Test 4: Checking AI prompt dropdown...');
    const promptDropdown = await page.$('select');
    if (promptDropdown) {
      const options = await page.$$eval('select option', options => 
        options.map(option => option.textContent)
      );
      console.log(`✅ AI prompt dropdown found with ${options.length} options:`);
      options.slice(0, 3).forEach(option => console.log(`   - ${option}`));
      if (options.length > 3) console.log(`   ... and ${options.length - 3} more`);
    } else {
      console.log('❌ AI prompt dropdown not found');
    }
    
    // Test 5: Check if action buttons exist
    console.log('\n🔍 Test 5: Checking action buttons...');
    const buttons = await page.$$eval('button', buttons => 
      buttons.map(btn => btn.textContent.trim()).filter(text => text)
    );
    console.log(`✅ Found ${buttons.length} buttons:`);
    buttons.forEach(button => console.log(`   - "${button}"`));
    
    // Test 6: Check responsive design
    console.log('\n🔍 Test 6: Testing responsive design...');
    await page.setViewport({ width: 768, height: 1024 });
    await new Promise(resolve => setTimeout(resolve, 1000));
    await page.screenshot({ path: 'app-mobile.png' });
    console.log('📱 Mobile screenshot saved as app-mobile.png');
    
    // Test 7: Check for console errors
    console.log('\n🔍 Test 7: Checking for console errors...');
    const logs = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        logs.push(msg.text());
      }
    });
    
    await page.reload({ waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (logs.length === 0) {
      console.log('✅ No console errors found');
    } else {
      console.log(`❌ Found ${logs.length} console errors:`);
      logs.forEach(log => console.log(`   - ${log}`));
    }
    
    // Test 8: Performance metrics
    console.log('\n🔍 Test 8: Performance metrics...');
    const metrics = await page.metrics();
    console.log(`⚡ Performance metrics:`);
    console.log(`   - JSHeapUsedSize: ${(metrics.JSHeapUsedSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   - Timestamp: ${metrics.Timestamp}`);
    
    console.log('\n🎉 Application verification completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
  }
}

// Run the test
testApplication().catch(console.error);