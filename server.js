const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/generate-pdf', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).send('URL is required');
    }

    try {
        // ১. ব্রাউজার লঞ্চ করার সময় ফোর্সভালি হার্ডওয়্যার এক্সিলারেশন এবং 4K স্কেল অন করা
        const browser = await puppeteer.launch({
            args: [
                '--force-device-scale-factor=4', 
                '--high-dpi-support=1',
                '--disable-gpu'
            ]
        });
        
        const page = await browser.newPage();

        // ২. একদম ট্রু 4K (Ultra HD) ভিউপোর্ট সেট করা
        await page.setViewport({
            width: 3840,
            height: 2160,
            deviceScaleFactor: 4 
        });

        // ৩. স্ক্রিন মোড চালু করা
        await page.emulateMediaType('screen');
        
        // ওয়েবসাইট লোড করা
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

        // ৪. Lazy-Load বাইপাস করা: পুরো পেজটি নিচ পর্যন্ত অটো-স্ক্রল করানো যাতে সব HD ছবি লোড হয়
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 100; // প্রতি ১০০ পিক্সেল করে স্ক্রল করবে
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;

                    if (totalHeight >= scrollHeight - window.innerHeight) {
                        clearInterval(timer);
                        // স্ক্রল শেষে আবার একদম উপরে ফিরে যাওয়া
                        window.scrollTo(0, 0); 
                        resolve();
                    }
                }, 100); // ১০০ মিলিসেকেন্ড পরপর
            });
        });

        // স্ক্রল করার পর হাই-রেজোলিউশন ছবিগুলো লোড হওয়ার জন্য অতিরিক্ত ৩ সেকেন্ড অপেক্ষা করা
        await new Promise(resolve => setTimeout(resolve, 3000));

        // ৫. ফন্ট এবং ইমেজের শার্পনেস একদম ম্যাক্সিমাম করার জন্য CSS ইনজেক্ট করা
        await page.addStyleTag({
            content: `
                * {
                    -webkit-font-smoothing: antialiased !important;
                    -moz-osx-font-smoothing: grayscale !important;
                    text-rendering: optimizeLegibility !important;
                    image-rendering: high-quality !important;
                }
            `
        });

        // ৬. UHD পিডিএফ জেনারেট করা (স্কেল কিছুটা কমিয়ে পিক্সেল ডেনসিটি বাড়ানো হয়েছে)
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            scale: 0.6, // স্কেল কমানোর ফলে 4K ভিউপোর্টের বিশাল অংশ A4 এ ধরবে এবং পিক্সেলগুলো একদম গায়ে-গায়ে লেগে শার্প হবে
            preferCSSPageSize: true
        });

        await browser.close();

        // ফ্রন্টএন্ডে PDF ফাইল পাঠানো
        res.contentType("application/pdf");
        res.send(pdfBuffer);

    } catch (error) {
        console.error(error);
        res.status(500).send('Error generating PDF');
    }
});

app.listen(3000, () => console.log('Server running on port 3000'));