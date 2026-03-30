const cssColorNames = require("css-color-names");
const { chromium } = require('playwright');
const parser = require("../argumentParser.js")
const request = require('request');

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
        {
            short: 's',
            desc: "send the raw SVG file without converting to PNG"
        },
        {
            short: 'u',
            desc: "return the shields.io URL as text without rendering"
        },
        {
            long: 'logo',
            requireText: 'String',
            desc: "logo to display: SimpleIcons name (e.g. javascript), emoji (e.g. 🚀), or base64 data URL (data:image/...;base64,...)"
        },
        {
            long: 'logocolor',
            requireText: 'String',
            desc: "logo color: hex (#ffffff or ffffff) or css color name. alias: logo-color"
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
    }, {
        name: 'inline',
        postFix: 'mode',
        about: `you could also use this in inline mode just like:
@{bot_name} left | right| green;
notice: you must add a \`;\` at line end, or it will be ignored`
    }],
    examples: [
        '/{command}@{bot_name} left | right| green',
        '/{command}@{bot_name} -d girlfriend | not found | red',
        '/{command}@{bot_name} -p girlfriend | not found | blue',
        '/{command}@{bot_name} escape | sequence \\\\\\|',
        '/{command}@{bot_name} --logo=javascript node | v20 | green',
        '/{command}@{bot_name} --logo=javascript --logocolor=white node | v20 | green',
        '/{command}@{bot_name} --logo=🚀 rocket | launch | blue',
        '/{command}@{bot_name} --logo=✨ vibes | immaculate | ff69b4'
    ]
};

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
    
    var texts = text.match(/\\\||\\\\|./g).reduce((prev, curr)=>{
        if (curr === '|') {
            prev.push('');
        } else if (curr.length === 2) {
            prev[prev.length - 1] += curr[1]
        } else {
            prev[prev.length - 1] += curr
        }
        
        return prev;
    }, ['']).map((str) => str.replace(/^\s+|\s+$/g, ''));
    
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

    const filename = encodeURIComponent(texts[0]).replace(/\-/g, '--') + '-' +
        encodeURIComponent(texts[1]).replace(/\-/g, '--') + '-' +
        encodeURIComponent(color) +
        '.svg';

    const safeFilename = (texts[0] + '-' + texts[1]).replace(/[^a-zA-Z0-9_\-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'badge';

    const promise = buildBadgeUrl(filename, flags.logo || null, flags.logocolor || null)
        .then(svgUrl => {
            if (flags.u) return svgUrl;
            return flags.s ? fetchSvg(svgUrl) : makeBadge(svgUrl);
        });

    promise.then(function (file){
        var targetId = message.chat.id;

        var additionOptions = {
            reply_to_message_id: message.message_id
        }

        if (flags.o) {
            targetId = parseInt(flags.o);
            additionOptions = {};
        }

        if (flags.u) {
            printText(token, botInfo, targetId, file, additionOptions)
        } else if (flags.s) {
            sendDocument(token, file, safeFilename + '.svg', 'image/svg+xml', targetId, additionOptions)
        } else if (flags.d) {
            sendDocument(token, file, safeFilename + '.png', 'image/png', targetId, additionOptions)
        } else if (flags.p) {
            sendPhoto(token, file, safeFilename + '.png', 'image/png', targetId, additionOptions)
        } else {
            sendSticker(token, file, safeFilename + '.png', 'image/png', targetId, additionOptions)
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

    return true;
}

module.exports.makeBadge = makeBadge;

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

    request.post({ agentOptions: { family: 4 },
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

    request.post({ agentOptions: { family: 4 },
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

    request.post({ agentOptions: { family: 4 },
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

    request.post({ agentOptions: { family: 4 },
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

    request.post({ agentOptions: { family: 4 },
        url: 'https://api.telegram.org/bot' + token + '/sendMessage',
        formData: other_args
    }, function(err, response, body) {
        if (err) return console.error(err);

        console.log(body);
    });
}

function isEmoji(str) {
    // If it's a plain ASCII slug (SimpleIcons name) or a data URL, it's not an emoji
    return !/^[a-zA-Z0-9_-]+$/.test(str) && !str.startsWith('data:');
}

async function emojiToDataUrl(emoji) {
    const path = require('path');
    const fontPath = path.resolve(__dirname, '../NotoColorEmoji.ttf');
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        await page.setViewportSize({ width: 64, height: 64 });
        await page.setContent(`<!DOCTYPE html>
<html>
<head>
<style>
@font-face {
    font-family: 'NotoColorEmoji';
    src: url('file://${fontPath}');
}
html, body {
    margin: 0; padding: 0;
    width: 64px; height: 64px;
    overflow: hidden;
    background: transparent;
    display: flex; align-items: center; justify-content: center;
}
span {
    font-family: 'NotoColorEmoji', sans-serif;
    font-size: 56px;
    line-height: 1;
}
</style>
</head>
<body><span id="e">${emoji}</span></body>
</html>`);
        await page.waitForFunction(() => document.fonts.ready).catch(() => {});
        const buffer = await page.screenshot({ type: 'png', omitBackground: true });
        return 'data:image/png;base64,' + buffer.toString('base64');
    } finally {
        await browser.close();
    }
}

async function buildBadgeUrl(filename, logo, logoColor) {
    let queryParams = '';
    if (logo) {
        let logoValue = logo;
        if (isEmoji(logo)) {
            logoValue = await emojiToDataUrl(logo);
        }
        queryParams += '?logo=' + encodeURIComponent(logoValue);
        if (logoColor) {
            let lc = logoColor.replace(/^\s+|\s+$/g, '');
            if (/^#[a-f0-9]{3,8}$/i.test(lc)) {
                lc = lc.slice(1);
            } else if (cssColorNames[lc.toLowerCase()] != null) {
                lc = cssColorNames[lc.toLowerCase()].slice(1);
            }
            queryParams += '&logoColor=' + encodeURIComponent(lc);
        }
    }
    return 'https://img.shields.io/badge/' + filename + queryParams;
}

function fetchSvg(url) {
    return new Promise((resolve, reject) => {
        request.get({ url, encoding: null }, function(error, _response, body) {
            console.log(url);
            if (error) return reject(error);
            resolve(body);
        });
    });
}

async function makeBadge(url) {
    console.log(url);
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        await page.setViewportSize({ width: 512, height: 120 });
        await page.setContent(`<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:transparent;display:flex;align-items:center;justify-content:center;width:512px;height:120px;">
<img id="badge" src="${url}" style="height:80px;max-width:480px;">
</body>
</html>`);
        await page.waitForFunction(() => {
            const img = document.getElementById('badge');
            return img && img.complete && img.naturalWidth > 0;
        }, { timeout: 10000 }).catch(() => page.waitForTimeout(3000));
        const buffer = await page.screenshot({ type: 'png', omitBackground: true });
        return buffer;
    } finally {
        await browser.close();
    }
}