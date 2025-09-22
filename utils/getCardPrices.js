const axios = require('axios');
const cheerio = require('cheerio');

async function getCardPrice(url) {
    try {
        const { data: html } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (X11; Linux armv7l) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36'
            }
        });
        const $ = cheerio.load(html);

        // Adjust this selector based on the actual structure of PriceCharting's HTML
        const price = $('span.price').first().text().trim();

        if (!price) {
            throw new Error('Price not found. The site layout may have changed.');
        }

        return price;
    } catch (error) {
        console.error('Scraping error:', error.message);
        return 'Error fetching price.';
    }
}

module.exports = getCardPrice;
