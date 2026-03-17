# CrawlAPI - Puppeteer API Sniffer to Postman

A powerful Node.js script using Puppeteer to act as a universal API sniffer. It automatically launches a browser, captures `fetch` and `XHR` network requests, and exports them directly into a **Postman Collection** JSON file.

## Features
- Launches a non-headless browser to allow user interaction.
- Captures all `fetch` and `XHR` requests in the background.
- **Auto-generates Postman Collection**: Exports captured requests into a `crawlapi.postman_collection.json` file compatible with Postman v2.1.0.
- Preserves URLs, Methods, Query Parameters, Headers, and Request Bodies.
- **Smart Auth Detection**: Automatically extracts `Authorization: Bearer <token>` headers and converts them into Postman's native Bearer Auth format.
- Supports multi-tab browsing (automatically attaches listeners to newly opened tabs/popups).
- Clean terminal output: Only system status logs are displayed on the terminal, keeping it clean while data is silently saved to JSON.

## Prerequisites
- Node.js (v14 or later)
- NPM or Yarn
- Postman (to import and use the generated collection)

## Installation
1. Navigate to the project directory:
   ```bash
   cd /var/www/crawlapi
   ```
2. Install the required dependencies (Puppeteer):
   ```bash
   npm install
   ```

## Usage
Run the script from the command line, passing the target URL as an argument:
```bash
node api-sniffer.js <URL>
```

**Example:**
```bash
node api-sniffer.js https://reqres.in/
```

## How to Import to Postman
1. Run the script and interact with the target website to trigger APIs.
2. A file named `crawlapi.postman_collection.json` will be generated in your project directory.
3. Open the **Postman** application.
4. Click on the **Import** button (usually in the top left corner).
5. Drag and drop the `crawlapi.postman_collection.json` file, or select it from your file system.
6. The collection will be imported instantly, allowing you to view and replay all the captured API requests!

## License
ISC