const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const puppeteer = require("puppeteer");
const puppeteerExtra = require("puppeteer-extra");
const pluginStealth = require("puppeteer-extra-plugin-stealth");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("price")
    .setDescription("Get the current price of a Pokémon card from PriceCharting")
    .addStringOption(option =>
      option.setName("set")
        .setDescription("The set name (e.g., Base Set, Evolving Skies)")
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName("card")
        .setDescription("The Pokémon card name (e.g., Charizard, Pikachu VMAX)")
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName("number")
        .setDescription("The card number (e.g., 110, 001, 15/108)")
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply(); // Acknowledge the interaction immediately

    function capitalizeWords(str) {
      return str
        .toLowerCase()
        .replace(/\b\w/g, char => char.toUpperCase());
    }

    const setNameRaw = interaction.options.getString("set");
    const cardNameRaw = interaction.options.getString("card");
    const cardNumberRaw = interaction.options.getString("number");

    const capitalizedSetName = capitalizeWords(setNameRaw);
    const capitalizedCardName = capitalizeWords(cardNameRaw);
    const capitalizedCardNumber = cardNumberRaw;

    const formattedSetName = "pokemon-" + setNameRaw
      .replace(/[^a-z0-9\s&-]/gi, "")
      .replace(/\s+/g, "-");

    const formattedCardName = cardNameRaw.toLowerCase()
      .replace(/\s+/g, "-");

    const formattedCardNumber = cardNumberRaw.replace(/\//g, "-");

    const url = `https://www.pricecharting.com/game/${formattedSetName}/${formattedCardName}-${formattedCardNumber}`;
    puppeteerExtra.use(pluginStealth());

    try {
      const browser = await puppeteerExtra.launch({
        headless: "new",
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--no-zygote',
          '--single-process',
          '--no-first-run',
          '--disable-background-networking',
          '--disable-default-apps',
          '--disable-extensions',
          '--disable-sync',
          '--metrics-recording-only',
          '--mute-audio'
        ],
        executablePath: '/usr/bin/chromium-browser',
      });
      const page = await browser.newPage();

      await page.setRequestInterception(true);
      page.on("request", (req) => {
        const blocked = ["image", "stylesheet", "font", "media"];
        if (blocked.includes(req.resourceType())) {
          req.abort();
        } else {
          req.continue();
        }
      });

      await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });

      // Scrape prices from the page
      const prices = await page.evaluate(() => {
        const getPrice = (selector) => {
          const el = document.querySelector(selector);
          return el ? el.innerText.trim() : "N/A";
        };

        const getImage = () => {
          const el = document.querySelector(".cover img");
          return el ? el.src : null;
        };

        return {
          image: getImage(),
          ungraded: getPrice("#used_price .price"),
          grade7: getPrice("#complete_price .price"),
          grade8: getPrice("#new_price .price"),
          grade9: getPrice("#graded_price .price"),
          grade9_5: getPrice("#box_only_price .price"),
          psa10: getPrice("#manual_only_price .price"),
        };
      });

      // If no valid prices were found, send a reply with a manual check link
      if (Object.values(prices).every(price => price === "N/A")) {
        await browser.close();
        return interaction.editReply(`❌ No valid prices found for **${cardNameRaw}** #${cardNumberRaw} in **${setNameRaw}**.\n🔗 [Check manually](${url})`);
      }

      // Create the embed with the scraped price information
      const embed = new EmbedBuilder()
        .setTitle(`${capitalizedCardName} #${capitalizedCardNumber} - ${capitalizedSetName}`)
        .setURL(url)
        .setColor(0xFFD700)
        .setImage(prices.image || "https://via.placeholder.com/240?text=No+Image")
        .addFields(
          { name: "🟢 Ungraded", value: prices.ungraded, inline: true },
          { name: "🔵 Grade 7", value: prices.grade7, inline: true },
          { name: "🟣 Grade 8", value: prices.grade8, inline: true },
          { name: "🟡 Grade 9", value: prices.grade9, inline: true },
          { name: "🟠 Grade 9.5", value: prices.grade9_5, inline: true },
          { name: "🔴 PSA 10", value: prices.psa10, inline: true }
        )
        .setFooter({
          text: "Data from PriceCharting | Use responsibly | By nahPkn",
          iconURL: "https://cdn.discordapp.com/attachments/926672437184176188/1354273812799029392/images.png"
        })
        .setTimestamp();

      // Create buttons for each grade
      const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("recent_ungraded")
          .setLabel("Recent Ungraded Sales")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("recent_grade9")
          .setLabel("Recent Grade 9 Sales")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("recent_psa10")
          .setLabel("Recent PSA 10 Sales")
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.editReply({ embeds: [embed], components: [actionRow] }); // Visible to everyone

      // Button interaction handling
      const filter = i => i.user.id === interaction.user.id;
      const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

      collector.on("collect", async i => {
        console.log(`Button clicked: ${i.customId} by ${i.user.tag}`); // Log button interaction
        await i.deferUpdate(); // Acknowledge the button interaction

        // Define selectors for the sales table based on the button clicked
        const gradeSelector = {
          recent_ungraded: ".completed-auctions-used tbody tr",
          recent_grade9: ".completed-auctions-graded tbody tr",
          recent_psa10: ".completed-auctions-manual-only tbody tr"
        }[i.customId];

        console.log(`Fetching recent sales for grade: ${i.customId}`); // Log the grade being processed

        // Scrape recent sales data
        const recentSales = await page.evaluate((selector) => {
          const rows = document.querySelectorAll(selector);
          const sales = [];
          rows.forEach(row => {
            const date = row.querySelector(".date")?.innerText.trim();
            const priceText = row.querySelector(".numeric .js-price")?.innerText.trim();
            const price = priceText ? parseFloat(priceText.replace(/[^0-9.]/g, "")) : null; // Extract numeric price
            if (date && price) {
              sales.push({ date, price });
            }
          });
          return sales.slice(0, 5); // Limit to 5 most recent sales
        }, gradeSelector);

        console.log(`Scraped recent sales for ${i.customLabel}:`, recentSales); // Log the scraped data

        if (!recentSales || recentSales.length === 0) {
          await i.followUp({ content: `No recent sales found for ${i.customId}.` }); // Visible to everyone
        } else {
          // Calculate the average price
          const averagePrice = recentSales.reduce((sum, sale) => sum + sale.price, 0) / recentSales.length;

          // Format the sales list
          const salesList = recentSales.map(sale => `• **${sale.date}** - **$${sale.price.toFixed(2)}**`).join("\n");

          await i.followUp({
            content: `**Recent Sales for ${i.customLabel}:**\n${salesList}\n\n**Average Price:** $${averagePrice.toFixed(2)}` // Visible to everyone
          });
        }
      });
      collector.on("end", async collected => {
        console.log(`Button interaction collector ended. Collected ${collected.size} interactions.`);
        await browser.close(); // Close the browser after the collector ends
      });

    } catch (error) {
      console.error("Error during scraping:", error);
      await interaction.editReply(`❌ Could not fetch price. PriceCharting may have changed their page format.\n🔗 [Try manually](${url})`);
    }
  },
};