var brailleMap = "⠀⠁⠂⠃⠄⠅⠆⠇⡀⡁⡂⡃⡄⡅⡆⡇⠈⠉⠊⠋⠌⠍⠎⠏⡈⡉⡊⡋⡌⡍⡎⡏⠐⠑⠒⠓⠔⠕⠖⠗⡐⡑⡒⡓⡔⡕⡖⡗⠘⠙⠚⠛⠜⠝⠞⠟⡘⡙⡚⡛⡜⡝⡞⡟⠠⠡⠢⠣⠤⠥⠦⠧⡠⡡⡢⡣⡤⡥⡦⡧⠨⠩⠪⠫⠬⠭⠮⠯⡨⡩⡪⡫⡬⡭⡮⡯⠰⠱⠲⠳⠴⠵⠶⠷⡰⡱⡲⡳⡴⡵⡶⡷⠸⠹⠺⠻⠼⠽⠾⠿⡸⡹⡺⡻⡼⡽⡾⡿⢀⢁⢂⢃⢄⢅⢆⢇⣀⣁⣂⣃⣄⣅⣆⣇⢈⢉⢊⢋⢌⢍⢎⢏⣈⣉⣊⣋⣌⣍⣎⣏⢐⢑⢒⢓⢔⢕⢖⢗⣐⣑⣒⣓⣔⣕⣖⣗⢘⢙⢚⢛⢜⢝⢞⢟⣘⣙⣚⣛⣜⣝⣞⣟⢠⢡⢢⢣⢤⢥⢦⢧⣠⣡⣢⣣⣤⣥⣦⣧⢨⢩⢪⢫⢬⢭⢮⢯⣨⣩⣪⣫⣬⣭⣮⣯⢰⢱⢲⢳⢴⢵⢶⢷⣰⣱⣲⣳⣴⣵⣶⣷⢸⢹⢺⢻⢼⢽⢾⢿⣸⣹⣺⣻⣼⣽⣾⣿".split('');

var Canvas = require('canvas')
var request = require('request');

var gtoken = require('./config').token;
/*
var api = new telegram({
    token: gtoken,
    updates: {
		enabled: true
	}
});
*/
var TGAPI = require('./tg_api')
var api = new TGAPI(gtoken)

var selfData = null;

api.on('error', console.error.bind(console));

api.getMe(function(err, data)
{
    if (err) console.error(err);
    console.log(data);
    selfData = data;
    api.startPolling(40);
});

function toUnsignedInt(input) {
    if ('number' == typeof input) {
        input = Math.floor(input);
    } else if ('string' == typeof input) {
        input = parseInt(input, 10)
    } else {
        input = '' + input;
        input = parseInt(input, 10)
    }
    if (isNaN(input)) {
        return null;
    }
    if (input < 0) {
        return null;
    }
    return input;
}

