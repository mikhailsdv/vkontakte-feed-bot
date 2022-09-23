const {Telegraf} = require("telegraf")
const config = require("./config")
const log = require("./log")
const {
	trimMessage,
	getAuthUrl,
	buildCallbackData,
	parseCallbackData,
	accessTokenRegEx,
	postURLRegEx,
	howToAuthText,
} = require("./utils")
const {
	isUserExist,
	isAuthed,
	isFeedRevoked,
	isFeedBlocked,
	createUser,
	activateFeed,
	pauseFeed,
	attachAccessToken,
	revokeAccessToken,
	getVkUser,
	getPostById,
	addLike,
	deleteLike,
	getUserByChatId,
} = require("./api")
const {categorizePost, sendPostToTelegram} = require("./converter")
const bot = new Telegraf(config.BOT_TOKEN)

const keyboards = {
	auth: [
		[
			{
				text: "Авторизовать ВК",
				url: getAuthUrl(),
			},
		],
	],
	authAndSecurity: [
		[
			{
				text: "Авторизовать ВК",
				url: getAuthUrl(),
			},
		],
		[
			{
				text: "О безопасности",
				callback_data: "security",
			},
		],
	],
}

const commands = {
	start: {
		hears: ["/start"],
		handler: async ctx => {
			const isUserExist_ = await isUserExist({chat_id: ctx.from.id})
			if (!isUserExist_) {
				await createUser({
					chat_id: ctx.from.id,
					username: ctx.from.username || "",
					first_name: ctx.from.first_name,
					language_code: ctx.from.language_code || "",
				})
			} else {
				const isFeedBlocked_ = await isFeedBlocked({chat_id: ctx.from.id})
				if (isFeedBlocked_) {
					await commands.restart.handler(ctx)
					return
				}

				const isFeedRevoked_ = await isFeedRevoked({chat_id: ctx.from.id})
				if (!isFeedRevoked_) {
					return ctx.reply(
						"⚠️ У вас уже есть привязанный аккаунт. Чтобы привязать другой, сперва отвяжите текущий командой /revoke."
					)
				}
			}

			await ctx.replyWithMarkdown(
				trimMessage(`
				👋 Привет! Я помогу перенести твою новостную ленту из ВК в Телеграм. Для начала нужно авторизовать вас. Вот как это сделать:
				${howToAuthText}
			`),
				{
					reply_markup: {
						inline_keyboard: keyboards.authAndSecurity,
					},
				}
			)
			log.green("start", ctx.from.id)
		},
	},
	pause: {
		hears: ["⏸ Приостановить бота", "/pause"],
		handler: async ctx => {
			const isFeedRevoked_ = await isFeedRevoked({chat_id: ctx.from.id})
			if (!isFeedRevoked_) {
				await pauseFeed({chat_id: ctx.from.id})
				await ctx.reply(
					"⏸ Работа бота временно приостановлена. Когда снова захотите возобновить ее – вызовите /restart."
				)
				log.green("pause", ctx.from.id)
			} else {
				await ctx.replyWithMarkdown(
					trimMessage(`
					🤔 Хммм... Вы еще не привязывали аккаунт. Вот как это сделать:
					${howToAuthText}
				`),
					{
						reply_markup: {
							inline_keyboard: keyboards.authAndSecurity,
						},
					}
				)
			}
		},
	},
	restart: {
		hears: ["▶️ Возобновить бота", "/restart"],
		handler: async ctx => {
			const isFeedRevoked_ = await isFeedRevoked({chat_id: ctx.from.id})
			if (!isFeedRevoked_) {
				await activateFeed({chat_id: ctx.from.id})
				await ctx.reply(
					trimMessage(`
					▶️ Работа бота возобновлена. С этого момента все новости с вашей ленты будут приходить в этот чат.

					А пока вы ждете первый пост, можете подписаться на мой канал @FilteredInternet ❤
				`)
				)
				log.green("restart", ctx.from.id)
			} else {
				await ctx.replyWithMarkdown(
					trimMessage(`
					🤔 Хммм... Вы еще не привязывали аккаунт. Вот как это сделать:
					${howToAuthText}
				`),
					{
						reply_markup: {
							inline_keyboard: keyboards.authAndSecurity,
						},
					}
				)
			}
		},
	},
	security: {
		hears: ["🔐 О безопасности", "/security"],
		handler: async ctx => {
			const message = trimMessage(`
				Если вас пугает сообщение _«Пожалуйста, не копируйте данные из адресной строки для сторонних сайтов...»_, то вот причины, по которым вы можете доверять боту и почему вы вообще должны присылать данные из адресной строки:

				1. API ВК устроены таким образом, что нет ни единого «белого» способа получить доступ к новостной ленте пользователя с сервера. Именно поэтому вы должны прислать url вручную.
				2. Вы даете доступ только к новостной ленте и списку друзей. Это минимальный набор разрешений, который нужен для работы бота.
				3. Бот не узнает ваш пароль т.к. авторизация производится по защищенному протоколу OAuth 2.0 (https://oauth.net/2/).
				4. Ваш ключ доступа хранится на защищенном сервере. Все ваши данные в полной безопасности.
				5. Вы можете полностью удалить свой ключ доступа с нашего сервера просто вызвав /revoke. Вся информация о вас будет также очищена, работа бота будет прекращена.
				6. Вы можете в любой момент отозвать ваш ключ (https://vk.com/settings?act=apps) доступа через ВК. Работа бота будет также прекращена.
			`)
			const isAuthed_ = await isAuthed({chat_id: ctx.from.id})
			if (isAuthed_) {
				await ctx.replyWithMarkdown(message)
			} else {
				await ctx.replyWithMarkdown(message, {
					reply_markup: {
						inline_keyboard: keyboards.auth,
					},
				})
			}
			log.green("security", ctx.from.id)
		},
	},
	revoke: {
		hears: ["❌ Отвязать аккаунт", "/revoke"],
		handler: async ctx => {
			const isFeedRevoked_ = await isFeedRevoked({chat_id: ctx.from.id})
			if (!isFeedRevoked_) {
				await revokeAccessToken({chat_id: ctx.from.id})
				await ctx.replyWithMarkdown(
					trimMessage(`
					✅ Аккаунт успешно отвязан. Все ваши данные удалены. Если захотите привязать аккаунт снова, вот как это сделать:
					${howToAuthText}
				`),
					{
						reply_markup: {
							inline_keyboard: keyboards.authAndSecurity,
						},
					}
				)
				log.green("revoke", ctx.from.id)
			} else {
				await ctx.replyWithMarkdown(
					trimMessage(`
					🤔 Хммм... Вы еще не привязывали аккаунт. Вот как это сделать:
					${howToAuthText}
				`),
					{
						reply_markup: {
							inline_keyboard: keyboards.authAndSecurity,
						},
					}
				)
			}
		},
	},
	donate: {
		hears: ["💸 Поддержать проект", "/donate"],
		handler: async ctx => {
			await ctx.replyWithMarkdown(
				trimMessage(`
					Проще всего задонатить здесь: babki.mishasaidov.com

					ЮMoney: \`4100117319944149\`
					QIWI: \`+77002622563\`
					BTC: \`1MDRDDBURiPEg93epMiryCdGvhEncyAbpy\`
					Kaspi 🇰🇿: \`4400 4302 1955 7599\`
				`)
			)
			log.green("donate", ctx.from.id)
		},
	},
	access_token: {
		hears: [accessTokenRegEx],
		handler: async ctx => {
			try {
				const user = await getVkUser({
					access_token: ctx.message.text.match(accessTokenRegEx)[1],
				})
				await attachAccessToken({
					chat_id: ctx.from.id,
					access_token: ctx.message.text.match(accessTokenRegEx)[1],
					first_name: user.response[0].first_name,
					last_name: user.response[0].last_name,
					user_id: user.response[0].id,
					timezone: user.response[0].timezone,
				})
				await ctx.replyWithMarkdown(
					trimMessage(`
					✅ Ваш аккаунт ВК успешно привязан. С этого момента все новости с вашей ленты будут приходить в этот чат. Рекомендую отключить уведомления.

					🔗 Вы также можете прислать мне ссылку на пост ВК, и я конвертирую его в Телеграм-сообщение.

					А пока вы ждете первый пост, можете подписаться на мой канал @FilteredInternet ❤
				`)
				)
				log.green("access_token", ctx.from.id)
			} catch (err) {
				await ctx.reply(
					"❌ Не удалось привязать аккаунт. Что-то не так с вашим токеном. Проверьте, все ли вы сделали правильно и пришлите url снова. Если проблема не исчезнет — свяжитесь со мной @mikhailsdv."
				)
				log.red("VK USER NOT FOUND", ctx.from, err)
			}
		},
	},
	post_url: {
		hears: [postURLRegEx],
		handler: async ctx => {
			const isFeedRevoked_ = await isFeedRevoked({chat_id: ctx.from.id})
			const isAuthed_ = await isAuthed({chat_id: ctx.from.id})
			if (!isFeedRevoked_ && isAuthed_) {
				const user = await getUserByChatId({chat_id: ctx.from.id})
				const match = ctx.message.text.match(postURLRegEx)
				try {
					await ctx.replyWithChatAction("typing")
					const post = await getPostById({
						access_token: user.access_token,
						owner_id: match[1],
						post_id: match[2],
					})
					if (post.response.length === 0) {
						return ctx.reply("❌ Не удалось найти пост.")
					}
					const categorizedPost = await categorizePost({
						access_token: user.access_token,
						timezone: user.timezone,
						post: post.response[0],
					})
					await sendPostToTelegram(ctx.from.id, categorizedPost)
					log.green("post_url", ctx.from.id)
				} catch (err) {
					log.red("POST BY URL ERROR", ctx.from, err)
				}
			} else {
				await ctx.replyWithMarkdown(
					trimMessage(`
					🤔 Хммм... Вы еще не привязывали аккаунт. Вот как это сделать:
					${howToAuthText}
				`),
					{
						reply_markup: {
							inline_keyboard: keyboards.authAndSecurity,
						},
					}
				)
			}
		},
	},
}

