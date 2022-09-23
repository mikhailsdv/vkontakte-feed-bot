module.exports = {
	CLIENT_ID: 1234567, //Your VK app's client_id.
	CLIENT_SECRET: "AbCdEfGhI", //Your VK app's client_secret.
	REDIRECT_URI: "https://oauth.vk.com/blank.html", //You probably don't need to change it.
	VK_API_VERSION: "5.103", //Don't upgrade if you don't know why.

	MYSQLI_HOST: "localhost",
	MYSQLI_USERNAME: "root",
	MYSQLI_PASSWORD: "",
	MYSQLI_DB: "vkontakte_feed_bot",

	BYPASS_DELAY: 0, //Delay in ms between bypasses.
	POSTS_COUNT: 5, //The maximum amount of posts gathering by one bypass for one user. Increase if you are going to use this bot only for yourself.
	PARALLEL_GATHERING_POSTS: 8, //Increase if you have strong internet connection.
	REQUEST_TIMEOUT: 15000,

	BOT_TOKEN: "123456789:ABCDEFGHIJK", //Your Telegram bot API token.
}