function extractFlags (text) {
    var temp = text.match(/^((?:--?[a-z]+(?:=(?:"(?:[^"\\]|\\.)+"|[^\s]*))?\s+)*)((?:.|[\r\n])*)$/i)
    // console.log(temp);
    var newText = temp[2].replace(/^--\s/, '');
    var flags = {};
    var temp2 = temp[1].match(/--?[a-z]+(?:=(?:"(?:[^"\\]|\\.)+"|[^\s]*))?/ig)
    if (temp2) {
        temp2.forEach(function (flag) {
            var value = true;
            var hasValue = null;
            hasValue = !! flag.match(/^--?[a-z]+=/i);
            if (hasValue) {
                value = (/^--?[a-z]+=(.*)/i).exec(flag)[1];
                if (value.match(/^".*"$/)) {
                    try {
                      value = JSON.parse(value) + '';
                    } catch (e) {
                        //ignore it
                    }
                }
            }
            if (!flag.match(/^--/)) {
                //simple flag
                var flagChars = flag.match(/^-([a-z]+)/i)[1];
                if (flagChars.length > 1 && hasValue) {
                    // it isn't make sense that multi flag has same value
                    return;
                }
                flagChars.split('').forEach(function(char) {
                    flags[char] = value;
                })
            } else {
                //long flag
                var flagName = flag.match(/^--([a-z]+)/i)[1];
                flags[flagName] = value;
            }
        })
    }
    return {
        flags: flags,
        text: newText
    }
}


function getRainbowColor(ctx, offX1, offY1, offX2, offY2) {
    var gradient=ctx.createLinearGradient(offX1,offY1,offX2,offY2);
    gradient.addColorStop(0.00, 'red'); 
    gradient.addColorStop(1/6, 'orange'); 
    gradient.addColorStop(2/6, 'yellow'); 
    gradient.addColorStop(3/6, 'green') 
    gradient.addColorStop(4/6, 'aqua'); 
    gradient.addColorStop(5/6, 'blue'); 
    gradient.addColorStop(1.00, 'purple');
    return gradient;
}

function getSimple(text) {
    var WIDTH = 20;
    var HEIGHT = 20;
    var i, j, k, canvas, ctx;
    
    var results = [];
    
    text = text.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]|(?:.|\r|\n)/g);
    if (text == null) return;
    
    for (i = 0; i < text.length; i++) {
        canvas = new Canvas(WIDTH, HEIGHT);
        ctx = canvas.getContext('2d');
        ctx.font = WIDTH + 'px "Source Han Sans"';
        ctx.textAlign="center"; 
        // ctx.textBaseline = 'middle';
        ctx.textBaseline = 'hanging';
        ctx.antialias = 'none';
        ctx.patternQuality = "fast";
        
        // if (text[i].charCodeAt(0) > 127) {
            // ctx.fillText(text[i], WIDTH / 2, /*HEIGHT / 2*/ -HEIGHT / 4);
        // } else {
            ctx.fillText(text[i], WIDTH / 2, /*HEIGHT / 2*/ 0);
        // }
        
        var imageData = ctx.getImageData(0, 0, WIDTH, HEIGHT);
        for (j = 0; j < HEIGHT; j++) {
            results.push([]);
            
            for (k = 0; k < WIDTH; k++) {
                var index = (j * WIDTH + k) * 4;
                
                var depth =  (1 - (imageData.data[index] + imageData.data[index + 1] + imageData.data[index + 2]) / 256 / 3)
                    * (imageData.data[index + 3] / 256)
                results[results.length - 1].push(depth > 0.5);
            }
        }
        
    }

    var finalText = (results.reduce(function (previousValue, currentValue, currentIndex) {
        if (currentIndex % 2 === 0) {
            previousValue.push(
                currentValue.map(function (val, index) {
                    return [val, results[currentIndex + 1][index]];
                })
            )
        }
        return previousValue;
    }, [])
    .map(function (val) {
        return val.map(function (val) {
            // console.log(val, val[0] * 1 + val[1] * 2)
            switch (val[0] * 1 + val[1] * 2) {
                case 0: return " ";
                case 1: return "'";
                case 2: return ".";
                case 3: return ":";
            }
        }).join('').replace(/\s+$/, '');
    })
    .join('\n'));
    
    console.log(finalText);
    return finalText;
}


function getBraille(text) {
    var WIDTH = 40;
    var HEIGHT = 40;
    var i, j, k, canvas, ctx;
    
    /**
     * @type {boolean[][]}
     */
    var results = [];
    
    text = text.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]|(?:.|\r|\n)/g);
    if (text == null) return;
    
    for (i = 0; i < text.length; i++) {
        canvas = new Canvas(WIDTH, HEIGHT);
        ctx = canvas.getContext('2d');
        ctx.font = WIDTH + 'px "Source Han Sans"';
        ctx.textAlign="center"; 
        // ctx.textBaseline = 'middle';
        ctx.textBaseline = 'hanging';
        ctx.antialias = 'none';
        ctx.patternQuality = "fast";
        
        ctx.fillText(text[i], WIDTH / 2, 0);
        
        var imageData = ctx.getImageData(0, 0, WIDTH, HEIGHT);
        for (j = 0; j < HEIGHT; j++) {
            results.push([]);
            
            for (k = 0; k < WIDTH; k++) {
                var index = (j * WIDTH + k) * 4;
                
                var depth =  (1 - (imageData.data[index] + imageData.data[index + 1] + imageData.data[index + 2]) / 256 / 3)
                    * (imageData.data[index + 3] / 256)
                results[results.length - 1].push(depth > 0.5);
            }
        }
        
    }

    var finalText = "";
    
    for (let i = 0; i < results.length; i += 4) {
        for (let j = 0; j < results[i].length; j += 2) {
            var value = 0;
            value += results[i + 0][j + 0] << 0;
            value += results[i + 1][j + 0] << 1;
            value += results[i + 2][j + 0] << 2;
            value += results[i + 3][j + 0] << 3;
            value += results[i + 0][j + 1] << 4;
            value += results[i + 1][j + 1] << 5;
            value += results[i + 2][j + 1] << 6;
            value += results[i + 3][j + 1] << 7;
            
            finalText += brailleMap[value];
        }
        finalText += '\n';
    }
    
    console.log(finalText);
    return finalText;
}

