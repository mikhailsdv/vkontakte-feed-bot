# vkontakte-feed-bot

Telegram-bot that moves your VK news feed to Telegram.

## How to launch?

1. Install Node.js.
2. Install MySQL.
3. Clone this repo to your machine.
4. Create your VK **standalone-application** [here](https://vk.com/apps?act=manage). You can use logos form `src/logo` for your VK app.
5. Create your Telegram-bot via [@BotFather](https://t.me/BotFather).
6. Rename `/src/config.example.js` to `/src/config.js` and fill the necessary variables.
7. Install dependencies by running `npm i` from the root folder.
8. Import `/vkontakte_feed_bot.sql` into your MySQL database.
9. Launch the bot with the command `node src/index`.
10. Launch the worker with the command `node src/worker`.
11. Nailed it!
