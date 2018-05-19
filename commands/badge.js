const Info = {
    description: `Generate a badge\nAll credits to https://shields.io/`,
    usage: `/{command}@{bot_name} \\[flags] \\[--] <left> | <right> \\[| color]`,
    flags: [{
            short: 'd',
            desc: "don't send as sticker, send as a document instead"
        },
        {
            short: 'p',
            desc: "don't send as sticker, send as a photo instead"
        },
        {
            short: 'o',
            requireText: 'Int',
            desc: "send it to another group or user instead",
            about: `The bot must be inside the group which you would like send the sticker to, otherwise this option won't work
you could get this id by the /id command`
        },
    ],
    validates: [{
        type: 'Int',
        validate: (str) => /^-?[1-9]\d*$|^0$/.test(str),
        message: 'a Interger must be something matches /^-?[1-9]\\d*$|^0$/'
    }],
    abouts: [{
        name: 'color',
        postFix: 'parameter',
        about: `please view https://shields.io/ for details
This bot also transform common css color names and #FFFFFF format to formats that shields.io accepts`
    }],
    examples: [
        '/{command}@{bot_name} left | right| green',
        '/{command}@{bot_name} girlfriend | not found | red'
    ]
};

const cssColorNames = require("css-color-names");
const { createCanvas, loadImage } = require('canvas')
const parser = require("../argumentParser.js")
const request = require('request');

