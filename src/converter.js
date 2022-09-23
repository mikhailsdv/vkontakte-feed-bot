const config = require("./config")
const formatter = require("./formatter")
const {Telegram} = require("telegraf")
const {buildCallbackData, timestampToDate, arrEnd, trimMessage} = require("./utils")
const {getGroupById, getVkUser} = require("./api")
const telegramApi = new Telegram(config.BOT_TOKEN)

const categorizePost = async ({access_token, timezone = 0, post: originalPost}) => {
	const postId = {
		id: originalPost.post_id || originalPost.id,
		owner_id: originalPost.source_id || originalPost.owner_id,
	}
	let post = {
		...postId,
		text: originalPost.text,
		photos: [],
		author: "",
		//date: timestampToDate(originalPost.date * 1000),
		date: timestampToDate(originalPost.date * 1000 + timezone * 1000 * 60 * 60),
		url: `https://vk.com/wall${postId.owner_id}_${postId.id}`,
		audio: [],
		video: [],
		docs: [],
		animations: [],
		likes: originalPost.likes,
	}

	if (post.owner_id < 0) {
		//group
		const group = await getGroupById({
			access_token: access_token,
			group_id: post.owner_id * -1,
		})
		post.author = group.response[0].name
	} else if (post.owner_id > 0) {
		//user
		const user = await getVkUser({
			access_token: access_token,
			user_id: post.owner_id,
		})
		post.author = `${user.response[0].first_name} ${user.response[0].last_name}`
	}

	if (originalPost.attachments && originalPost.attachments.length > 0) {
		originalPost.attachments.forEach(attachment => {
			if (attachment.type === "photo") {
				post.photos.push(arrEnd(attachment.photo.sizes).url)
			} else if (attachment.type === "posted_photo") {
				post.photos.push(attachment.posted_photo.photo_604)
			} else if (attachment.type === "doc") {
				if (attachment.doc.size <= 52428800) {
					if (attachment.doc.type === 3) {
						post.animations.push({
							url: attachment.doc.url,
							//"caption" => mb_substr($value["doc"]["title"], 0, 1000),//1024
						})
					} else {
						post.docs.push({
							url: attachment.doc.url,
							caption: attachment.doc.title.substr(0, 1024),
						})
					}
				}
			} else if (attachment.type === "audio") {
				post.audio.push({
					//"chat_id"	=> $feed["chat_id"],
					//"audio" 	=> $value["audio"]["url"],
					duration: attachment.audio.duration,
					performer: attachment.audio.artist,
					title: attachment.audio.title,
				})
			} else if (attachment.type === "video") {
				post.video.push({
					url: `https://vk.com/video${attachment.video.owner_id}_${attachment.video.id}`,
					title: attachment.video.title,
				})
			}
		})
	}

	return post
}

const sendPostToTelegram = async (tg_chat_id, post) => {
	let messageParams = {
		parse_mode: "Markdown",
		reply_markup: {
			inline_keyboard: [
				[
					{
						text: "👁",
						url: post.url,
					},
					{
						text: ["🖤", "❤"][post.likes.user_likes],
						callback_data: buildCallbackData("like", post.owner_id, post.id),
					},
				],
			],
		},
	}

	//with link in time $text = "<b>" . $post["author"] . "</b>\n<a href='" . $post["url"] . "'>" . $post["date"] . "</a>\n\n" . $post["text"];
	let text = trimMessage(`
		${formatter.bold(post.author)}
		${post.date}

		${
			post.text
				? formatter
						.escape(post.text)
						.replace(/\\\[([a-z]+\d+)\|(.+?)\]/gm, "[$2](https://vk.com/$1)")
						.replace(/@([a-z]+\d+)\s\((.+?)\)/gm, "[$2](https://vk.com/$1)")
						.replace(/\\\[https?:\/\/vk\.com(.*?)\|(.+?)\]/gm, "[$2](https://vk.com$1)")
				: ""
		}
	`)

	if (post.video.length > 0) {
		text += "\n"
		post.video.forEach(video => {
			text += `\n[🎥 ${formatter.escape(video.title)}](${video.url})`
			//$text .= "\n" . $url;
		})
	}

	if (post.audio.length > 0) {
		text += "\n"
		post.audio.forEach(audio => {
			text += `\n🎵 ${formatter.bold(audio.title)} – ${audio.performer}`
		})
	}

	//if (!empty($post["audio"])) {
	//	foreach ($post["audio"] as $index => $audio) {
	//		$telegram->sendPAudio($audio);
	//	}
	//}

	if (post.animations.length > 0) {
		for (const animation of post.animations) {
			// eslint-disable-next-line no-unused-vars
			const {url, ...rest} = animation
			await telegramApi.sendAnimation(tg_chat_id, animation.url, rest)
		}
	}

	if (post.docs.length > 0) {
		//можно переписать на медиа группу
		for (const doc of post.docs) {
			// eslint-disable-next-line no-unused-vars
			const {url, ...rest} = doc
			await telegramApi.sendDocument(tg_chat_id, doc.url, rest)
		}
	}

	if (post.photos.length > 0) {
		text = text.substr(0, 4096)
		if (post.photos.length === 1) {
			if (text.length <= 1024) {
				await telegramApi.sendPhoto(tg_chat_id, post.photos[0], {
					caption: text,
					...messageParams,
				})
			} else {
				const message = await telegramApi.sendPhoto(tg_chat_id, post.photos[0])
				messageParams.reply_to_message_id = message.message_id
				await telegramApi.sendMessage(tg_chat_id, text, messageParams)
			}
		} else if (post.photos.length > 1) {
			let media = post.photos.map(url => ({
				type: "photo",
				media: url,
			}))
			const message = await telegramApi.sendMediaGroup(tg_chat_id, media)
			messageParams.reply_to_message_id = message[0].message_id
			await telegramApi.sendMessage(tg_chat_id, text, messageParams)
		}
	} else {
		await telegramApi.sendMessage(tg_chat_id, text, messageParams)
	}
}

module.exports = {
	categorizePost,
	sendPostToTelegram,
}
