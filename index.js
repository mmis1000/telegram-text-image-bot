var telegram = require('telegram-bot-api');
var Canvas = require('canvas')
var request = require('request');

var gtoken = require('./config').token;

var api = new telegram({
    token: gtoken,
    updates: {
		enabled: true
	}
});

var selfData = null;
api.getMe(function(err, data)
{
    console.log(err);
    console.log(data);
    selfData = data;
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
    var temp = text.match(/^((?:--?[a-z]+(?:=[^\s]*)?\s+)*)((?:.|[\r\n])*)$/i)
    // console.log(temp);
    var newText = temp[2].replace(/^--\s/, '');
    var flags = {};
    var temp2 = temp[1].match(/--?[a-z]+(?:=[^\s]*)?/ig)
    if (temp2) {
        temp2.forEach(function (flag) {
            var value = true;
            var hasValue = null;
            hasValue = !! flag.match(/^--?[a-z]+=/i);
            if (hasValue) {
                value = (/^--?[a-z]+=(.*)/i).exec(flag)[1];
                if (value.match(/^".*"$/)) {
                    try {
                      value = value.replace(/\\s/g, ' ');
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

api.on('message', function(message)
{
    console.log(message);
    
    if (!selfData) return;
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
        
        var WIDTH = flags.width || 512;
        var HEIGHT = flags.height || 512;
        var PRESERVE_FONT_HEIGHT_RATIO = 1.2;
        var texts = text.split(/\r?\n/g);
        
        var fillColor = flags.fillColor || 'black';
        var strokeColor = flags.strokeColor ||'white';
        var strokeWidth = flags.strokeWidth || 10;
        
        var canvas = new Canvas(WIDTH, HEIGHT)
          , ctx = canvas.getContext('2d');
        
        var fontSize = WIDTH / 2;
        var font = flags.font || 'Noto';
        ctx.fillStyle = fillColor;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
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
                if (longest > WIDTH) {
                    fontSize *= 0.9;
                    fontSize = Math.floor(fontSize);
                    ctx.font = fontSize + 'px ' + font;
                    continue;
                }
                break;
            }
            if (fontSize * texts.length * PRESERVE_FONT_HEIGHT_RATIO> HEIGHT) {
                fontSize = Math.floor(HEIGHT / texts.length / PRESERVE_FONT_HEIGHT_RATIO);
                ctx.font = fontSize + 'px ' + font;
            }
        } else {
            fontSize = parseInt(flags.fontSize, 10)
        }
        ctx.font = fontSize + 'px ' + font;
        
        console.log('font is ' + ctx.font);
        
        ctx.textAlign="center"; 
        ctx.textBaseline = 'middle';
        
        var textCount = texts.length;
        texts.forEach(function (text, index) {
            if (strokeColor) {
                ctx.strokeText(text, WIDTH / 2, HEIGHT / textCount * (index + 0.5));
            }
            ctx.fillText(text, WIDTH / 2, HEIGHT / textCount * (index + 0.5));
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
          -o=\`Int\`: send it to another group or user instead
          --width=\`Int\`: set the image width
          --height=\`Int\`: set the image height
          --font=\`String\`: set the image font
          --strokeWidth=\`Int\`: set the stroke width
          --strokeColor=\`String\`: set the stroke color
          --fillColor=\`String\`: set the fill color
          --lineCap=\`String\`: set the line cap
          --lineJoin=\`String\`: set the line join
          --fontSize=\`Int\`: set the font size. If not set, it will be decided base on the input
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