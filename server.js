const express = require('express');
const bodyParser = require('body-parser');
const RecordManager = require('./recordManager');

const app = express();
const port = 3000;

app.use(bodyParser.json());

app.post('/recorder/v1/start', (req, res, next) => {
    const { appid, channel, storageConfig, callbackUrl } = req.body;

    if (!appid) {
        throw new Error("appid is mandatory");
    }

    if (!channel) {
        throw new Error("channel is mandatory");
    }

    RecordManager.start(appid, channel, storageConfig, callbackUrl).then(recorder => {
        res.status(200).json({
            success: true,
            sid: recorder.sid
        });
    }).catch((e) => {
        next(e);
    });
});

app.post('/recorder/v1/status', (req, res) => {
    const { sid } = req.body;

    if (!sid) {
        throw new Error("sid is mandatory");
    }

    const storage = RecordManager.getStorageFiles(sid);

    res.status(200).json({
        success: true,
        status: RecordManager.status(sid),
    });
});

app.post('/recorder/v1/stop', (req, res) => {
    const { sid } = req.body;

    if (!sid) {
        throw new Error("sid is mandatory");
    }

    RecordManager.stop(sid);
    
    res.status(200).json({
        success: true
    });
});

app.post('/recorder/v1/clean', (req, res) => {
    const { sid } = req.body;

    if (!sid) {
        throw new Error("sid is mandatory");
    }

    RecordManager.clean(sid);
    
    res.status(200).json({
        success: true
    });
});

app.use( (err, req, res, next) => {
    console.error(err.stack)
    res.status(500).json({
        success: false,
        err: err.message || 'generic error'
    })
})

app.listen(port);
