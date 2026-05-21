import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
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
    const formattedSetName = "pokemon-" + setNameRaw.toLowerCase()
        .replace(/[^a-z0-9\s&-]/gi, "")  
        .replace(/\s+/g, "-");

    const formattedSealedName = sealedNameRaw.toLowerCase()
         .replace(/[^a-z0-9\s&-]/gi, "")
         .replace(/\s+/g, "-");

    const url = `https://www.pricecharting.com/game/${formattedSetName}/${formattedSealedName}`;
    console.log('Fetching PriceCharting URL:', url);

    try {
      // Fetch HTML with axios
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

      const $ = cheerio(html);

      // Extract prices by parsing table rows
      const priceMap = {};
      $('table').each((tableIdx, table) => {
        $(table).find('tr').each((rowIdx, row) => {
          const cells = $(row).find('td');
          if (cells.length >= 2) {
            const label = cells.eq(0).text().trim();
            const price = cells.eq(1).find('.price').text().trim() || cells.eq(1).text().trim();
            if (label && price && price.includes('$')) {
              priceMap[label] = price;
            }
          }
        });
      });

      const prices = {
        ungraded: priceMap['Ungraded'] || "N/A",
        grade7: priceMap['Grade 7'] || "N/A",
        grade8: priceMap['Grade 8'] || "N/A",
        grade9: priceMap['Grade 9'] || "N/A",
        grade9_5: priceMap['Grade 9.5'] || "N/A",
        psa10: priceMap['PSA 10'] || "N/A",
      };

      // If no valid prices were found
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
      console.error("Error during scraping:", error.message);
      if (error.response) {
        console.error("Response status:", error.response.status);
      }
      try {
        await interaction.editReply(`❌ Could not fetch price. PriceCharting may have changed their page format.\n🔗 [Try manually](${url})`);
      } catch (discordErr) {
        console.error("Failed to send error reply:", discordErr.message);
      }
    }
}
