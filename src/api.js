const config = require("./config")
const {stringify} = require("querystring")
const DB = require("./db")
const axios = require("axios")
const {getTime} = require("./utils")
const {Telegram} = require("telegraf")
const telegramApi = new Telegram(config.BOT_TOKEN)

const vkApi = async (method, params) => {
	const {data} = await axios({
		url: `https://api.vk.com/method/${method}`,
		method: "post",
		data: stringify({
			v: config.VK_API_VERSION,
			...params,
		}),
		timeout: config.REQUEST_TIMEOUT,
	})
	if (data.error) {
		throw data
	}
	return data
}

const getUserByChatId = async ({chat_id}) => {
	const user = await DB.select({
		table: "feeds",
		columns: [
			"id",
			"tg_chat_id",
			"tg_first_name",
			"tg_username",
			"tg_language_code",
			"vk_id",
			"vk_first_name",
			"vk_last_name",
			"vk_last_post_date",
			"last_check_date",
			"registration_date",
			"status",
			"access_token",
		],
		where: {
			tg_chat_id: chat_id,
		},
	})
	return user[0]
}

const isUserExist = ({chat_id}) => {
	return DB.has({
		table: "feeds",
		where: {
			tg_chat_id: chat_id,
		},
	})
}

const isFeedRevoked = ({chat_id}) => {
	return DB.has({
		table: "feeds",
		where: {
			tg_chat_id: chat_id,
			status: "revoked",
		},
	})
}

const isFeedBlocked = ({chat_id}) => {
	return DB.has({
		table: "feeds",
		where: {
			tg_chat_id: chat_id,
			status: "blocked",
		},
	})
}

const isAuthed = ({chat_id}) => {
	return DB.has({
		table: "feeds",
		where: {
			tg_chat_id: chat_id,
			"access_token[!=]": "",
			"status[!=]": "revoked",
		},
	})
}

const createUser = ({chat_id, username, first_name, language_code}) => {
	return DB.insert({
		table: "feeds",
		columns: {
			tg_chat_id: chat_id,
			tg_username: username,
			tg_first_name: first_name,
			tg_language_code: language_code,
			status: "waiting_token",
		},
	})
}

const pauseFeed = ({chat_id}) => {
	return DB.update({
		table: "feeds",
		columns: {
			status: "paused",
		},
		where: {
			tg_chat_id: chat_id,
		},
	})
}

const blockFeed = ({chat_id}) => {
	return DB.update({
		table: "feeds",
		columns: {
			status: "blocked",
		},
		where: {
			tg_chat_id: chat_id,
		},
	})
}

const activateFeed = ({chat_id}) => {
	return DB.update({
		table: "feeds",
		columns: {
			status: "active",
		},
		where: {
			tg_chat_id: chat_id,
		},
	})
}

const attachAccessToken = ({chat_id, first_name, last_name, user_id, timezone, access_token}) => {
	return DB.update({
		table: "feeds",
		columns: {
			access_token,
			vk_first_name: first_name,
			vk_last_name: last_name,
			vk_id: user_id,
			status: "active",
			timezone,
			vk_last_post_date: getTime(),
		},
		where: {
			tg_chat_id: chat_id,
		},
	})
}

const revokeAccessToken = ({chat_id}) => {
	return DB.update({
		table: "feeds",
		columns: {
			status: "revoked",
		},
		where: {
			tg_chat_id: chat_id,
		},
	})
}

const updateLastCheckDate = ({chat_id}) => {
	return DB.update({
		table: "feeds",
		columns: {
			last_check_date: getTime(),
		},
		where: {
			tg_chat_id: chat_id,
		},
	})
}

const updateLastPostDate = ({chat_id, date}) => {
	return DB.update({
		table: "feeds",
		columns: {
			vk_last_post_date: date,
		},
		where: {
			tg_chat_id: chat_id,
		},
	})
}

const updateTimezone = ({chat_id, timezone}) => {
	return DB.update({
		table: "feeds",
		columns: {
			timezone,
		},
		where: {
			tg_chat_id: chat_id,
		},
	})
}

const getFeedsWithAccessToken = () => {
	return DB.select({
		table: "feeds",
		columns: ["id", "tg_chat_id", "access_token", "timezone", "vk_last_post_date"],
		where: {
			"access_token[!=]": "",
		},
	})
}

const getFeeds = () => {
	return DB.select({
		table: "feeds",
		columns: ["id", "tg_chat_id", "access_token", "timezone", "vk_last_post_date"],
		where: {
			"access_token[!=]": "",
			status: "active",
		},
	})
}

const getVkUser = async ({access_token, user_id}) => {
	let params = {
		access_token,
		fields: "timezone",
	}
	user_id && (params.user_ids = user_id)
	return vkApi("users.get", params)
}

const getGroupById = async ({access_token, group_id}) => {
	return vkApi("groups.getById", {
		access_token,
		group_id,
	})
}

const getUsersNewsfeed = async ({access_token, last_post_date}) => {
	return vkApi("newsfeed.get", {
		access_token,
		filters: "post",
		return_banned: 0,
		count: config.POSTS_COUNT,
		start_time: last_post_date + 1,
	})
}

const getPostById = async ({access_token, owner_id, post_id}) => {
	return vkApi("wall.getById", {
		access_token,
		posts: `${owner_id}_${post_id}`,
	})
}

const addLike = async ({access_token, owner_id, item_id}) => {
	return vkApi("likes.add", {
		access_token,
		owner_id,
		item_id,
		type: "post",
	})
}

const deleteLike = async ({access_token, owner_id, item_id}) => {
	return vkApi("likes.delete", {
		access_token,
		owner_id,
		item_id,
		type: "post",
	})
}

const editMessageKeyboard = async ({chat_id, message_id, reply_markup}) => {
	return telegramApi.editMessageReplyMarkup(chat_id, message_id, null, reply_markup)
}

module.exports = {
	isUserExist,
	isAuthed,
	isFeedRevoked,
	isFeedBlocked,
	createUser,
	pauseFeed,
	blockFeed,
	activateFeed,
	attachAccessToken,
	revokeAccessToken,
	getVkUser,
	getFeeds,
	getUsersNewsfeed,
	updateLastCheckDate,
	getGroupById,
	updateLastPostDate,
	getPostById,
	addLike,
	deleteLike,
	getUserByChatId,
	editMessageKeyboard,
	getFeedsWithAccessToken,
	updateTimezone,
}
