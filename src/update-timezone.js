const log = require("./log")
const {getFeedsWithAccessToken, updateTimezone, getVkUser} = require("./api")

;(async () => {
	const feeds = await getFeedsWithAccessToken()
	console.log(feeds.length)
	for (const feed of feeds) {
		log.def(`FEED ${feed.tg_chat_id}`)
		try {
			const user = await getVkUser({
				access_token: feed.access_token,
			})
			console.log(user)
			await updateTimezone({
				chat_id: feed.tg_chat_id,
				timezone: user.response[0].timezone,
			})
			log.green(`OK ${feed.tg_chat_id}`)
		} catch (err) {
			console.log(err)
		}
	}
})()
