const FONTS = exports.fonts = {
    EMOJI: '\"Noto Color Emoji\"'
}

exports.processFonts = function(rawFont, withEmoji = true) {
    if (!rawFont.startsWith('\"')) {
        rawFont = '\"' + rawFont + '\"';
    }

    if (withEmoji) {
        return  FONTS.EMOJI + ', ' + rawFont;
    }

    return rawFont;
}