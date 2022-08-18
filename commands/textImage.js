const { Canvas } = require('skia-canvas')
const createCanvas = (width, height) => new Canvas(width, height);
const parser = require("../argumentParser.js")
const request = require('request');

const Info = {
    description: `Generate a text sticker`,
    usage: `/{command}@{bot_name} \\[flags] \\[--] <text>`,
    flags: [{
            short: 'd',
            desc: "don't send as sticker, send as a document instead"
        },
        {
            short: 'p',
            desc: "don't send as sticker, send as a photo instead"
        },
        {
            short: 'a',
            long: 'autoHeight',
            desc: "adjust height automatically to match the line height of text"
        },
        {
            short: 'o',
            requireText: 'Int',
            desc: "send it to another group or user instead",
            about: `The bot must be inside the group which you would like send the sticker to, otherwise this option won't work
you could get this id by the /id command`
        },
        {
            long: 'width',
            requireText: 'Int',
            desc: "set the image width"
        },
        {
            long: 'height',
            requireText: 'Int',
            desc: "set the image height"
        },
        {
            long: 'font',
            requireText: 'String',
            desc: "font to use"
        },
        {
            long: 'strokeWidth',
            requireText: 'Int',
            desc: "set the stroke width"
        },
        {
            long: 'strokeColor',
            requireText: 'String',
            desc: "set the stroke color"
        },
        {
            long: 'fillColor',
            requireText: 'String',
            desc: "set the fill color, \`rainbow\` is a special color to use."
        },
        {
            long: 'lineCap',
            requireText: 'String',
            desc: "set the line cap"
        },
        {
            long: 'lineJoin',
            requireText: 'String',
            desc: "set the line join"
        },
        {
            long: 'fontSize',
            requireText: 'Int',
            desc: "set the font size. If not set, it will be decided base on the input"
        },
        {
            long: 'shadowBlur',
            requireText: 'Int',
            desc: "set the shadow blur"
        },
        {
            long: 'shadowColor',
            requireText: 'String',
            desc: "set the shadow color"
        },
    ],
    validates: [{
        type: 'Int',
        validate: (str) => /^-?[1-9]\d*$|^0$/.test(str),
        message: 'a Interger must be something matches /^-?[1-9]\\d*$|^0$/'
    }],
    abouts: [{
        name: 'String',
        postFix: 'Type',
        about: '\`String\` could be anything except space or a valid JSON string'
    }],
    examples: [
        '/{command}@{bot_name} --font="Noto Sans CJK JP" test',
        '/{command}@{bot_name} --font=monospace test'
    ]
};

