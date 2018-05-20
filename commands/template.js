const { createCanvas, loadImage } = require('canvas');
const parser = require("../argumentParser.js")
const request = require('request');
const path = require("path");

const templates = {};

function loadTemplate(name) {
    return new  Promise((resolve, reject)=>{
        var data = require("./templates/" + name + '.json');
        
        return Promise.all(data.images.map((imageInfo)=>{
            return Promise.all([imageInfo, loadImage(path.resolve(__dirname, 'templates', imageInfo.name))])
            .then(([info, image])=>{
                return Object.assign({}, info, {image});
            })
        }))
        .then(function (images) {
            return Object.assign({}, data, {images})
        })
        .then(function (template) {
            resolve(template)
        })
        .catch(reject)
    })
}

Promise.all([
    'sign_0',
    'sign_1',
    'sign_2'
].map(name=>loadTemplate(name)))
.then(items=>{
    for (let item of items) {
        console.log(`${item.name} loaded`);
        templates[item.name] = item;
    }
})
.catch(err=>{
    console.error(err);
})

const Info = {
    description: `Make a sticker from template`,
    usage: `/{command}@{bot_name} \\[--flags] \\[--] <template> <text>`,
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
            long: 'font',
            requireText: 'String',
            desc: "override the font"
        },
        {
            long: 'color',
            requireText: 'String',
            desc: "override the text color"
        },
    ],
    validates: [{
        type: 'Int',
        validate: (str) => /^-?[1-9]\d*$|^0$/.test(str),
        message: 'a Interger must be something matches /^-?[1-9]\\d*$|^0$/'
    }],
    abouts: [{
        name: 'template',
        postFix: 'parameter',
        get about(){ 
            return `\`template\` could be any one in \\[${Object.keys(templates).join(', ')}]`
        }
    }],
    get examples() {
        return Object.keys(templates).map((name)=>`/{command}@{bot_name} ${name} some text`)
    }
};


