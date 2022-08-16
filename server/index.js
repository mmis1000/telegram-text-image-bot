const express = require('express')
const config = require('../config')
const router = express()
const makeSticker = require('../commands/template').makeSticker

router.get('/sticker/:type/:text', (req, res, next) => {
    console.log(req.url)
    var type = req.params.type;
    var text = req.params.text;
    var img = makeSticker(req.query, text, type, 'image/jpeg')
    res.header('Content-Type', 'image/jpeg')
    res.end(img)
})

const server = router.listen(config.port, () => {
    console.log(`server up at port ${server.address().port}`)
})