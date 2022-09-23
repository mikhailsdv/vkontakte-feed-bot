const {performance} = require("perf_hooks")
const {Telegram} = require("telegraf")
const chopArray = require("array-chop").default
const config = require("./config")
const log = require("./log")
const {trimMessage, delay, getAuthUrl, howToAuthText} = require("./utils")
const {
	getFeeds,
	getUsersNewsfeed,
	updateLastCheckDate,
	updateLastPostDate,
	blockFeed,
	revokeAccessToken,
} = require("./api")
const {categorizePost, sendPostToTelegram} = require("./converter")
const telegramApi = new Telegram(config.BOT_TOKEN)

const walk = async () => {
	let postsTotalAmount = 0
	let timeStart = performance.now()
	const feeds = await getFeeds()
	let gatheredPosts = []
	const packs = chopArray(feeds, config.PARALLEL_GATHERING_POSTS)
	for (const [packIndex, pack] of packs.entries()) {
		log.def(`GATHERING PACKS ${packIndex + 1}/${packs.length}`)
		const parallelGathering = pack.map(
			feed =>
				// eslint-disable-next-line no-async-promise-executor
				new Promise(async resolve => {
					setTimeout(resolve, config.REQUEST_TIMEOUT)
					try {
						const newsfeed = await getUsersNewsfeed({
							access_token: feed.access_token,
							last_post_date: feed.vk_last_post_date + 1,
						}) //сначала последние новости
						postsTotalAmount += newsfeed.response.items.length
						const postsAmount = newsfeed.response.items.length
						if (postsAmount === 0) {
							log.def("NO POSTS, SKIPPED:", {
								chat_id: feed.tg_chat_id,
								amount: postsAmount,
							})
							return resolve()
						}

						await updateLastCheckDate({chat_id: feed.tg_chat_id})
						if (newsfeed.response.items.length > 0) {
							await updateLastPostDate({
								chat_id: feed.tg_chat_id,
								date: newsfeed.response.items[0].date,
							})
						}
						let posts = []
						for (const postItem of newsfeed.response.items) {
							const categorizedPost = await categorizePost({
								access_token: feed.access_token,
								timezone: feed.timezone,
								post: postItem,
							})
							posts.push(categorizedPost)
						}
						posts.reverse()

						log.def("GATHERED POSTS:", {
							chat_id: feed.tg_chat_id,
							amount: postsAmount,
						})

						resolve({
							tg_chat_id: feed.tg_chat_id,
							feed: feed,
							posts: posts,
						})
					} catch (err) {
						if (err.error) {
							switch (err.error.error_code) {
								case 38: //Unknown application: could not get application
								case 5:
									await revokeAccessToken({chat_id: feed.tg_chat_id})
									await telegramApi.sendMessage(
										feed.tg_chat_id,
										trimMessage(`
											⚠ Возникли проблемы с вашим ключом доступа. Ваша лента временно отвязана. Такое случается крайне редко, но все же случается 😢

											Чтобы бот снова мог получать посты с вашей ленты нужно авторизоваться повторно. Вот как это сделать:
											${howToAuthText}
										`),
										{
											parse_mode: "Markdown",
											reply_markup: {
												inline_keyboard: [
													[
														{
															text: "Авторизовать ВК",
															url: getAuthUrl(),
														},
													],
												],
											},
										}
									)
									log.red("VK USER AUTHORIZATION FAILED:", feed.tg_chat_id)
									break
								case 3610:
									await revokeAccessToken({chat_id: feed.tg_chat_id})
									await telegramApi.sendMessage(
										feed.tg_chat_id,
										trimMessage(`
								⚠ Вы деактивировали свою страницу ВК, либо ваша страница была удалена. Ваша лента будет отвязана.

								Чтобы бот снова мог получать посты с вашей ленты нужно авторизоваться повторно либо привязать другую страницу. Вот как это сделать:
								${howToAuthText}
							`),
										{
											parse_mode: "Markdown",
											reply_markup: {
												inline_keyboard: [
													[
														{
															text: "Авторизовать ВК",
															url: getAuthUrl(),
														},
													],
												],
											},
										}
									)
									log.red("VK USER DEACTIVATED:", feed.tg_chat_id)
									break
								default:
									log.red("UNKNOWN VK ERROR:", feed)
									log.red(err)
							}
						} else if (err.message) {
							switch (err.message) {
								case `timeout of ${config.REQUEST_TIMEOUT}ms exceeded`:
									log.red("TIMEOUT EXCEEDED:", feed.tg_chat_id)
									break
								case "getaddrinfo ENOTFOUND api.vk.com":
									log.red("NO CONNECTION:", feed.tg_chat_id)
									break
								default:
									log.red("UNKNOWN JS ERROR:", feed)
									log.red(err)
							}
						} else {
							log.red("ERROR WHIlE GATHERING:", feed)
							log.red(err)
						}
						resolve()
					}
				})
		)

		await Promise.all(parallelGathering).then(values => gatheredPosts.push(...values))
	}

	log.green("STARTING TO SEND TELEGRAM MESSAGES")

	for (const user of gatheredPosts.filter(item => item !== undefined)) {
		try {
			log.def(`SENDING ${user.posts.length} POSTS TO USER ${user.tg_chat_id}`)
			for (const post of user.posts) {
				await sendPostToTelegram(user.tg_chat_id, post)
				if (Math.random() < 0.02) {
					log.def("AD SENT TO USER:", user.tg_chat_id)
					await telegramApi.sendMessage(
						user.tg_chat_id,
						trimMessage(`
						_Реклама_

						*Ваша реклама может быть здесь* 🙃
						А пока ее нет предлагаю тебе заглянуть в мой Телеграм-канал @FilteredInternet ❤️
					`),
						{
							parse_mode: "Markdown",
							reply_markup: {
								inline_keyboard: [
									[
										{
											text: "Подписаться",
											url: "https://t.me/FilteredInternet",
										},
									],
								],
							},
						}
					)
				}
			}
		} catch (err) {
			switch (err.description) {
				case "Forbidden: bot was blocked by the user":
					await blockFeed({chat_id: user.tg_chat_id})
					log.red("BOT WAS BLOCKED BY THE USER:", user.tg_chat_id)
					break
				case "Forbidden: user is deactivated":
					await blockFeed({chat_id: user.tg_chat_id})
					log.red("TG USER IS DEACTIVATED:", user.tg_chat_id)
					break
				case "Bad Request: chat not found":
					//await blockFeed({chat_id: user.tg_chat_id})
					log.red("TG CHAT NOT FOUND:", user.tg_chat_id)
					break
				case "Bad Request: group send failed":
					log.red("TG GROUP SEND FAILED:", user.tg_chat_id)
					break
				case "Bad Request: failed to get HTTP URL content":
					log.red("TG FAILED TO GET HTTP URL CONTENT:", user.tg_chat_id)
					break
				default:
					log.red("UNKNOWN TG ERROR:", user)
					log.red(err)
			}
		}
	}

	log.green("SENT ALL:", {
		feeds: feeds.length,
		time: Math.round((performance.now() - timeStart) / 1000) + "s",
		postsTotalAmount: postsTotalAmount,
	})
	log.def(`WAITING ${config.BYPASS_DELAY / 1000}S...\n\n`)
	await delay(config.BYPASS_DELAY)
	walk()
}
walk()
