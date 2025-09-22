const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const puppeteer = require("puppeteer");
const puppeteerExtra = require("puppeteer-extra");
const pluginStealth = require("puppeteer-extra-plugin-stealth");

const axios = require("axios");
const cheerio = require("cheerio");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("set")
        .setDescription("Get information about Pokémon cards from a set on PriceCharting")
        .addStringOption(option =>
            option.setName("set")
                .setDescription("The set name (e.g., Base Set, Evolving Skies)")
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        function capitalizeWords(str) {
            return str
                .toLowerCase()
                .replace(/\b\w/g, char => char.toUpperCase());
        }

        const setNameRaw = interaction.options.getString("set");
        const capitalizedSetName = capitalizeWords(setNameRaw);

        const formattedSetName = "pokemon-" + setNameRaw
            .replace(/[^a-z0-9\s&-]/gi, "") // Remove special characters except spaces, ampersands, and hyphens
            .replace(/\s+/g, "-");

        const url = `https://www.pricecharting.com/console/${formattedSetName}?sort=highest-price`;
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
                ], // Pi-specific settings for better performance
                executablePath: '/usr/bin/chromium-browser', // Use Chromium installed on the Pi
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
            await page.goto(url, { waitUntil: "domcontentloaded" });

            const prices = await page.evaluate(() => {
                const rows = document.querySelectorAll("table tr");
                const items = [];

                rows.forEach(row => {
                    const cols = row.querySelectorAll("td");
                    if (cols.length >= 4) {
                        const itemName = cols[1].innerText.trim();
                        const ungradedPrice = cols[2].innerText.trim() || "N/A";
                        const grade9Price = cols[3].innerText.trim() || "N/A";
                        const psa10Price = cols[4].innerText.trim() || "N/A";

                        items.push({
                            itemName,
                            ungradedPrice,
                            grade9Price,
                            psa10Price
                        });
                    }
                });

                return items;
            });

            // If no valid items were found, send a reply with a manual check link
            if (prices.length === 0) {
                return interaction.editReply(`❌ No valid prices found for **${setNameRaw}**.\n🔗 [Check manually](${url})`);
            }

            await browser.close();

            // Pagination logic
            const itemsPerPage = 6; // Number of items per page
            let currentPage = 0; // Start at the first page

            // Function to generate the embed and buttons for the current page
            function generateEmbedAndButtons(prices, currentPage) {
                const startIndex = currentPage * itemsPerPage;
                const endIndex = startIndex + itemsPerPage;
                const fields = prices.slice(startIndex, endIndex).map(item => ({
                    name: item.itemName,
                    value: `🟢 Ungraded: ${item.ungradedPrice}\n🟡 Grade 9: ${item.grade9Price}\n🔴 PSA 10: ${item.psa10Price}`,
                    inline: true
                }));

                const embed = new EmbedBuilder()
                    .setTitle(`Prices for ${capitalizedSetName} (Page ${currentPage + 1}/${Math.ceil(prices.length / itemsPerPage)})`)
                    .setURL(url)
                    .setColor(0xFFD700)
                    .addFields(fields)
                    .setFooter({
                        text: "Data from PriceCharting | Use responsibly | By nahPkn",
                        iconURL: "https://cdn.discordapp.com/attachments/926672437184176188/1354273812799029392/images.png?ex=67e4b146&is=67e35fc6&hm=86d42e96f8edb9f26730601e2172d6d06b3e46291711fa4edbfc4dba4c93afd2&"
                    })
                    .setTimestamp();

                const actionRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("previous_page")
                        .setLabel("Previous")
                        .setStyle(ButtonStyle.Primary) // Use ButtonStyle.Primary
                        .setDisabled(currentPage === 0), // Disable if on the first page
                    new ButtonBuilder()
                        .setCustomId("next_page")
                        .setLabel("Next")
                        .setStyle(ButtonStyle.Primary) // Use ButtonStyle.Primary
                        .setDisabled(endIndex >= prices.length) // Disable if on the last page
                );

                return { embed, actionRow };
            }

            // Generate the initial embed and buttons
            const { embed, actionRow } = generateEmbedAndButtons(prices, currentPage);
            await interaction.editReply({ embeds: [embed], components: [actionRow] });

            // Handle button interactions
            const filter = i => ["previous_page", "next_page"].includes(i.customId) && i.user.id === interaction.user.id;
            const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

            collector.on("collect", async i => {
                if (i.customId === "previous_page") {
                    currentPage = Math.max(currentPage - 1, 0); // Go to the previous page
                } else if (i.customId === "next_page") {
                    currentPage = Math.min(currentPage + 1, Math.ceil(prices.length / itemsPerPage) - 1); // Go to the next page
                }

                const { embed, actionRow } = generateEmbedAndButtons(prices, currentPage);
                await i.update({ embeds: [embed], components: [actionRow] });
            });

            collector.on("end", async () => {
                await interaction.editReply({ components: [] }); // Remove buttons after timeout
            });
        } catch (error) {
            console.error("Error during scraping:", error);
            await interaction.editReply(`❌ Could not fetch price. PriceCharting may have changed their page format.\n🔗 [Try manually](${url})`);
        }
    },
};