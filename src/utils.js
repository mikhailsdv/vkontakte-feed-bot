const config = require("./config")

const getAuthUrl = () => {
	return `https://oauth.vk.com/authorize?client_id=${config.CLIENT_ID}&display=page&redirect_uri=${config.REDIRECT_URI}&scope=73730&response_type=token&v=${config.VK_API_VERSION}`
	//return "https://oauth.vk.com/authorize?&client_id=" . CLIENT_ID . "&redirect_uri=" . REDIRECT_URI . "&display=page&scope=8192&response_type=token&revoke=1&state=" . $chat_id;
}

const zeroFirst = s => `0${s}`.substr(-2)

const getDateString = () => {
	let d = new Date()
	return `${zeroFirst(d.getDate())}.${zeroFirst(d.getMonth() + 1)}.${d.getFullYear()} ${zeroFirst(
		d.getHours()
	)}:${zeroFirst(d.getMinutes())}:${zeroFirst(d.getSeconds())}`
}

const trimMessage = str => str.trim().replace(/\t+/gm, "")

const sign = s => (s >= 0 ? 1 : -1)

const buildCallbackData = (...theArgs) => theArgs.join(",")

const parseCallbackData = str => {
	const split = str.split(",")
	return {
		command: split[0],
		data: split.slice(1),
	}
}

const getTime = () => Math.ceil(new Date().valueOf() / 1000)

const kFormatter = n =>
	Math.abs(n) > 999 ? sign(n) * (Math.floor(Math.abs(n) / 100) / 10) + "k" : sign(n) * Math.abs(n)

const months = [
	"янв",
	"фев",
	"марта",
	"апр",
	"мая",
	"июня",
	"июля",
	"авг",
	"сент",
	"окт",
	"нояб",
	"дек",
]
const accessTokenRegEx = /^https:\/\/oauth.vk.com\/blank\.html#access_token=(.+?)&/
const postURLRegEx = /wall(-?\d+)_(\d+)/
const howToAuthText = `
	1. Нажмите «Авторизовать ВК»‎ и предоставьте боту доступ на чтение ленты;
	2. Скопируйте полный url из адресной строки несмотря на предупреждение;
	3. Пришлите скопированный url в этот чат.

	_Нажмите «О безопасности»‎, чтобы узнать больше о предупреждении._
`

const timestampToDate = timestamp => {
	let d = new Date(timestamp)
	return `${d.getUTCDate()} ${months[d.getUTCMonth()]} в ${d.getUTCHours()}:${zeroFirst(
		d.getUTCMinutes()
	)}`
}

const arrEnd = arr => (arr.length > 0 ? arr[arr.length - 1] : null)

const delay = d => {
	return new Promise(resolve => setTimeout(resolve, d))
}

module.exports = {
	getAuthUrl,
	zeroFirst,
	getDateString,
	trimMessage,
	sign,
	kFormatter,
	months,
	buildCallbackData,
	parseCallbackData,
	accessTokenRegEx,
	postURLRegEx,
	howToAuthText,
	getTime,
	timestampToDate,
	arrEnd,
	delay,
}