api.on('inline_query', function (query) {
    console.log(query);
    
    var text = query.query;
    
    var filtered = text.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]|(?:.|\r|\n)/g);
    if (filtered == null) return;
    
    
    api.answerInlineQuery(query.id, [{
        type: 'article',
        id: ("00000000" + (0x100000000 * Math.random()).toString(16)).slice(-8),
        title: 'Ascii Art (ascii only)',
        message_text: '```\n' + getSimple(text).replace(/^\s/, '.').replace(/\n{3,}/g, '\n\n') + '\n```',
        parse_mode: 'Markdown'
    }, {
        type: 'article',
        id: ("00000000" + (0x100000000 * Math.random()).toString(16)).slice(-8),
        title: 'Ascii Art (unicode)',
        message_text: '```\n' + getBraille(text).replace(/^\s/, '.').replace(/\n{3,}/g, '\n\n') + '\n```',
        parse_mode: 'Markdown'
    }, {
        type: 'article',
        id: ("00000000" + (0x100000000 * Math.random()).toString(16)).slice(-8),
        title: 'Ascii Art (unicode) with align fix for windows',
        message_text: '```\n' + getBraille(text).replace(/\u2800/g, '⠁').replace(/^\s/, '.').replace(/\n{3,}/g, '\n\n') + '\n```',
        parse_mode: 'Markdown'
    }], function (err, res) {
        if (err) return console.error(res);
        console.log(res);
    })
})
api.on('chosen_inline_result', function (result) {
    console.log(result);
})

