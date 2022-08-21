const { Canvas, loadImage } = require('skia-canvas');
const createCanvas = (width, height) => new Canvas(width, height);
const parser = require("../argumentParser.js")
const request = require('request');
const path = require("path");
const fs = require("fs");
const { processFonts } = require('../lib/constants.js');
const runes = require('runes2').runes

const templates = {};
const containsPunctuation = (c) => /[\p{Close_Punctuation}\p{Open_Punctuation}]/u.test(c)

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

fs.readdir(path.resolve(__dirname, 'templates'), function (err, files) {
    if (err) {
        return console.error(err);
    }
    
    Promise.all(
        files
            .filter((name)=>(/\.json$/).test(name))
            .map((name)=>name.replace(/\.json$/, ''))
            .map(name=>loadTemplate(name))
    )
    .then(items=>{
        for (let item of items) {
            console.log(`${item.name} loaded`);
            templates[item.name] = item;
        }
    })
    .catch(err=>{
        console.error(err);
    })
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
            long: 'preferMono',
            desc: "do not use colored emoji"
        },
        {
            long: 'font',
            requireText: 'String',
            desc: "override the font"
        },
        {
            long: 'fontStyle',
            requireText: 'String',
            desc: "override the font style \\[italic|bold]"
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
        return Object.keys(templates).map((name)=>`/{command}@{bot_name} ${name} Some Text⁉️`)
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

    if (flags.preferMono) {
        text = text.replace(/\ufe0f/g, '\ufe0e');
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
    
    var file = makeSticker(flags, text, templateName) ;

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
        sendDocument(token, file, 'document.png', 'image/png', targetId, additionOptions)
    } else if (flags.p) {
        sendPhoto(token, file, 'photo.png', 'image/png', targetId, additionOptions)
    } else {
        sendSticker(token, file, 'sticker.png', 'image/png', targetId, additionOptions)
    }

    return true;
}

module.exports.makeSticker = makeSticker;

module.exports.templates = templates

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

function skewX(ctx, radian, height) {
    ctx.transform(1, 0, Math.tan(radian), 1, (height || ctx.canvas.height) * Math.tan(-radian) / 2, 0);
}

function makeSticker(flags, text, templateName, mime = 'image/png') {
    const template = templates[templateName]
    
    const clampSize = flags.clampSize ? Number(flags.clampSize) : 512

    const fixTo = 
        template.size.width > template.size.height ?
        "width":
        "height";
    
    const realWidth = fixTo == "width" ? clampSize: Math.floor(template.size.width * clampSize / template.size.height);
    const realHeight = fixTo == "height" ? clampSize: Math.floor(template.size.height * clampSize / template.size.width);
    
    const WIDTH = template.size.width;
    const HEIGHT = template.size.height;
    
    const canvas = createCanvas(realWidth, realHeight),
        ctx = canvas.getContext('2d');

    if (mime === 'image/jpeg') {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, realWidth, realHeight)
    }
        
    ctx.scale(realWidth / WIDTH, realHeight / HEIGHT);
    
    const texts = text.split(/\|/g).map((text)=>
        text.replace(/^\s+|\s+$/g, '').split(/[\r\n]+/g).map((str)=>str.replace(/^\s+|\s+$/g, ''))
    );

    function textDimension(lines, linePaddingRatio, fontSize, font, fontStyle) {
        if (!flags.fontStyle && !fontStyle) {
            ctx.font = fontSize + 'px ' + font;
        } else {
            ctx.font = (flags.fontStyle || fontStyle) + ' ' + fontSize + 'px ' + font;
        }
        
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
    function textDimensionVertical(lines, linePaddingRatio, fontSize, font, fontStyle) {
        let longest = 0;

        lines.forEach(function(text) {
            var currentLength = fontSize * runes(text).length;
            if (currentLength > longest) longest = currentLength;
        })
        
        return {
            height: longest,
            width: (fontSize * linePaddingRatio) * (lines.length + 1) + fontSize * lines.length 
        }
    }

    function computeProperFontsize(width, height, lines, linePaddingRatio, font, fontStyle) {
        const upperBound = 1.1;
        const lowerBound = 0.9;
        
        let currentFontSize = height;
        let currentDimension = textDimension(lines, linePaddingRatio, height, font, fontStyle);
        
        const areaDimensionRatio = width / height;
        const textDimensionRatio = currentDimension.width / currentDimension.height;
        
        if (textDimensionRatio > areaDimensionRatio) {
            while (currentDimension.width > width * upperBound || currentDimension.width < width * lowerBound) {
                if (currentDimension.width > width) {
                    currentFontSize *= 0.5;
                } else {
                    currentFontSize *= 1.2
                }
                
                currentDimension = textDimension(lines, linePaddingRatio, currentFontSize, font, fontStyle);
            }
        } else {
            while (currentDimension.height > height * upperBound || currentDimension.height < height * lowerBound) {
                if (currentDimension.height > height) {
                    currentFontSize *= 0.8;
                } else {
                    currentFontSize *= 1.05
                }
                
                currentDimension = textDimension(lines, linePaddingRatio, currentFontSize, font, fontStyle);
            }
        }
        
        return currentFontSize;
    }
    
    function computeProperFontsizeVertical(width, height, lines, linePaddingRatio, font, fontStyle) {
        const upperBound = 1.1;
        const lowerBound = 0.9;
        
        let currentFontSize = height;
        let currentDimension = textDimensionVertical(lines, linePaddingRatio, height, font, fontStyle);
        
        const areaDimensionRatio = width / height;
        const textDimensionRatio = currentDimension.width / currentDimension.height;
        
        if (textDimensionRatio > areaDimensionRatio) {
            while (currentDimension.width > width * upperBound || currentDimension.width < width * lowerBound) {
                if (currentDimension.width > width) {
                    currentFontSize *= 0.5;
                } else {
                    currentFontSize *= 1.2
                }
                
                currentDimension = textDimensionVertical(lines, linePaddingRatio, currentFontSize, font, fontStyle);
            }
        } else {
            while (currentDimension.height > height * upperBound || currentDimension.height < height * lowerBound) {
                if (currentDimension.height > height) {
                    currentFontSize *= 0.8;
                } else {
                    currentFontSize *= 1.05
                }
                
                currentDimension = textDimensionVertical(lines, linePaddingRatio, currentFontSize, font, fontStyle);
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

        const areaFont =  processFonts(flags.font || area.font || "\"Source Han Sans\"", !flags.preferMono);

        const lines = texts[index]
        
        let fontSize = !area.vertical 
            ? computeProperFontsize(area.size.width, area.size.height, lines, area.linePadding, areaFont, area.fontStyle)
            : computeProperFontsizeVertical(area.size.width, area.size.height, lines, area.linePadding, areaFont, area.fontStyle);
        
        if (fontSize > area.maxFontSize) {
            fontSize = area.maxFontSize;
        }
        
        const totoalHeight = lines.length * fontSize;
        const totoalWidth = lines.length * fontSize;
        const padding = !area.vertical 
          ? (area.size.height - totoalHeight) / (lines.length + 1)
          : (area.size.width - totoalWidth) / (lines.length + 1);
        
        ctx.save();
        ctx.translate(area.center.x, area.center.y);
        ctx.rotate(area.rotate);
        ctx.translate(-area.size.width / 2, -area.size.height / 2);
        skewX(ctx, area.skewX || 0, area.size.height);
        
        if (!flags.fontStyle && !area.fontStyle) {
            ctx.font = fontSize + 'px ' + areaFont;
        } else {
            ctx.font = (flags.fontStyle || area.fontStyle)+ ' ' + fontSize + 'px ' + areaFont;
        }
        
        ctx.fillStyle = flags.color || area.color;
        
        ctx.textAlign = "center";
        ctx.textBaseline = 'middle';
    
        lines.forEach((line, lineIndex)=>{
            if (!area.vertical) {
                // y offset relative to center
                const offset = (lineIndex - (lines.length - 1) / 2) * (fontSize + padding);
                const x = area.size.width / 2;
                const y = area.size.height / 2 + offset;
                // ctx.fillRect(0, 0, area.size.width, area.size.height)
                ctx.fillText(line, x, y);
            } else {
                const offset = (lineIndex - (lines.length - 1) / 2) * (fontSize + padding);
                const chars = runes(line)
                for (const [index, char] of chars.entries()) {
                    const x = area.size.width / 2 - offset;
                    const y = area.size.height / 2 + (index - chars.length / 2 + 0.5) * fontSize;
                    if (!containsPunctuation(char)) {
                        ctx.fillText(char, x, y);
                    } else {
                        ctx.save()
                        ctx.translate(x, y)
                        ctx.rotate(Math.PI / 2)
                        ctx.translate(-x, -y)
                        ctx.fillText(char, x, y);
                        ctx.restore()
                    }
                }
            }
        })
        
        ctx.restore();
    });
    
    if (mime === 'image/jpeg') {
        var file = canvas.toBufferSync(mime, {quality: 0.75, progressive: false, chromaSubsampling: true});
    } else {
        var file = canvas.toBufferSync(mime);
    }
    file.width = realWidth
    file.height = realHeight

    return file;
}