var brailleMap = "⠀⠁⠂⠃⠄⠅⠆⠇⡀⡁⡂⡃⡄⡅⡆⡇⠈⠉⠊⠋⠌⠍⠎⠏⡈⡉⡊⡋⡌⡍⡎⡏⠐⠑⠒⠓⠔⠕⠖⠗⡐⡑⡒⡓⡔⡕⡖⡗⠘⠙⠚⠛⠜⠝⠞⠟⡘⡙⡚⡛⡜⡝⡞⡟⠠⠡⠢⠣⠤⠥⠦⠧⡠⡡⡢⡣⡤⡥⡦⡧⠨⠩⠪⠫⠬⠭⠮⠯⡨⡩⡪⡫⡬⡭⡮⡯⠰⠱⠲⠳⠴⠵⠶⠷⡰⡱⡲⡳⡴⡵⡶⡷⠸⠹⠺⠻⠼⠽⠾⠿⡸⡹⡺⡻⡼⡽⡾⡿⢀⢁⢂⢃⢄⢅⢆⢇⣀⣁⣂⣃⣄⣅⣆⣇⢈⢉⢊⢋⢌⢍⢎⢏⣈⣉⣊⣋⣌⣍⣎⣏⢐⢑⢒⢓⢔⢕⢖⢗⣐⣑⣒⣓⣔⣕⣖⣗⢘⢙⢚⢛⢜⢝⢞⢟⣘⣙⣚⣛⣜⣝⣞⣟⢠⢡⢢⢣⢤⢥⢦⢧⣠⣡⣢⣣⣤⣥⣦⣧⢨⢩⢪⢫⢬⢭⢮⢯⣨⣩⣪⣫⣬⣭⣮⣯⢰⢱⢲⢳⢴⢵⢶⢷⣰⣱⣲⣳⣴⣵⣶⣷⢸⢹⢺⢻⢼⢽⢾⢿⣸⣹⣺⣻⣼⣽⣾⣿".split('');

const { createCanvas, loadImage, Image } = require('canvas')
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

function getSimple(text) {
    var WIDTH = 20;
    var HEIGHT = 20;
    var i, j, k, canvas, ctx;
    
    var results = [];
    
    text = text.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]|(?:.|\r|\n)/g);
    if (text == null) return;
    
    for (i = 0; i < text.length; i++) {
        canvas = createCanvas(WIDTH, HEIGHT);
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
        canvas = createCanvas(WIDTH, HEIGHT);
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

api.on('message', function(message) {
    console.log(message);
    
    var commands = [
        require("./commands/textImage"),
        require("./commands/badge"),
    ]
    
    for (let command of commands) {
        if (command(gtoken, selfData, message)) {
            return;
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