api.on('message', function(message)
{
    console.log(message);
    
    // emergency patch
    // if (message.from && message.from.id === 109780439) return;
    
    if (message.text && message.text.match(new RegExp('^\/maketext(@' + selfData.username +')?(\\s|$)', 'i'))) {
        var text = message.text.replace(new RegExp('^\/maketext(@' + selfData.username +')?\\s*', 'i'), '');
        
        console.log(text)
        console.log(extractFlags(text));
        
        var args = extractFlags(text);
        var flags = args.flags;
        text = args.text;
        
        if (!text) return printUsages (message.chat.id, {reply_to_message_id: message.message_id});
        
        
        flags.width = toUnsignedInt(flags.width)
        flags.height = toUnsignedInt(flags.height)
        flags.strokeWidth = toUnsignedInt(flags.strokeWidth)
        flags.shadowBlur = toUnsignedInt(flags.shadowBlur)
        
        var WIDTH = flags.width || 512;
        var HEIGHT = flags.height || 512;
        var PRESERVE_FONT_HEIGHT_RATIO = 1.2;
        var texts = text.split(/\r?\n/g);
        
        var autoHeight = flags.autoHeight || flags.a;
        
        var fillColor = flags.fillColor || 'black';
        var strokeColor = flags.strokeColor ||'white';
        
        var canvas = new Canvas(WIDTH, HEIGHT)
          , ctx = canvas.getContext('2d');
        
        var fontSize = WIDTH / 2;
        var font = flags.font || "\"Source Han Sans\"";
        
        if (font.match(/\s/) && !font.match(/^"/)) {
            font = '"' + font + '"';
        }
        
        ctx.fillStyle = fillColor;
        
        ctx.strokeStyle = strokeColor;
        ctx.lineCap = flags.lineCap || 'round';
        ctx.lineJoin = flags.lineJoin || "round";
        
        ctx.font = fontSize + 'px ' + font;
        

        var longest;
        
        var useUserFontSize = false;
        
        if (!flags.fontSize || isNaN(parseInt(flags.fontSize, 10)) || parseInt(flags.fontSize, 10) <= 0) {
            while ( true ) {
                longest = 0;
                texts.forEach(function (text) {
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
        ctx.font = fontSize + 'px ' + font;
        
        /* decide base on font size or user input */
        var strokeWidth = flags.strokeWidth != null ? flags.strokeWidth : fontSize / 20;
        var shadowBlur = flags.shadowBlur != null ? flags.shadowBlur : fontSize / 10;
        ctx.lineWidth = strokeWidth;
        
        console.log('font is ' + ctx.font);
        
        ctx.textAlign="center"; 
        ctx.textBaseline = 'middle';
        
        
        var textCount = texts.length;
        texts.forEach(function (text, index) {
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
                ctx.fillStyle = getRainbowColor(
                    ctx, 
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
        
        
        var file = canvas.toBuffer();
        
        if (!file) return console.error('error during make image');
        
        var targetId =message.chat.id;
        var additionOptions = {
            reply_to_message_id: message.message_id
        }
        
        if (flags.o) {
            targetId = parseInt(flags.o);
            additionOptions= {};
        }
        
        if (flags.d) {
            sendDocument (file, 'test.png', 'image/png', targetId, additionOptions)
        } else if (flags.p) {
            sendPhoto (file, 'test.png', 'image/png', targetId, additionOptions)
        } else {
            sendSticker (file, 'test.png', 'image/png', targetId, additionOptions)
        }
    }
    
    if (message.text && message.text.match(new RegExp('^\/id(@' + selfData.username + ')?$', 'i'))) {
        request.post(
        {
            url:'https://api.telegram.org/bot' + gtoken + '/sendMessage', 
            formData: {
                reply_to_message_id: message.message_id,
                chat_id: message.chat.id,
                text: "" + message.chat.id
            }
        }
        , 
        function (err, response, body) {
            if (err) return console.error(err);
            console.log(body);
        });
    }
});

function sendDocument (document, fileName, MIME, chat_id, other_args) {
    other_args = ('object' == typeof other_args) ? JSON.parse(JSON.stringify(other_args)) : {};
    other_args.chat_id = chat_id;
    other_args.document = {
        value:  document,
        options: {
          filename: fileName,
          contentType: MIME
        }
    }
    request.post(
        {
            url:'https://api.telegram.org/bot' + gtoken + '/sendDocument', 
            formData: other_args
        }
    , function (err, response, body) {
        if (err) return console.error(err);
        console.log(body);
    });
}

function sendPhoto (photo, fileName, MIME, chat_id, other_args) {
    other_args = ('object' == typeof other_args) ? JSON.parse(JSON.stringify(other_args)) : {};
    other_args.chat_id = chat_id;
    other_args.photo = {
        value:  photo,
        options: {
          filename: fileName,
          contentType: MIME
        }
    }
    request.post(
        {
            url:'https://api.telegram.org/bot' + gtoken + '/sendPhoto', 
            formData: other_args
        }
    , function (err, response, body) {
        if (err) return console.error(err);
        console.log(body);
    });
}

function sendSticker (sticker, fileName, MIME, chat_id, other_args) {
    other_args = ('object' == typeof other_args) ? JSON.parse(JSON.stringify(other_args)) : {};
    other_args.chat_id = chat_id;
    other_args.sticker = {
        value:  sticker,
        options: {
          filename: fileName,
          contentType: MIME
        }
    }
    request.post(
        {
            url:'https://api.telegram.org/bot' + gtoken + '/sendSticker', 
            formData: other_args
        }
    , function (err, response, body) {
        if (err) return console.error(err);
        console.log(body);
    });
}

function printUsages (chat_id, other_args) {
    other_args = ('object' == typeof other_args) ? JSON.parse(JSON.stringify(other_args)) : {};
    other_args.chat_id = chat_id;
    other_args.parse_mode = 'Markdown';
    other_args.text = `
generate a text sticker
usage: {command} \\[flags] \\[--] <text>
flags:
  -d: don't send as sticker, send as a document instead
  -p: don't send as sticker, send as a photo instead
  -a, --autoHeight: adjust height automatically to match the line height of text
  -o=\`Int\`: send it to another group or user instead
  --width=\`Int\`: set the image width
  --height=\`Int\`: set the image height
  --font=\`String\`: set the image font
  --strokeWidth=\`Int\`: set the stroke width
  --strokeColor=\`String\`: set the stroke color
  --fillColor=\`String\`: set the fill color, \`rainbow\` is a special color to use.
  --lineCap=\`String\`: set the line cap
  --lineJoin=\`String\`: set the line join
  --fontSize=\`Int\`: set the font size. If not set, it will be decided base on the input
  --shadowBlur=\`Int\`: set the shadow blur
  --shadowColor=\`String\`: set the shadow color
----------------
About the \`-o\` options

The bot must be inside the group which you would like send the sticker to, otherwise this option won't work
you could get this id by the /id command

About \`String\`

\`String\` could be anything except space or a JSON string
ex: 
/maketext@${selfData.username.replace(/_/g, '\\_')} --font="Noto Sans CJK JP" test
/maketext@${selfData.username.replace(/_/g, '\\_')} --font=monospace test
    `;
    request.post(
        {
            url:'https://api.telegram.org/bot' + gtoken + '/sendMessage', 
            formData: other_args
        }
    , function (err, response, body) {
        if (err) return console.error(err);
        console.log(body);
    });
}