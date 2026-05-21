import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import axios from "axios";
import { load as cheerio } from "cheerio";

export const data = new SlashCommandBuilder()
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
    );

export async function execute(interaction) {
    function capitalizeWords(str) {
      return str.replace(/\b\w/g, char => char.toUpperCase());
    }

    const setNameRaw = interaction.options.getString("set");
    const cardNameRaw = interaction.options.getString("card");
    const cardNumberRaw = interaction.options.getString("number");

    const capitalizedSetName = capitalizeWords(setNameRaw);
    const capitalizedCardName = capitalizeWords(cardNameRaw);
    const capitalizedCardNumber = cardNumberRaw;

    const formattedSetName = "pokemon-" + setNameRaw.toLowerCase()
      .replace(/[^a-z0-9\s&-]/gi, "")
      .replace(/\s+/g, "-");

    const formattedCardName = cardNameRaw.toLowerCase()
      .replace(/[^a-z0-9\s&-]/gi, "")
      .replace(/\s+/g, "-");

    const formattedCardNumber = cardNumberRaw.replace(/\//g, "-");

    const url = `https://www.pricecharting.com/game/${formattedSetName}/${formattedCardName}-${formattedCardNumber}`;
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
        image: $(".cover img").first().attr("src") || null,
        ungraded: priceMap['Ungraded'] || "N/A",
        grade7: priceMap['Grade 7'] || "N/A",
        grade8: priceMap['Grade 8'] || "N/A",
        grade9: priceMap['Grade 9'] || "N/A",
        grade9_5: priceMap['Grade 9.5'] || "N/A",
        psa10: priceMap['PSA 10'] || "N/A",
      };

      // If no valid prices were found
      if (Object.values(prices).slice(1).every(price => price === "N/A")) {
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

      await interaction.editReply({ embeds: [embed], components: [actionRow] });

      // Button interaction handling
      const filter = i => i.user.id === interaction.user.id;
      const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

      collector.on("collect", async i => {
        // Define selectors for the sales table based on the button clicked
        const gradeSelector = {
          recent_ungraded: ".completed-auctions-used tbody tr",
          recent_grade9: ".completed-auctions-graded tbody tr",
          recent_psa10: ".completed-auctions-manual-only tbody tr"
        }[i.customId];

        try {
          await i.deferReply({ ephemeral: false });

          if (!gradeSelector) {
            throw new Error(`No grade selector configured for ${i.customId}`);
          }

          console.log('Fetching recent sales with selector:', gradeSelector, 'url:', url);
          // Fetch the page again for button interaction
          const { data: pageHtml } = await axios.get(url, {
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

          const $page = cheerio(pageHtml);

          const salesRows = $page(gradeSelector);
          console.log('Recent sales row count for', i.customId, salesRows.length);

          // Scrape recent sales data
          const recentSales = [];
          salesRows.slice(0, 5).each((idx, row) => {
            const $row = $page(row);
            const date = $row.find('td.date').text().trim();
            const priceText = $row.find('td.numeric .js-price').first().text().trim();
            const price = priceText ? parseFloat(priceText.replace(/[^0-9.]/g, '')) : null;
            console.log('row', idx, 'date', date, 'priceText', priceText, 'price', price);
            if (date && price) {
              recentSales.push({ date, price });
            }
          });

          if (!recentSales || recentSales.length === 0) {
            await i.editReply({ content: `No recent sales found for ${i.customId}.` });
          } else {
            // Calculate the average price
            const averagePrice = recentSales.reduce((sum, sale) => sum + sale.price, 0) / recentSales.length;

            // Format the sales list
            const salesList = recentSales.map(sale => `• **${sale.date}** - **$${sale.price.toFixed(2)}**`).join("\n");

            await i.editReply({
              content: `**Recent Sales for ${i.customId}:**\n${salesList}\n\n**Average Price:** $${averagePrice.toFixed(2)}`
            });
          }
        } catch (error) {
          console.error("Error fetching sales data:", error);
          if (error.response) {
            console.error('Recent sales response status:', error.response.status);
          }
          try {
            await i.editReply({ content: "Failed to fetch recent sales data." });
          } catch (updateErr) {
            console.error('Failed to reply to button interaction on error:', updateErr);
          }
        }
      });

      collector.on("end", async collected => {
        // Disable buttons after collector ends
        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("recent_ungraded")
            .setLabel("Recent Ungraded Sales")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId("recent_grade9")
            .setLabel("Recent Grade 9 Sales")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId("recent_psa10")
            .setLabel("Recent PSA 10 Sales")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
        );
        
        try {
          await interaction.editReply({ components: [disabledRow] });
        } catch (err) {
          console.error("Failed to disable buttons:", err);
        }
      });

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