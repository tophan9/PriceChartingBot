# 📊 Price Charting Discord Bot

A Discord bot that scrapes [PriceCharting.com](https://www.pricecharting.com) to gather **Pokémon card price data** and present it in a clean, readable format for Discord users.  

⚠️ **Disclaimer**: This project is for **personal and educational use only**. It is not affiliated with or endorsed by PriceCharting. Scraping their site may breach their Terms of Service. Please use responsibly.

---

## 🚀 Features
- Fetches Pokémon card prices from PriceCharting.  
- Displays multiple grades (Ungraded, Grade 7–9.5, PSA 10).  
- Provides interactive buttons to fetch **recent sales data**.  
- Aggregates sales into averages for easier insights.  

---

## 🛠️ Built With
- **JavaScript (Node.js)**  
- **Discord.js** – for slash commands, embeds, and buttons  
- **Puppeteer & puppeteer-extra** – for scraping  
- **Stealth Plugin** – to avoid bot detection during scraping  

---

## 📦 Installation

1. **Clone this repository**
   ```bash
   git clone https://github.com/your-username/pricecharting-discord-bot.git
   cd pricecharting-discord-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**  
   Create a `.env` file in the project root and add your Discord bot token:
   ```
   DISCORD_TOKEN=your-bot-token-here
   ```

4. **Start the bot**
   ```bash
   node deploy-commands.js
   node index.js
   ```

---

## 📖 Commands

### `/price`
Get current Pokémon card price data from PriceCharting.  

**Options (all required):**
- `set` → The set name *(e.g., "Base Set", "Evolving Skies")*  
- `card` → The card name *(e.g., "Charizard", "Pikachu VMAX")*  
- `number` → The card number *(e.g., "110", "001", "15/108")*  

**Example:**
```bash
/price set: Base Set card: Charizard number: 4
```
### `/set`
Get a descending list of current Pokémon card price data from PriceCharting.

**Options (all required):**
- `set` → The set name *(e.g., "Base Set", "Evolving Skies")*

**Example:**
```bash
/set set: Evolving SKies
```
---

## 🎛️ Buttons
After calling `/price`, the bot responds with interactive buttons:  

- **Recent Ungraded Sales** → Fetches the last 5 ungraded sales & calculates the average.  
- **Recent Grade 9 Sales** → Fetches the last 5 Grade 9 sales & calculates the average.  
- **Recent PSA 10 Sales** → Fetches the last 5 PSA 10 sales & calculates the average.  

Each result includes a list of sales and the computed average price.

---

## ⚠️ Disclaimer
This bot is intended **only for personal and educational purposes**.  
PriceCharting’s data is copyrighted, and scraping their site may violate their Terms of Service.  
Do not use this bot for commercial purposes.  

---
