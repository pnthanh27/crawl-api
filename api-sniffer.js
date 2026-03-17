const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
require('dotenv').config();

// Đường dẫn file Postman Collection
const postmanFile = path.join(process.cwd(), 'crawlapi.postman_collection.json');

// Cấu trúc gốc của Postman Collection
let postmanCollection = {
    info: {
        name: "CrawlAPI Sniffer - " + new Date().toISOString(),
        schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
    },
    item: []
};

/**
 * Ghi log RA MÀN HÌNH (dùng cho thông báo hệ thống)
 * @param {string} msg 
 */
function logSystem(msg) {
    console.log(msg);
}

/**
 * Thêm request vào Postman Collection và lưu ra file
 * @param {import('puppeteer').HTTPRequest} request
 */
function appendToPostmanCollection(request) {
    try {
        const reqUrl = request.url();
        const method = request.method();
        const headers = request.headers();
        const postData = request.postData();

        // Bỏ qua các URL không hợp lệ (data:image, about:blank, v.v...)
        if (!reqUrl.startsWith('http')) return;

        const urlObj = new URL(reqUrl);

        // Chuyển đổi Headers
        const headerArr = [];
        for (const [key, value] of Object.entries(headers)) {
            // Bỏ qua các pseudo-headers (ví dụ: :authority, :method, :path, :scheme)
            if (key.startsWith(':')) continue;
            headerArr.push({ key, value });
        }

        // Tạo cấu trúc Body cho Postman
        let bodyObj = undefined;
        if (postData) {
            bodyObj = {
                mode: 'raw',
                raw: postData
            };
        }

        // Phân tích URL components
        const urlHost = urlObj.hostname.split('.');
        const urlPath = urlObj.pathname.split('/').filter(p => p !== '');
        const urlQuery = [];
        for (const [key, value] of urlObj.searchParams.entries()) {
            urlQuery.push({ key, value });
        }

        const postmanItem = {
            name: urlObj.pathname === '/' ? urlObj.hostname : urlObj.pathname,
            request: {
                method: method,
                header: headerArr,
                url: {
                    raw: reqUrl,
                    protocol: urlObj.protocol.replace(':', ''),
                    host: urlHost,
                    path: urlPath,
                    query: urlQuery
                }
            },
            response: [] // Hiện tại để trống array response (có thể mở rộng sau)
        };

        if (bodyObj) {
            postmanItem.request.body = bodyObj;
        }

        // Tự động phân tích Authorization Bearer Token nếu có
        const authHeaderIndex = headerArr.findIndex(h => h.key.toLowerCase() === 'authorization');
        if (authHeaderIndex !== -1) {
            const authValue = headerArr[authHeaderIndex].value;
            if (authValue.toLowerCase().startsWith('bearer ')) {
                postmanItem.request.auth = {
                    type: 'bearer',
                    bearer: [
                        {
                            key: 'token',
                            value: authValue.substring(7),
                            type: 'string'
                        }
                    ]
                };
                // Xoá header Authorization thủ công để dùng chuẩn auth của Postman
                headerArr.splice(authHeaderIndex, 1);
            }
        }

        // Thêm vào danh sách và ghi file
        postmanCollection.item.push(postmanItem);
        fs.writeFileSync(postmanFile, JSON.stringify(postmanCollection, null, 4), 'utf8');

    } catch (err) {
        console.error('[Error] Lỗi khi tạo Postman item:', err.message);
    }
}

/**
 * Attaches event listeners to capture network requests and responses for a given page.
 * @param {import('puppeteer').Page} page
 */
function attachNetworkListener(page) {
    page.on('request', (request) => {
        try {
            const resourceType = request.resourceType();
            
            // Chỉ bắt fetch và xhr
            if (resourceType === 'fetch' || resourceType === 'xhr') {
                appendToPostmanCollection(request);
            }
        } catch (error) {
            console.error('[Error in request listener]:', error.message);
        }
    });

    // Lắng nghe response để theo dõi log (có thể bỏ qua việc ghi vào JSON để giữ file nhẹ)
    // Tạm thời ẩn log body response ra màn hình, chỉ để log ngầm nếu cần
}

/**
 * Main function to orchestrate the browser and pages.
 */
async function main() {
    const args = process.argv.slice(2);
    const targetUrl = args[0] || process.env.TARGET_URL;

    if (!targetUrl) {
        console.error('Usage: node api-sniffer.js [URL]');
        console.error('Or set TARGET_URL in .env file');
        process.exit(1);
    }

    try {
        logSystem(`[Info] Đang khởi động Puppeteer browser...`);
        logSystem(`[Info] File Postman Collection sẽ được lưu tại: ${postmanFile}`);
        
        // Tạo file Postman JSON ban đầu
        fs.writeFileSync(postmanFile, JSON.stringify(postmanCollection, null, 4), 'utf8');

        const browser = await puppeteer.launch({
            headless: false,
            defaultViewport: null, // Allow viewport to adapt to the window size
            args: ['--start-maximized'] // Attempt to start maximized
        });

        // Listen for new targets (new tabs/popups)
        browser.on('targetcreated', async (target) => {
            if (target.type() === 'page') {
                try {
                    const newPage = await target.page();
                    if (newPage) {
                        logSystem(`\n[Info] New tab detected. Attaching network listener...`);
                        attachNetworkListener(newPage);
                    }
                } catch (err) {
                    console.error('[Error] Failed to attach listener to new tab:', err.message);
                }
            }
        });

        // Get the default open page (if any)
        const pages = await browser.pages();
        const mainPage = pages.length > 0 ? pages[0] : await browser.newPage();

        logSystem(`[Info] Attaching network listeners to the main page...`);
        attachNetworkListener(mainPage);

        logSystem(`[Info] Navigating to: ${targetUrl}`);
        // We catch navigation errors (e.g., timeout) so it doesn't crash the sniffer immediately
        try {
            await mainPage.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        } catch (navError) {
            console.warn(`[Warning] Navigation finished with a warning/timeout: ${navError.message}`);
        }

        logSystem(`\n============================================================`);
        logSystem(`[Success] Page loaded! API Sniffer is active.`);
        logSystem(`[Instructions] Interact with the page. We will capture fetch/xhr.`);
        logSystem(`============================================================\n`);

    } catch (error) {
        console.error('[Fatal Error] Failed to start API sniffer:', error);
        process.exit(1);
    }
}

// Execute the main function
main();