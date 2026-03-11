import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import puppeteer from "puppeteer";
import puppeteerExtra from "puppeteer-extra";
import pluginStealth from "puppeteer-extra-plugin-stealth";
import axios from "axios";
import { load as cheerio } from "cheerio";

export const data = new SlashCommandBuilder()
    .setName("sealed")
    .setDescription("Get the current price of a Pokémon card from PriceCharting")
    .addStringOption(option =>
      option.setName("set")
        .setDescription("The set name (e.g., Base Set, Evolving Skies)")
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName("item")
        .setDescription("The sealed item name (e.g., Booster Box, Booster Bundle)")
        .setRequired(true)
    );

export async function execute(interaction) {
    // Utility function to capitalize words
    function capitalizeWords(str) {
      return str
          .toLowerCase()
          .replace(/\b\w/g, char => char.toUpperCase());
    }

    // Collect options
    const setNameRaw = interaction.options.getString("set");
    const sealedNameRaw = interaction.options.getString("item");

    const capitalizedSetName = capitalizeWords(setNameRaw);
    const capitalizedSealedName = capitalizeWords(sealedNameRaw);

    // Format inputs for URL
    const formattedSetName = "pokemon-" + setNameRaw
        .replace(/[^a-z0-9\s&-]/gi, "")  
        .replace(/\s+/g, "-");

    const formattedSealedName = sealedNameRaw.toLowerCase()
         .replace(/\s+/g, "-");

    const url = `https://www.pricecharting.com/game/${formattedSetName}/${formattedSealedName}`;
    
    console.log(`Scraping URL: ${url}`);
    
    
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
          ],  // Pi-specific settings for better performance
        executablePath: '/usr/bin/chromium-browser',  // Use Chromium installed on the Pi
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
  
      // Set a custom user-agent to avoid being blocked by the site
      await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
      await page.goto(url, { waitUntil: "domcontentloaded"});

      // Scrape prices from the page
      const prices = await page.evaluate(() => {
        const getPrice = (selector) => {
          const el = document.querySelector(selector);
          return el ? el.innerText.trim() : "N/A";
        };

        return {
          ungraded: getPrice("#used_price .price"),
          grade7: getPrice("#complete_price .price"),
          grade8: getPrice("#new_price .price"),
          grade9: getPrice("#graded_price .price"),
          grade9_5: getPrice("#box_only_price .price"),
          psa10: getPrice("#manual_only_price .price"),
        };
      });

      await browser.close();
	  
      // If no valid prices were found, send a reply with a manual check link
      if (Object.values(prices).every(price => price === "N/A")) {
        return interaction.editReply(`❌ No valid prices found for **${sealedNameRaw}** in **${setNameRaw}**.\n🔗 [Check manually](${url})`);
      }

      // Create the embed with the scraped price information
      const embed = new EmbedBuilder()
        .setTitle(`${capitalizedSealedName} - ${capitalizedSetName}`)
        .setURL(url)
        .setColor(0xFFD700)  // Gold color for the embed
        .addFields(
          { name: "🟢 Sealed", value: prices.ungraded, inline: true }
        )
        .setFooter({
          text: "Data from PriceCharting | Use responsibly | By nahPkn",
          iconURL: "https://cdn.discordapp.com/attachments/926672437184176188/1354273812799029392/images.png?ex=67e4b146&is=67e35fc6&hm=86d42e96f8edb9f26730601e2172d6d06b3e46291711fa4edbfc4dba4c93afd2&"
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Error during scraping:", error);
      await interaction.editReply(`❌ Could not fetch price. PriceCharting may have changed their page format.\n🔗 [Try manually](${url})`);
    }
}