module.exports = function(token, botInfo, message) {
    if (!message || !message.text) {
        return false;
    }

    if (!message.text || !message.text.match(new RegExp('^\/template(@' + botInfo.username + ')?(\\s|$)', 'i'))) {
        return false;
    }

    var text = message.text.replace(new RegExp('^\/template(@' + botInfo.username + ')?\\s*', 'i'), '').replace(/^—| —/g, '--');

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
            err.message + `\nUse /template@${botInfo.username} to see more detail`, 
            { reply_to_message_id: message.message_id }
        );

        return true;
    }

    text = args.text;

    if (!text) {
        printUsages(token, botInfo, message.chat.id, { reply_to_message_id: message.message_id });
        return true;
    }

    const templateName = /^(\S+)(?:\s|$)/.exec(text) ? /^(\S+)(?:\s|$)/.exec(text)[1] : null;
    
    text = text.replace(/^(\S+)(?:\s|$)/, '');
    
    if (!templateName || !templates[templateName]) {
        return printText(
            token,
            botInfo,
            message.chat.id,
            `Unknown template ${templateName}\nUse /template@${botInfo.username} to see more detail`, 
            { reply_to_message_id: message.message_id }
        );
    }
    
    const template = templates[templateName]
    
    const fixTo = 
        template.size.width > template.size.height ?
        "width":
        "height";
    
    const realWidth = fixTo == "width" ? 512: Math.floor(template.size.width * 512 / template.size.height);
    const realHeight = fixTo == "height" ? 512: Math.floor(template.size.height * 512 / template.size.width);
    
    const WIDTH = template.size.width;
    const HEIGHT = template.size.height;
    
    const canvas = createCanvas(realWidth, realHeight),
        ctx = canvas.getContext('2d');
        
    ctx.scale(WIDTH / realWidth, HEIGHT / realHeight);
    
    const texts = text.split(/\|/g).map((text)=>
        text.replace(/^\s+|\s+$/g, '').split(/[\r\n]+/g).map((str)=>str.replace(/^\s+|\s+$/g, ''))
    );
    
    var font = flags.font || "\"Source Han Sans\"";

    if (font.match(/\s/) && !font.match(/^"/)) {
        font = '"' + font + '"';
    }
    
    function textDimension(lines, linePaddingRatio, fontSize) {
        ctx.font = fontSize + 'px ' + font;
        let longest = 0;

        lines.forEach(function(text) {
            var currentLength = ctx.measureText(text).width;
            if (currentLength > longest) longest = currentLength;
        })
        
        return {
            width: longest,
            height: (fontSize * linePaddingRatio) * (lines.length + 1) + fontSize * lines.length 
        }
    }
    
    function computeProperFontsize(width, height, lines, linePaddingRatio) {
        const upperBound = 1.1;
        const lowerBound = 0.9;
        
        let currentFontSize = height;
        let currentDimension = textDimension(lines, linePaddingRatio, height);
        
        const areaDimensionRatio = width / height;
        const textDimensionRatio = currentDimension.width / currentDimension.height;
        
        if (textDimensionRatio > areaDimensionRatio) {
            while (currentDimension.width > width * upperBound || currentDimension.width < width * lowerBound) {
                if (currentDimension.width > width) {
                    currentFontSize *= 0.5;
                } else {
                    currentFontSize *= 1.2
                }
                
                currentDimension = textDimension(lines, linePaddingRatio, currentFontSize);
            }
        } else {
            while (currentDimension.height > height * upperBound || currentDimension.height < height * lowerBound) {
                if (currentDimension.height > height) {
                    currentFontSize *= 0.8;
                } else {
                    currentFontSize *= 1.05
                }
                
                currentDimension = textDimension(lines, linePaddingRatio, currentFontSize);
            }
        }
        
        return currentFontSize;
    }
    
    // draw each image
    template.images.forEach((item)=>{
        ctx.drawImage(item.image, item.x, item.y);
    });
    
    // draw each text
    template.textAreas.forEach((area, index)=>{
        if (!texts[index]) {
            return;
        }
        
        const lines = texts[index]
        
        let fontSize = computeProperFontsize(area.size.width, area.size.height, lines, area.linePadding);
        
        if (fontSize > area.maxFontSize) {
            fontSize = area.maxFontSize;
        }
        
        const totoalHeight = lines.length * fontSize;
        const padding = (area.size.height - totoalHeight) / (lines.length + 1);
        
        ctx.save();
        ctx.translate(area.center.x, area.center.y);
        ctx.rotate(area.rotate);
        ctx.translate(-area.size.width / 2, -area.size.height / 2);
        
        
        font = flags.font || area.font ||"\"Source Han Sans\"";

        if (font.match(/\s/) && !font.match(/^"/)) {
            font = '"' + font + '"';
        }
        
        
        ctx.font = fontSize + 'px ' + font;
        ctx.fillStyle = flags.color || area.color;
        
        ctx.textAlign = "center";
        ctx.textBaseline = 'middle';
    
        lines.forEach((line, lineIndex)=>{
            // y offset relative to center
            const offset = (lineIndex - (lines.length - 1) / 2) * (fontSize + padding);
            const x = area.size.width / 2;
            const y = area.size.height / 2 + offset;
            // ctx.fillRect(0, 0, area.size.width, area.size.height)
            ctx.fillText(line, x, y);
        })
        
        ctx.restore();
    });
    
    
    var file = canvas.toBuffer();

    if (!file) {
        console.error('error during make image');
        return true;
    }
    
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
    other_args.text = parser.usage('template', botInfo.username, Info);
    other_args.disable_web_page_preview = 'true';

    request.post({
        url: 'https://api.telegram.org/bot' + token + '/sendMessage',
        formData: other_args
    }, function(err, response, body) {
        if (err) return console.error(err);

        console.log(body);
    });
}
