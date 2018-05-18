var Info = {
    description: `Generate a text sticker`,
    usage: `/{command}@{bot_name} \\[flags] \\[--] <text>`,
    flags: [
        {
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
            desc: "don't send as sticker, send as a document instead"
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
            long: 'shadowBlur',
            requireText: 'Int',
            desc: "set the shadow color"
        },
    ],
    validates: [
        {
            type: 'Int',
            validate: (str)=> /^-?[1-9]\d*$|^0$/.test(str),
            message: 'a Interger must be something matches /^-?[1-9]\\d*$|^0$/'
        }
    ],
    abouts: [
        {
            name: 'String',
            postFix: 'Type',
            about: '\`String\` could be anything except space or a valid JSON string'
        }
    ],
    examples: [
        '/{command}@{bot_name} --font="Noto Sans CJK JP" test',
        '/{command}@{bot_name} --font=monospace test'
    ]
};

var parser = require("../argumentParser.js");

console.log(parser.usage('a', 'b', Info))

function test(str) {
    console.log('assert ' + str);
    
    var res = parser.extractFlags(str.replace(/\/\S+(@\S+\s)/, ''));
    
    try {
        parser.validate(Info, res.flags)
    } catch (e) {
        console.log(e.message);
    }
}

test('/a@b -d test')
test('/a@b -d=1 tset')
test('/a@b -p tset')
test('/a@b -p=1 tset')
test('/a@b -a tset')
test('/a@b -a=1 tset')
test('/a@b -o tset')
test('/a@b -o=1 tset')
test('/a@b -o=k tset')
test('/a@b --width tset')
test('/a@b --width=1 tset')
test('/a@b --width=k tset')