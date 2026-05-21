import axios from 'axios';
import { load as cheerio } from 'cheerio';

const url = 'https://www.pricecharting.com/game/pokemon-ancient-origins/m-rayquaza-ex-98';

try {
  console.log('Fetching:', url);
  const { data: html } = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    },
    timeout: 10000
  });

  console.log('HTML received, parsing...');
  const $ = cheerio(html);

  const priceMap = {};
  let tableCount = 0;
  $('table').each((tableIdx, table) => {
    tableCount++;
    $(table).find('tr').each((rowIdx, row) => {
      const cells = $(row).find('td');
      if (cells.length >= 2) {
        const label = cells.eq(0).text().trim();
        const price = cells.eq(1).find('.price').text().trim() || cells.eq(1).text().trim();
        if (label && price && price.includes('$')) {
          priceMap[label] = price;
          console.log(`Found: ${label} = ${price}`);
        }
      }
    });
  });

  console.log(`\nScanned ${tableCount} tables`);
  console.log('Final price map:', JSON.stringify(priceMap, null, 2));
} catch (error) {
  console.error('Error:', error.message);
  if (error.response) {
    console.error('Status:', error.response.status);
  }
}