module.exports = function(token, botInfo, message) {
    if (!message || !message.text) {
        return false;
    }

    if (!message.text || !message.text.match(new RegExp('^\/badge(@' + botInfo.username + ')?(\\s|$)', 'i'))) {
        return false;
    }

    var text = message.text.replace(new RegExp('^\/badge(@' + botInfo.username + ')?\\s*', 'i'), '').replace(/^—| —/g, '--');

    var args = parser.extractFlags(text);
    var flags = args.flags;

    if (flags.help != null) {
        printUsages(token, botInfo, message.chat.id, { reply_to_message_id: message.message_id });
        return true;
    }

    try {
        parser.validate(Info, flags)
    } catch (err) {
        printText(
            token,
            botInfo,
            message.chat.id,
            err.message + `\nUse /badge@${botInfo.username} to see more detail`, { reply_to_message_id: message.message_id }
        );

        return true;
    }

    text = args.text;

    if (!text) {
        printUsages(token, botInfo, message.chat.id, { reply_to_message_id: message.message_id });
        return true;
    }

    var WIDTH = 512;
    var HEIGHT = 120;
    var texts = text.split(/\|/g).map((str) => str.replace(/^\s+|\s+$/g, ''));

    if (texts.length < 2) {
        printText(
            token,
            botInfo,
            message.chat.id,
            `Bad format: missing right part\nUse /badge@${botInfo.username} to see more detail`, { reply_to_message_id: message.message_id }
        )

        return true;
    }

    let color = (texts.length >= 3 ? texts[2] : 'green').replace(/[^a-zA-Z0-9#]/g, '').toLowerCase();

    const colorEnums = [
        'brightgreen',
        'green',
        'yellowgreen',
        'yellow',
        'orange',
        'red',
        'lightgrey',
        'blue'
    ]

    if (colorEnums.indexOf(color) < 0) {
        if (/^#[a-f0-9]{6,6}$/.test(color)) {
            color = color.slice(1);
        } else if (cssColorNames[color] != null) {
            color = cssColorNames[color].slice(1);
        }
    }

    const canvas = createCanvas(WIDTH, HEIGHT),
        ctx = canvas.getContext('2d');

    const filename = encodeURIComponent(texts[0]).replace(/\-/g, '--') + '-' +
        encodeURIComponent(texts[1]).replace(/\-/g, '--') + '-' +
        encodeURIComponent(color) +
        '.svg';

    request.get({
        url: 'https://img.shields.io/badge/' + filename,
        encoding: null
    }, function(error, response, body) {
        console.log(filename);

        loadImage(body)
            .then(function(image) {
                const newHeight = 80;
                const newWidth = Math.min(newHeight / image.naturalHeight * image.naturalWidth, 480);
                image.height = newHeight;
                image.width = newWidth;

                ctx.clearRect(0, 0, WIDTH, HEIGHT);
                ctx.drawImage(image, (WIDTH - newWidth) / 2, (HEIGHT - newHeight) / 2);

                var file = canvas.toBuffer();

                if (!file) return console.error('error during make image');

                var targetId = message.chat.id;

                var additionOptions = {
                    reply_to_message_id: message.message_id
                }

                if (flags.o) {
                    targetId = parseInt(flags.o);
                    additionOptions = {};
                }

                if (flags.d) {
                    sendDocument(token, file, 'test.png', 'image/png', targetId, additionOptions)
                } else if (flags.p) {
                    sendPhoto(token, file, 'test.png', 'image/png', targetId, additionOptions)
                } else {
                    sendSticker(token, file, 'test.png', 'image/png', targetId, additionOptions)
                }
            })
            .catch(function(err) {
                printText(
                    token,
                    botInfo,
                    message.chat.id,
                    err.message, { reply_to_message_id: message.message_id }
                )
            })
    })

    return true;
}


function sendDocument(token, document, fileName, MIME, chat_id, other_args) {
    other_args = ('object' == typeof other_args) ? JSON.parse(JSON.stringify(other_args)) : {};
    other_args.chat_id = chat_id;

    other_args.document = {
        value: document,
        options: {
            filename: fileName,
            contentType: MIME
        }
    }

    request.post({
        url: 'https://api.telegram.org/bot' + token + '/sendDocument',
        formData: other_args
    }, function(err, response, body) {
        if (err) return console.error(err);

        console.log(body);
    });
}

function sendPhoto(token, photo, fileName, MIME, chat_id, other_args) {
    other_args = ('object' == typeof other_args) ? JSON.parse(JSON.stringify(other_args)) : {};
    other_args.chat_id = chat_id;

    other_args.photo = {
        value: photo,
        options: {
            filename: fileName,
            contentType: MIME
        }
    }

    request.post({
        url: 'https://api.telegram.org/bot' + token + '/sendPhoto',
        formData: other_args
    }, function(err, response, body) {
        if (err) return console.error(err);

        console.log(body);
    });
}

function sendSticker(token, sticker, fileName, MIME, chat_id, other_args) {
    other_args = ('object' == typeof other_args) ? JSON.parse(JSON.stringify(other_args)) : {};
    other_args.chat_id = chat_id;

    other_args.sticker = {
        value: sticker,
        options: {
            filename: fileName,
            contentType: MIME
        }
    }

    request.post({
        url: 'https://api.telegram.org/bot' + token + '/sendSticker',
        formData: other_args
    }, function(err, response, body) {
        if (err) return console.error(err);

        console.log(body);
    });
}


function printText(token, botInfo, chat_id, text, other_args) {
    other_args = ('object' == typeof other_args) ? JSON.parse(JSON.stringify(other_args)) : {};
    other_args.chat_id = chat_id;
    other_args.text = text;

    request.post({
        url: 'https://api.telegram.org/bot' + token + '/sendMessage',
        formData: other_args
    }, function(err, response, body) {
        if (err) return console.error(err);

        console.log(body);
    });
}

function printUsages(token, botInfo, chat_id, other_args) {
    other_args = ('object' == typeof other_args) ? JSON.parse(JSON.stringify(other_args)) : {};
    other_args.chat_id = chat_id;
    other_args.parse_mode = 'Markdown';
    other_args.text = parser.usage('badge', botInfo.username, Info);
    other_args.disable_web_page_preview = 'true';

    request.post({
        url: 'https://api.telegram.org/bot' + token + '/sendMessage',
        formData: other_args
    }, function(err, response, body) {
        if (err) return console.error(err);

        console.log(body);
    });
}