const callbackQueries = {
	like: async (ctx, data) => {
		const isAuthed_ = await isAuthed({chat_id: ctx.chat.id})
		if (isAuthed_) {
			const user = await getUserByChatId({chat_id: ctx.chat.id})
			let post = await getPostById({
				access_token: user.access_token,
				owner_id: data[0],
				post_id: data[1],
			})
			const isMessageDeletedByTelegram = ctx.callbackQuery.message.date === 0
			if (post.response.length === 1) {
				post = post.response[0]
				try {
					if (post.likes.user_likes) {
						await deleteLike({
							access_token: user.access_token,
							owner_id: data[0],
							item_id: data[1],
						})
						await ctx.answerCbQuery("Лайк убран 🖤")
						!isMessageDeletedByTelegram &&
							(await ctx.editMessageReplyMarkup({
								inline_keyboard: [
									[
										{
											text: "👁",
											url: `https://vk.com/wall${post.owner_id}_${post.id}`,
										},
										{
											text: "🖤",
											callback_data: buildCallbackData(
												"like",
												data[0],
												data[1]
											),
										},
									],
								],
							}))
					} else {
						await addLike({
							access_token: user.access_token,
							owner_id: data[0],
							item_id: data[1],
						})
						await ctx.answerCbQuery("Лайк поставлен ❤")
						!isMessageDeletedByTelegram &&
							(await ctx.editMessageReplyMarkup({
								inline_keyboard: [
									[
										{
											text: "👁",
											url: `https://vk.com/wall${post.owner_id}_${post.id}`,
										},
										{
											text: "❤",
											callback_data: buildCallbackData(
												"like",
												data[0],
												data[1]
											),
										},
									],
								],
							}))
					}
				} catch (err) {
					await ctx.answerCbQuery("❌ Не удалось поставить лайк")
					if (err?.error?.error_code === 17) {
						log.red("VK VALIDATION FAILED:", ctx.chat.id)
						await ctx.telegram.sendMessage(
							ctx.chat.id,
							trimMessage(`
									⚠ Чтобы лайки заработали, нужно обновить ваш токен. Свяжитесь со мной в случай неполадок @mikhailsdv.
									${howToAuthText}
								`),
							{
								reply_markup: {
									inline_keyboard: [
										[
											{
												text: "Авторизовать ВК",
												url: err.error.redirect_uri,
											},
										],
									],
								},
							}
						)
					} else {
						log.red("UNKNOWN ERROR: chat_id", ctx.chat.id, ctx.callbackQuery, err)
					}
				}
			} else {
				await ctx.answerCbQuery("😢 Пост не найден. Возможно, он был удален.")
			}
		} else {
			await ctx.answerCbQuery("❌ Сначала привяжите аккаунт")
		}
	},
	security: async ctx => {
		await commands.security.handler(ctx)
		await ctx.answerCbQuery()
	},
}

bot.catch((err, ctx) => {
	log.red(`Ooops, encountered an error for ${ctx.updateType}`, err)
})

Object.values(commands).forEach(command => {
	bot.hears(command.hears, command.handler)
})

bot.on("callback_query", async ctx => {
	const callbackData = parseCallbackData(ctx.callbackQuery.data)
	callbackQueries[callbackData.command] &&
		(await callbackQueries[callbackData.command](ctx, callbackData.data))
})

/*bot.command("donate", ctx => {
	console.log(`${getDateString()}: Donate`)
	return ctx.replyWithMarkdown(phrases.donate)
})

bot.command("hints", ctx => {
	console.log(`${getDateString()}: Hints`)
	return ctx.replyWithMarkdown(phrases.hints)
})

bot.on("text", async ctx => {
	const message = ctx.update.message
	const from = message.from
	
})*/

bot.launch({dropPendingUpdates: true})

/*
start - 😎 Начать
pause - ⏸ Приостановить бота
restart - ▶ Возобновить бота
revoke - ❌ Отвязать аккаунт
donate - 💸 Поддержать проект
security - 🔐 О безопасности
*/
