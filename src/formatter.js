const bold = str => {
	return `*${str.replace(/\*+/g, match => `*${match.replace(/(.)/g, "\\$1")}*`)}*`
}

const italic = str => {
	return `_${str.replace(/_+/g, match => `_${match.replace(/(.)/g, "\\$1")}_`)}_`
}

const monospace = str => {
	return `\`${str.replace(/`+/g, match => `\`${match.replace(/(.)/g, "\\$1")}\``)}\``
}

const escape = str => {
	return str.replace(/_/g, "\\_").replace(/\*/g, "\\*").replace(/\[/g, "\\[").replace(/`/g, "\\`")
}

module.exports = {
	bold: bold,
	italic: italic,
	monospace: monospace,
	escape: escape,
}
