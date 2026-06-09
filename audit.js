const puppeteer = require('puppeteer');
const Crawler = require('simplecrawler');
const fs = require('fs');
const path = require('path');

// আপনার ডোমেন
const targetDomain = "https://www.logoinhours.com/"; 

const viewports = [
    { name: 'Mobile', width: 375, height: 812 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Desktop', width: 1440, height: 900 }
];

async function startAudit() {
    console.log(`Starting crawl for: ${targetDomain}`);
    const crawler = new Crawler(targetDomain);
    
    crawler.maxDepth = 2; 
    crawler.parseHTMLComments = false;
    crawler.discoverResources = true;
    
    const pagesToAudit = [targetDomain]; 

    if (!fs.existsSync('./screenshots')) fs.mkdirSync('./screenshots');

    crawler.on("fetchcomplete", function (queueItem) {
        if (queueItem.stateData.contentType && queueItem.stateData.contentType.includes("text/html")) {
            if (!pagesToAudit.includes(queueItem.url)) {
                pagesToAudit.push(queueItem.url);
                console.log(`Found page: ${queueItem.url}`);
            }
        }
    });

    async function runPuppeteer() {
        console.log(`Total ${pagesToAudit.length} pages ready for Puppeteer. Starting browser...`);
        
        // গিটহাব অ্যাকশনের লিনাক্স এনভায়রনমেন্টের জন্য ফিক্সড ব্রাউজার সেটিংস
        const browser = await puppeteer.launch({
            headless: true,
            executablePath: '/usr/bin/google-chrome', // ইনস্টল করা ক্রোমের পাথ
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ]
        });
        
        const page = await browser.newPage();
        let reportData = [];

        // টেস্ট করার জন্য প্রথমে প্রথম ১০টি পেজ রান হবে (কাজ করলে পরে সংখ্যা বাড়াতে পারবেন)
        for (const url of pagesToAudit.slice(0, 10)) { 
            let urlReport = { url, screenshots: [] };
            let sanitizedUrl = url.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            
            console.log(`Auditing: ${url}`);
            
            for (const vp of viewports) {
                await page.setViewport({ width: vp.width, height: vp.height });
                try {
                    await page.goto(url, { waitUntil: 'networkidle2', timeout: 50000 });
                    
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
        
        fs.writeFileSync('./report.json', JSON.stringify(reportData, null, 2));
        await browser.close();
        console.log("Audit complete! report.json generated.");
    }

    crawler.on("complete", async function () {
        await runPuppeteer();
    });

    crawler.on("crawlerror", async function() {
        await runPuppeteer();
    });

    crawler.start();
}

startAudit();
