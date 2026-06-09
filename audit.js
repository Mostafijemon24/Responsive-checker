const puppeteer = require('puppeteer');
const Crawler = require('simplecrawler');
const fs = require('fs');
const path = require('path');

// মূল ডোমেন
const targetDomain = "https://www.logoinhours.com/"; 

const viewports = [
    { name: 'Mobile', width: 375, height: 812 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Desktop', width: 1440, height: 900 }
];

async function startAudit() {
    console.log(`Starting crawl for: ${targetDomain}`);
    const crawler = new Crawler(targetDomain);
    
    // ক্রলারের কিছু জরুরি সেটিংস (যাতে আটকে না যায়)
    crawler.maxDepth = 3; // ৩ লেভেল পর্যন্ত ভেতরে যাবে
    crawler.parseHTMLComments = false;
    crawler.discoverResources = true;
    crawler.downloadUnsupportedFiles = false;
    
    // আপনার হোমপেজটি সবসময় লিস্টে থাকবে, ক্রলার কিছু না পেলেও যেন হোমপেজ চেক হয়
    const pagesToAudit = [targetDomain]; 

    // স্ক্রিনশট ফোল্ডার তৈরি
    if (!fs.existsSync('./screenshots')) fs.mkdirSync('./screenshots');

    crawler.on("fetchcomplete", function (queueItem) {
        if (queueItem.stateData.contentType && queueItem.stateData.contentType.includes("text/html")) {
            // ডুপ্লিকেট লিংক এড়ানোর জন্য
            if (!pagesToAudit.includes(queueItem.url)) {
                pagesToAudit.push(queueItem.url);
                console.log(`Found page: ${queueItem.url}`);
            }
        }
    });

    // ক্রলার শেষ হলে বা কোনো কারণে আটকে গেলেও এই ফাংশন রান হবে
    async function runPuppeteer() {
        console.log(`Total ${pagesToAudit.length} pages ready for Puppeteer. Starting browser...`);
        
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        let reportData = [];

        // সর্বোচ্চ ৫০টি পেজ দিয়ে টেস্ট রান করুন প্রথমে (পরে ২০০ করে দিয়েন)
        for (const url of pagesToAudit.slice(0, 50)) { 
            let urlReport = { url, screenshots: [] };
            let sanitizedUrl = url.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            
            console.log(`Auditing: ${url}`);
            
            for (const vp of viewports) {
                await page.setViewport({ width: vp.width, height: vp.height });
                try {
                    await page.goto(url, { waitUntil: 'networkidle2', timeout: 40000 });
                    
                    const fileName = `${sanitizedUrl}-${vp.name}.png`;
                    const filePath = path.join(__dirname, 'screenshots', fileName);
                    
                    await page.screenshot({ path: filePath, fullPage: true });
                    
                    const githubRawImageUrl = `https://raw.githubusercontent.com/Mostafijemon24/Responsive-checker/refs/heads/main/screenshots/${fileName}`;
                    
                    urlReport.screenshots.push({ 
                        device: vp.name, 
                        image: githubRawImageUrl, 
                        status: 'Success' 
                    });
                } catch (error) {
                    urlReport.screenshots.push({ device: vp.name, image: null, status: 'Failed', error: error.message });
                }
            }
            reportData.push(urlReport);
        }
        
        // ফাইল রাইট নিশ্চিত করা
        fs.writeFileSync('./report.json', JSON.stringify(reportData, null, 2));
        await browser.close();
        console.log("Audit complete! report.json generated successfully.");
    }

    crawler.on("complete", async function () {
        await runPuppeteer();
    });

    // কোনো কারণে ক্রলার ক্র্যাশ করলে বা লিংক না পেলেও যেন ফাইল জেনারেট হয়
    crawler.on("crawlerror", async function() {
        console.log("Crawler faced an error, forcing Puppeteer to run on available links...");
        await runPuppeteer();
    });

    crawler.start();
}

startAudit();        const page = await browser.newPage();
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
