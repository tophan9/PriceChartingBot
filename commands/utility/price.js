const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const puppeteer = require("puppeteer");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("price")
    .setDescription("Get the current price of a Pokémon card from PriceCharting")
    .addStringOption(option =>
      option.setName("set")
        .setDescription("The set name (e.g., Base Set, Evolving Skies)")
        .setRequired(true)
        /* .addChoices(
            { name: "Darkness Ablaze", value: "Darkness Ablaze" },
            { name: "Chilling Reign", value: "Chilling Reign" },
            { name: "Evolving Skies", value: "Evolving Skies" },
            { name: "Fusion Strike", value: "Fusion Strike" },
            { name: "Brilliant Stars", value: "Brilliant Stars" },
            { name: "Astral Radiance", value: "Astral Radiance" },
            { name: "Lost Origin", value: "Lost Origin" },
            { name: "Silver Tempest", value: "Silver Tempest" },
            { name: "Crown Zenith", value: "Crown Zenith" },
            { name: "Scarlet & Violet", value: "Scarlet & Violet" },
            { name: "Paldea Evolved", value: "Paldea Evolved" },
            { name: "Obsidian Flames", value: "Obsidian Flames" },
            { name: "Scarlet & Violet 151", value: "Scarlet & Violet 151" },
            { name: "Paradox Rift", value: "Paradox Rift" },
            { name: "Paldean Fates", value: "Paldean Fates" },
            { name: "Temporal Forces", value: "Temporal Forces" },
            { name: "Twilight Masquerade", value: "Twilight Masquerade" },
            { name: "Shrouded Fable", value: "Shrouded Fable" },
            { name: "Stellar Crown", value: "Stellar Crown" },
            { name: "Surging Sparks", value: "Surging Sparks" },
            { name: "Prismatic Evolutions", value: "Prismatic Evolutions" },
            { name: "Journey Together", value: "Journey Together" },
            { name: "Destined Rivals", value: "Destined Rivals" },
            
        ) */
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
    await interaction.deferReply();

    function capitalizeWords(str) {
      return str
          .toLowerCase()  // Make sure the entire string is lowercase first
          .replace(/\b\w/g, char => char.toUpperCase());  // Capitalize the first letter of each word
  }

    const setNameRaw = interaction.options.getString("set");
    const cardNameRaw = interaction.options.getString("card");
    const cardNumberRaw = interaction.options.getString("number");

    const capitalizedSetName = capitalizeWords(setNameRaw);
    const capitalizedCardName = capitalizeWords(cardNameRaw);
    const capitalizedCardNumber = cardNumberRaw;

    const formattedSetName = "pokemon-" + setNameRaw
        .replace(/[^a-z0-9\s&-]/gi, "")  // Include 'i' flag for case-insensitive
        .replace(/\s+/g, "-");          // Convert spaces to hyphens

    const formattedCardName = cardNameRaw.toLowerCase()
         .replace(/\s+/g, "-");

    const formattedCardNumber = cardNumberRaw.replace(/\//g, "-");

    const url = `https://www.pricecharting.com/game/${formattedSetName}/${formattedCardName}-${formattedCardNumber}`;
    
    console.log(`Scraping URL: ${url}`);

    try {
      const browser = await puppeteer.launch({ headless: true });
      const page = await browser.newPage();
      
      await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
      await page.goto(url, { waitUntil: "networkidle2" });

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

      if (Object.values(prices).every(price => price === "N/A")) {
        return interaction.editReply(`❌ No valid prices found for **${cardNameRaw}** #${cardNumberRaw} in **${setNameRaw}**.\n🔗 [Check manually](${url})`);
      }

      // **Create Embed**
      const embed = new EmbedBuilder()
        .setTitle(`${capitalizedCardName} #${capitalizedCardNumber} - ${capitalizedSetName}`)
        .setURL(url)
        .setColor(0xFFD700) // Gold color
        .addFields(
          { name: "🟢 Ungraded", value: prices.ungraded, inline: true },
          { name: "🔵 Grade 7", value: prices.grade7, inline: true },
          { name: "🟣 Grade 8", value: prices.grade8, inline: true },
          { name: "🟡 Grade 9", value: prices.grade9, inline: true },
          { name: "🟠 Grade 9.5", value: prices.grade9_5, inline: true },
          { name: "🔴 PSA 10", value: prices.psa10, inline: true }
        )
        .setFooter({
            text: "Data from PriceCharting | Use responsibly | By nahPkn",  // Markdown link for clickable text
            iconURL: "https://cdn.discordapp.com/attachments/926672437184176188/1354273812799029392/images.png?ex=67e4b146&is=67e35fc6&hm=86d42e96f8edb9f26730601e2172d6d06b3e46291711fa4edbfc4dba4c93afd2&"
        }).setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Scraping error:", error);
      await interaction.editReply(`❌ Could not fetch price. PriceCharting may have changed their page format.\n🔗 [Try manually](${url})`);
    }
  },
};