module.exports = function(token, botInfo, message) {
    if (!message || !message.text) {
        return false;
    }

    if (!message.text || !message.text.match(new RegExp('^\/maketext(@' + botInfo.username + ')?(\\s|$)', 'i'))) {
        return false;
    }


    var text = message.text.replace(new RegExp('^\/maketext(@' + botInfo.username + ')?\\s*', 'i'), '').replace(/^—| —/g, '--');

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
            err.message + `\nUse /maketext@${botInfo.username} to see more detail`, { reply_to_message_id: message.message_id }
        );

        return true;
    }

    text = args.text;

    if (!text) {
        printUsages(token, botInfo, message.chat.id, { reply_to_message_id: message.message_id });
        return true;
    }


    flags.width = parser.toUnsignedInt(flags.width)
    flags.height = parser.toUnsignedInt(flags.height)
    flags.strokeWidth = parser.toUnsignedInt(flags.strokeWidth)
    flags.shadowBlur = parser.toUnsignedInt(flags.shadowBlur)

    var WIDTH = flags.width || 512;
    var HEIGHT = flags.height || 512;
    var PRESERVE_FONT_HEIGHT_RATIO = 1.2;
    var texts = text.split(/\r?\n/g);

    var autoHeight = flags.autoHeight || flags.a;

    var fillColor = flags.fillColor || 'black';
    var strokeColor = flags.strokeColor || 'white';

    var canvas = createCanvas(WIDTH, HEIGHT),
        ctx = canvas.getContext('2d');

    var fontSize = WIDTH / 2;
    var font = flags.font || "\"Noto Color Emoji\", \"Source Han Sans\"";

    if (font.match(/\s/) && !font.match(/^"/)) {
        font = '"' + font + '"';
    }

    ctx.font = fontSize + 'px ' + font;

    var longest;

    var useUserFontSize = false;

    if (!flags.fontSize || isNaN(parseInt(flags.fontSize, 10)) || parseInt(flags.fontSize, 10) <= 0) {
        while (true) {
            longest = 0;

            texts.forEach(function(text) {
                var currentLength = ctx.measureText(text).width;

                if (currentLength > longest) longest = currentLength;
            })
            // reserve some width for the shadow to expand
            if (longest > WIDTH * 0.95) {
                fontSize *= 0.9;
                fontSize = Math.floor(fontSize);
                ctx.font = fontSize + 'px ' + font;
                continue;
            }

            break;
        }

        if (fontSize * texts.length * PRESERVE_FONT_HEIGHT_RATIO > HEIGHT) {
            fontSize = Math.floor(HEIGHT / texts.length / PRESERVE_FONT_HEIGHT_RATIO);
            ctx.font = fontSize + 'px ' + font;
        }

        if (autoHeight) {
            if (fontSize * texts.length * PRESERVE_FONT_HEIGHT_RATIO < HEIGHT) {
                HEIGHT = fontSize * texts.length * PRESERVE_FONT_HEIGHT_RATIO;
                canvas.height = HEIGHT;
                console.log('changing canvas size to ' + HEIGHT + ' to match the line height fo text')
            }
        }
    } else {
        fontSize = parseInt(flags.fontSize, 10)
    }

    ctx.fillStyle = fillColor;

    ctx.strokeStyle = strokeColor;
    ctx.lineCap = flags.lineCap || 'round';
    ctx.lineJoin = flags.lineJoin || "round";

    ctx.font = fontSize + 'px ' + font;

    /* decide base on font size or user input */
    var strokeWidth = flags.strokeWidth != null ? flags.strokeWidth : fontSize / 20;
    var shadowBlur = flags.shadowBlur != null ? flags.shadowBlur : fontSize / 10;
    ctx.lineWidth = strokeWidth;

    console.log('font is ' + ctx.font);

    ctx.textAlign = "center";
    ctx.textBaseline = 'middle';


    var textCount = texts.length;

    texts.forEach(function(text, index) {
        if (strokeColor) {
            ctx.shadowBlur = shadowBlur;
            ctx.shadowColor = flags.shadowColor || "rgba(0, 0, 0, 0.7)";

            if (font.match(/noto/i)) {
                ctx.strokeText(text, WIDTH / 2, HEIGHT / textCount * (index + 0.5) - fontSize * 0.10);
            } else {
                ctx.strokeText(text, WIDTH / 2, HEIGHT / textCount * (index + 0.5));
            }

            ctx.shadowBlur = 0;
            ctx.shadowColor = "";
        }

        if (fillColor === "rainbow" || fillColor === "r") {
            ctx.fillStyle = getRainbowColor(
                ctx,
                0,
                HEIGHT / textCount * (index + 0.5) - fontSize / 2 * 0.8,
                0,
                HEIGHT / textCount * (index + 0.5) + fontSize / 2 * 0.8
            );
        }

        if (fillColor === "vertical-rainbow" || fillColor === "vr") {
            ctx.fillStyle = getRainbowColor(ctx,
                0,
                0,
                WIDTH,
                0
            );
        }
        // offset fontSize with 0.2 due of bug of noto font
        if (font.match(/noto/i)) {
            ctx.fillText(text, WIDTH / 2, HEIGHT / textCount * (index + 0.5) - fontSize * 0.10);
        } else {
            ctx.fillText(text, WIDTH / 2, HEIGHT / textCount * (index + 0.5));
        }
    })


    var file = canvas.toBufferSync();

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
    other_args.text = parser.usage('maketext', botInfo.username, Info);

    request.post({
        url: 'https://api.telegram.org/bot' + token + '/sendMessage',
        formData: other_args
    }, function(err, response, body) {
        if (err) return console.error(err);

        console.log(body);
    });
}


function getRainbowColor(ctx, offX1, offY1, offX2, offY2) {
    var gradient = ctx.createLinearGradient(offX1, offY1, offX2, offY2);
    gradient.addColorStop(0.00, 'red');
    gradient.addColorStop(1 / 6, 'orange');
    gradient.addColorStop(2 / 6, 'yellow');
    gradient.addColorStop(3 / 6, 'green')
    gradient.addColorStop(4 / 6, 'aqua');
    gradient.addColorStop(5 / 6, 'blue');
    gradient.addColorStop(1.00, 'purple');
    return gradient;
}
