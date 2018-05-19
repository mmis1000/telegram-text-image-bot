module.exports.extractFlags = function extractFlags(text) {
    var temp = text.match(/^((?:--?[a-z]+(?:=(?:"(?:[^"\\]|\\.)+"|[^\s]*))?\s+)*)((?:.|[\r\n])*)$/i)
    // console.log(temp);
    var newText = temp[2].replace(/^--\s/, '');
    var flags = {};
    var temp2 = temp[1].match(/--?[a-z]+(?:=(?:"(?:[^"\\]|\\.)+"|[^\s]*))?/ig)

    if (temp2) {
        temp2.forEach(function(flag) {
            var value = true;
            var hasValue = null;
            hasValue = !!flag.match(/^--?[a-z]+=/i);

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

module.exports.validate = function(rule, flags) {
    for (let key in flags) {
        var matched = false;

        var flagRules = rule.flags.filter((rule) => {
            if (key.length === 1) {
                return rule.short === key;
            } else {
                return rule.long === key;
            }
        });

        if (flagRules.length === 0) {
            throw new Error("unknown flag " + key);
        }

        var flagRule = flagRules[0]

        if (!flagRule.requireText && typeof flags[key] === 'string') {
            throw new Error('flag ' + key + ' does not have a value')
        }


        if (flagRule.requireText && typeof flags[key] !== 'string') {
            throw new Error("flag " + key + ' need to have a value of ' + flagRule.requireText);
        }

        if (flagRule.requireText) {
            var restrictions = rule.validates.filter((validate) => validate.type === flagRule.requireText);

            if (restrictions.length > 0) {
                var valid = restrictions[0].validate(flags[key]);

                if (!valid) {
                    throw new Error('at key ' + key + ': ' + restrictions[0].message);
                }
            }
        }
    }
}

module.exports.usage = function(command, botname, rule) {
    var abouts = []

    function substitute(text) {
        return text
            .replace('{command}', command.replace(/\_/g, '\\_'))
            .replace('{bot_name}', botname.replace(/\_/g, '\\_'));
    }

    var result = '';

    result += rule.description + '\n\n';
    result += 'Usage: ' + substitute(rule.usage) + '\n\n';
    result += 'Flags:\n';

    for (let flag of rule.flags) {
        let ruleText = "  ";

        if (flag.about) {
            abouts.push({
                names: flag.short ? (flag.long ? ['-' + flag.short, '--' + flag.long] : ['-' + flag.short]) : ['--' + flag.long],
                postFix: 'options',
                about: flag.about
            })
        }

        if (flag.short) {
            if (flag.long) {
                ruleText += `-${flag.short},--${flag.long}`
            } else {
                ruleText += `-${flag.short}`
            }
        } else {
            ruleText += `--${flag.long}`
        }

        if (flag.requireText) {
            ruleText += `=\`${flag.requireText}\``
        }

        ruleText += ': ';
        ruleText += flag.desc;

        result += ruleText + '\n'
    }

    result += '\n';

    abouts = abouts.concat(rule.abouts.map((o) => {
        return {
            names: [o.name],
            postFix: o.postFix || '',
            about: o.about
        }
    }))

    for (let item of abouts) {
        result += 'About the ' + item.names.map((str) => `\`${str}\``).join(', ') + ' ' + item.postFix + '\n\n';
        result += substitute(item.about) + '\n\n';
    }

    result += 'Examples:\n'

    for (let example of rule.examples) {
        result += substitute(example) + '\n';
    }

    return result;
}

module.exports.toUnsignedInt = function toUnsignedInt(input) {
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
