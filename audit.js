const puppeteer = require('puppeteer');
const Crawler = require('simplecrawler');
const fs = require('fs');
const path = require('path');

// আপনার এজেন্সির টার্গেটেড ওয়েবসাইট
const targetDomain = "https://www.logoinhours.com/"; 

const viewports = [
    { name: 'Mobile', width: 375, height: 812 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Desktop', width: 1440, height: 900 }
];

async function startAudit() {
    console.log(`Starting crawl for: ${targetDomain}`);
    const crawler = new Crawler(targetDomain);
    const pagesToAudit = [];

    // স্ক্রিনশট ফোল্ডার তৈরি
    if (!fs.existsSync('./screenshots')) fs.mkdirSync('./screenshots');

    crawler.on("fetchcomplete", function (queueItem) {
        if (queueItem.stateData.contentType.includes("text/html")) {
            pagesToAudit.push(queueItem.url);
        }
    });

    crawler.on("complete", async function () {
        console.log(`Found ${pagesToAudit.length} pages. Running Puppeteer...`);
        
        // GitHub Actions এর জন্য বিশেষ ব্রাউজার সেটিংস
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        let reportData = [];

        // সর্বোচ্চ ২০০ পেজ লুপে চলবে
        for (const url of pagesToAudit.slice(0, 200)) { 
            let urlReport = { url, screenshots: [] };
            let sanitizedUrl = url.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            
            for (const vp of viewports) {
                await page.setViewport({ width: vp.width, height: vp.height });
                try {
                    // পেজ লোড হওয়ার জন্য সর্বোচ্চ ৬০ সেকেন্ড অপেক্ষা করবে
                    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
                    
                    const fileName = `${sanitizedUrl}-${vp.name}.png`;
                    const filePath = path.join(__dirname, 'screenshots', fileName);
                    
                    // ফুল পেজ স্ক্রিনশট নেবে
                    await page.screenshot({ path: filePath, fullPage: true });
                    
                    // ফিক্সড অংশ: ইমেজ লিংকটি সরাসরি গিটহাব র (Raw) ইমেজের পাথ হিসেবে সেট করা হয়েছে
                    const githubRawImageUrl = `https://raw.githubusercontent.com/Mostafijemon24/Responsive-checker/refs/heads/main/screenshots/${fileName}`;
                    
                    urlReport.screenshots.push({ 
                        device: vp.name, 
                        image: githubRawImageUrl, 
                        status: 'Success' 
                    });
                    
                    console.log(`Captured: ${vp.name} for ${url}`);
                } catch (error) {
                    urlReport.screenshots.push({ device: vp.name, image: null, status: 'Failed', error: error.message });
                    console.log(`Failed: ${vp.name} for ${url} - Error: ${error.message}`);
                }
            }
            reportData.push(urlReport);
        }
        
        // ফাইনাল রিপোর্ট JSON ফাইলে রাইট করা
        fs.writeFileSync('./report.json', JSON.stringify(reportData, null, 2));
        await browser.close();
        console.log("Audit complete! Report saved.");
    });

    crawler.start();
}

startAudit();
