const puppeteer = require('puppeteer');
const Crawler = require('simplecrawler');
const fs = require('fs');
const path = require('path');

// আপনার এজেন্সির যে ওয়েবসাইটটি চেক করতে চান তার রুট ডোমেন এখানে দিন
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

        // সর্বোচ্চ ৫০-১০০ পেজ বা আপনার ২০০ পেজ লুপে চলবে
        for (const url of pagesToAudit.slice(0, 200)) { 
            let urlReport = { url, screenshots: [] };
            let sanitizedUrl = url.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            
            for (const vp of viewports) {
                await page.setViewport({ width: vp.width, height: vp.height });
                try {
                    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
                    
                    const fileName = `${sanitizedUrl}-${vp.name}.png`;
                    const filePath = path.join(__dirname, 'screenshots', fileName);
                    
                    await page.screenshot({ path: filePath, fullPage: true });
                    urlReport.screenshots.push({ device: vp.name, image: `./screenshots/${fileName}`, status: 'Success' });
                    console.log(`Captured: ${vp.name} for ${url}`);
                } catch (error) {
                    urlReport.screenshots.push({ device: vp.name, image: null, status: 'Failed', error: error.message });
                }
            }
            reportData.push(urlReport);
        }
        
        fs.writeFileSync('./report.json', JSON.stringify(reportData, null, 2));
        await browser.close();
        console.log("Audit complete! Report saved.");
    });

    crawler.start();
}

startAudit();